import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { createSdk } from "../src/sdk.js";

const ENDPOINT = "http://clickstack.observability.svc.cluster.local:4318";

describe("loadConfig", () => {
  it("treats a missing endpoint as tracing being off", () => {
    expect(loadConfig({}).endpoint).toBeUndefined();
    expect(loadConfig({ OTEL_EXPORTER_OTLP_ENDPOINT: "" }).endpoint).toBeUndefined();
  });

  it("strips a trailing slash, so the signal path is not doubled up", () => {
    expect(loadConfig({ OTEL_EXPORTER_OTLP_ENDPOINT: `${ENDPOINT}/` }).endpoint).toBe(
      ENDPOINT,
    );
  });

  it("ignores /health by default, and takes a list", () => {
    expect(loadConfig({}).ignorePaths).toEqual(["/health"]);
    expect(loadConfig({ OTEL_IGNORE_PATHS: "/health,/metrics" }).ignorePaths).toEqual([
      "/health",
      "/metrics",
    ]);
    expect(loadConfig({ OTEL_IGNORE_PATHS: "" }).ignorePaths).toEqual([]);
  });

  it("names the service from the same variable the logs use", () => {
    expect(loadConfig({ OTEL_SERVICE_NAME: "worker" }).serviceName).toBe("worker");
  });
});

describe("createSdk", () => {
  it("builds nothing when there is nowhere to send traces", () => {
    expect(createSdk(loadConfig({}))).toBeUndefined();
  });

  it("builds an SDK when an endpoint is configured", () => {
    const sdk = createSdk(loadConfig({ OTEL_EXPORTER_OTLP_ENDPOINT: ENDPOINT }));
    expect(sdk).toBeDefined();
    expect(typeof sdk?.start).toBe("function");
    expect(typeof sdk?.shutdown).toBe("function");
  });
});
