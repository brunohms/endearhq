import { SpanKind, SpanStatusCode, context, propagation, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { traceConsume, traceProduce, type KafkaHeaders } from "../src/kafka.js";

const exporter = new InMemorySpanExporter();

beforeAll(() => {
  const provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  trace.setGlobalTracerProvider(provider);
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
});

beforeEach(() => exporter.reset());

const spans = () => exporter.getFinishedSpans();

describe("traceProduce", () => {
  it("puts a traceparent on the message", async () => {
    let sent: KafkaHeaders = {};
    await traceProduce({ topic: "ingest", key: "abc" }, async (headers) => {
      sent = headers;
    });

    expect(typeof sent.traceparent).toBe("string");
    const [span] = spans();
    expect(sent.traceparent).toContain(span?.spanContext().traceId);
    expect(span?.name).toBe("ingest send");
    expect(span?.kind).toBe(SpanKind.PRODUCER);
  });

  it("marks a failed publish failed, and still throws", async () => {
    await expect(
      traceProduce({ topic: "ingest" }, async () => {
        throw new Error("broker down");
      }),
    ).rejects.toThrow("broker down");

    expect(spans()[0]?.status.code).toBe(SpanStatusCode.ERROR);
  });
});

describe("traceConsume", () => {
  const consumed = (headers: KafkaHeaders | undefined) => ({
    topic: "ingest",
    partition: 0,
    message: { key: Buffer.from("abc"), offset: "42", headers },
  });

  it("continues the producer's trace rather than starting its own", async () => {
    let headers: KafkaHeaders = {};
    await traceProduce({ topic: "ingest" }, async (h) => {
      headers = h;
    });
    const produced = spans()[0];
    exporter.reset();

    await traceConsume(consumed(headers), async () => {});

    const [consume] = spans();
    expect(consume?.name).toBe("ingest process");
    expect(consume?.kind).toBe(SpanKind.CONSUMER);
    expect(consume?.spanContext().traceId).toBe(produced?.spanContext().traceId);
    expect(consume?.parentSpanContext?.spanId).toBe(produced?.spanContext().spanId);
  });

  it("decodes headers that arrive as Buffers, which is how they arrive", async () => {
    let headers: KafkaHeaders = {};
    await traceProduce({ topic: "ingest" }, async (h) => {
      headers = h;
    });
    const traceId = spans()[0]?.spanContext().traceId;
    exporter.reset();

    const asBuffers: KafkaHeaders = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k, Buffer.from(String(v))]),
    );
    await traceConsume(consumed(asBuffers), async () => {});

    expect(spans()[0]?.spanContext().traceId).toBe(traceId);
  });

  it("makes the consume span the parent of whatever the handler does", async () => {
    await traceConsume(consumed({}), async () => {
      await trace.getTracer("test").startActiveSpan("pg.query:INSERT app", async (s) => {
        s.end();
      });
    });

    const inner = spans().find((s) => s.name === "pg.query:INSERT app");
    const outer = spans().find((s) => s.name === "ingest process");
    expect(inner?.parentSpanContext?.spanId).toBe(outer?.spanContext().spanId);
  });

  it("starts a fresh trace when the message carries no context", async () => {
    await traceConsume(consumed(undefined), async () => {});
    const [span] = spans();
    expect(span?.parentSpanContext).toBeUndefined();
    expect(span?.name).toBe("ingest process");
  });

  it("records a rethrown failure, because that message will be redelivered", async () => {
    await expect(
      traceConsume(consumed({}), async () => {
        throw new Error("connection terminated");
      }),
    ).rejects.toThrow("connection terminated");

    expect(spans()[0]?.status.code).toBe(SpanStatusCode.ERROR);
  });
});
