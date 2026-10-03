import { KafkaJS } from "@confluentinc/kafka-javascript";
import { traceProduce } from "@app/telemetry";

export interface Producer {
  send(topic: string, key: string, value: string): Promise<void>;
  disconnect(): Promise<void>;
}

export async function createProducer(brokers: string): Promise<Producer> {
  const kafka = new KafkaJS.Kafka({ kafkaJS: { brokers: brokers.split(",") } });
  const producer = kafka.producer({
    kafkaJS: { acks: 1, allowAutoTopicCreation: false },
  });
  await producer.connect();

  return {
    async send(topic, key, value) {
      await traceProduce({ topic, key }, async (headers) => {
        await producer.send({ topic, messages: [{ key, value, headers }] });
      });
    },
    async disconnect() {
      await producer.disconnect();
    },
  };
}

export async function ensureTopic(
  brokers: string,
  topic: string,
  numPartitions: number,
): Promise<void> {
  const kafka = new KafkaJS.Kafka({ kafkaJS: { brokers: brokers.split(",") } });
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
