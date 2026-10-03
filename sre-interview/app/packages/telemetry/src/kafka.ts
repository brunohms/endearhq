import {
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  propagation,
  trace,
  type Span,
  type TextMapGetter,
  type TextMapSetter,
  type Tracer,
} from "@opentelemetry/api";
import {
  ATTR_MESSAGING_CONSUMER_GROUP_NAME,
  ATTR_MESSAGING_DESTINATION_NAME,
  ATTR_MESSAGING_DESTINATION_PARTITION_ID,
  ATTR_MESSAGING_KAFKA_MESSAGE_KEY,
  ATTR_MESSAGING_KAFKA_OFFSET,
  ATTR_MESSAGING_OPERATION_NAME,
  ATTR_MESSAGING_OPERATION_TYPE,
  ATTR_MESSAGING_SYSTEM,
  MESSAGING_OPERATION_TYPE_VALUE_PROCESS,
  MESSAGING_OPERATION_TYPE_VALUE_SEND,
  MESSAGING_SYSTEM_VALUE_KAFKA,
} from "@opentelemetry/semantic-conventions/incubating";

export type KafkaHeaders = Record<
  string,
  Buffer | string | Array<Buffer | string> | undefined
>;

const getter: TextMapGetter<KafkaHeaders> = {
  keys: (carrier) => Object.keys(carrier ?? {}),
  get(carrier, key) {
    const value = carrier?.[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first === undefined) return undefined;
    return typeof first === "string" ? first : first.toString("utf8");
  },
};

const setter: TextMapSetter<KafkaHeaders> = {
  set(carrier, key, value) {
    carrier[key] = value;
  },
};

const tracer = (): Tracer => trace.getTracer("kafka");

function fail(span: Span, error: unknown): void {
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error instanceof Error ? error.message : String(error),
  });
  if (error instanceof Error) span.recordException(error);
}

export interface ProduceOptions {
  topic: string;
  key?: string | null;
}

export async function traceProduce<T>(
  options: ProduceOptions,
  send: (headers: KafkaHeaders) => Promise<T>,
): Promise<T> {
  return tracer().startActiveSpan(
    `${options.topic} send`,
    {
      kind: SpanKind.PRODUCER,
      attributes: {
        [ATTR_MESSAGING_SYSTEM]: MESSAGING_SYSTEM_VALUE_KAFKA,
        [ATTR_MESSAGING_DESTINATION_NAME]: options.topic,
        [ATTR_MESSAGING_OPERATION_NAME]: "send",
        [ATTR_MESSAGING_OPERATION_TYPE]: MESSAGING_OPERATION_TYPE_VALUE_SEND,
        ...(options.key ? { [ATTR_MESSAGING_KAFKA_MESSAGE_KEY]: options.key } : {}),
      },
    },
    async (span) => {
      const headers: KafkaHeaders = {};
      propagation.inject(trace.setSpan(ROOT_CONTEXT, span), headers, setter);
      try {
        return await send(headers);
      } catch (error) {
        fail(span, error);
        throw error;
      } finally {
        span.end();
      }
    },
  );
}

export interface ConsumedMessage {
  topic: string;
  partition: number;
  message: {
    key?: Buffer | string | null | undefined;
    offset?: string | undefined;
    headers?: KafkaHeaders | undefined;
  };
}

export interface ConsumeOptions {
  groupId?: string | undefined;
}

export async function traceConsume<T>(
  payload: ConsumedMessage,
  handler: () => Promise<T>,
  options: ConsumeOptions = {},
): Promise<T> {
  const { topic, partition, message } = payload;
  const parent = propagation.extract(ROOT_CONTEXT, message.headers ?? {}, getter);
  const key = message.key;

  return tracer().startActiveSpan(
    `${topic} process`,
    {
      kind: SpanKind.CONSUMER,
      attributes: {
        [ATTR_MESSAGING_SYSTEM]: MESSAGING_SYSTEM_VALUE_KAFKA,
        [ATTR_MESSAGING_DESTINATION_NAME]: topic,
        [ATTR_MESSAGING_OPERATION_NAME]: "process",
        [ATTR_MESSAGING_OPERATION_TYPE]: MESSAGING_OPERATION_TYPE_VALUE_PROCESS,
        [ATTR_MESSAGING_DESTINATION_PARTITION_ID]: String(partition),
        ...(message.offset ? { [ATTR_MESSAGING_KAFKA_OFFSET]: message.offset } : {}),
        ...(key ? { [ATTR_MESSAGING_KAFKA_MESSAGE_KEY]: key.toString() } : {}),
        ...(options.groupId
          ? { [ATTR_MESSAGING_CONSUMER_GROUP_NAME]: options.groupId }
          : {}),
      },
    },
    parent,
    async (span) => {
      try {
        return await handler();
      } catch (error) {
        fail(span, error);
        throw error;
      } finally {
        span.end();
      }
    },
  );
}
