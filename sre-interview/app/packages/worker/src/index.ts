import { KafkaJS } from "@confluentinc/kafka-javascript";
import { createDatabase } from "@app/db";
import { createLogging } from "@app/logging";
import { traceConsume } from "@app/telemetry";
import { createDeadLetterQueue, ensureTopic } from "./dlq.js";
import { describeError, isPermanentWriteError } from "./failures.js";
import { parseMessage } from "./mapping.js";
import { writeRecord } from "./store.js";

const brokers = required("KAFKA_BROKERS").split(",");
const topic = process.env.INGEST_TOPIC ?? "ingest";
const dlqTopic = process.env.DLQ_TOPIC ?? "ingest-dlq";
const groupId = process.env.KAFKA_GROUP_ID ?? "ingest-worker";
const db = createDatabase(required("DATABASE_URL"));

const { logger, shutdown: shutdownLogging } = createLogging({
  serviceName: process.env.OTEL_SERVICE_NAME ?? "worker",
});

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

await ensureTopic(brokers, dlqTopic, 1);
const dlq = await createDeadLetterQueue(brokers, dlqTopic);

const kafka = new KafkaJS.Kafka({ kafkaJS: { brokers } });
const consumer = kafka.consumer({
  kafkaJS: {
    groupId,
    fromBeginning: true,
  },
});

await consumer.connect();
await consumer.subscribe({ topics: [topic] });

logger.info({ topic, dlqTopic, groupId }, "worker started");

await consumer.run({
  eachMessage: async (payload) =>
    traceConsume(payload, () => handleMessage(payload), { groupId }),
});

async function handleMessage({
  topic: sourceTopic,
  partition,
  message,
}: {
  topic: string;
  partition: number;
  message: { value?: Buffer | null; key?: Buffer | null; offset: string };
}): Promise<void> {
  const raw = message.value?.toString();
  if (!raw) return;
  const key = message.key?.toString() ?? null;

  const deadLetter = async (
    reason: "unmappable" | "rejected",
    detail: string,
  ) => {
    await dlq.send({
      key,
      value: raw,
      reason,
      detail,
      sourceTopic,
      partition,
      offset: message.offset,
    });
    logger.warn(
      { reason, detail, dlqTopic, partition, offset: message.offset },
      "dead lettered",
    );
  };

  const result = parseMessage(raw);
  if (!result.ok) {
    await deadLetter("unmappable", result.reason);
    return;
  }

  let resolvedCustomer: boolean;
  try {
    ({ resolvedCustomer } = await writeRecord(db, result.record));
  } catch (error) {
    if (!isPermanentWriteError(error)) {
      logger.error(
        {
          err: error,
          detail: describeError(error),
          partition,
          offset: message.offset,
        },
        "write failed, will retry",
      );
      throw error;
    }
    await deadLetter("rejected", describeError(error));
    return;
  }

  if (result.record.kind === "order" && !resolvedCustomer) {
    logger.warn(
      { kind: result.record.kind, externalId: result.record.externalId },
      "customer not found yet, order stored unlinked",
    );
  } else {
    logger.info(
      { kind: result.record.kind, externalId: result.record.externalId },
      "wrote record",
    );
  }
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    logger.info({ signal }, "shutting down");
    void consumer
      .disconnect()
      .then(() => dlq.disconnect())
      .then(() => shutdownLogging())
      .then(() => process.exit(0));
  });
}
