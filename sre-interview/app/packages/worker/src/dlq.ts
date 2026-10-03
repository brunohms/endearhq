import { KafkaJS } from "@confluentinc/kafka-javascript";
import { traceProduce } from "@app/telemetry";

export type DeadLetterReason = "unmappable" | "rejected";

export interface DeadLetter {
  key: string | null;
  value: string;
  reason: DeadLetterReason;
  detail: string;
  sourceTopic: string;
  partition: number;
  offset: string;
}

export interface DeadLetterQueue {
  send(letter: DeadLetter): Promise<void>;
  disconnect(): Promise<void>;
}

export async function createDeadLetterQueue(
  brokers: string[],
  topic: string,
): Promise<DeadLetterQueue> {
  const kafka = new KafkaJS.Kafka({ kafkaJS: { brokers } });
  const producer = kafka.producer({
    kafkaJS: { acks: 1, allowAutoTopicCreation: false },
  });
  await producer.connect();

  return {
    async send(letter) {
      await traceProduce({ topic, key: letter.key }, async (traceHeaders) => {
        await producer.send({
          topic,
          messages: [
            {
              key: letter.key,
              value: letter.value,
              headers: {
                ...traceHeaders,
                "dlq.reason": letter.reason,
                "dlq.detail": letter.detail,
                "dlq.source.topic": letter.sourceTopic,
                "dlq.source.partition": String(letter.partition),
                "dlq.source.offset": letter.offset,
                "dlq.failed.at": new Date().toISOString(),
              },
            },
          ],
        });
      });
    },
    async disconnect() {
      await producer.disconnect();
    },
  };
}

export async function ensureTopic(
  brokers: string[],
  topic: string,
  numPartitions: number,
): Promise<void> {
  const kafka = new KafkaJS.Kafka({ kafkaJS: { brokers } });
  const admin = kafka.admin();
  await admin.connect();
  try {
    const existing = await admin.listTopics();
    if (!existing.includes(topic)) {
      await admin.createTopics({
        topics: [{ topic, numPartitions, replicationFactor: 1 }],
      });
    }
  } finally {
    await admin.disconnect();
  }
}
