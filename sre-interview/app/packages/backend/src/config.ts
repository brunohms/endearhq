export interface Config {
  port: number;
  host: string;
  databaseUrl: string;
  kafkaBrokers: string;
  ingestTopic: string;
}

export function loadConfig(env = process.env): Config {
  const required = (name: string): string => {
    const value = env[name];
    if (!value) throw new Error(`${name} is not set`);
    return value;
  };

  return {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? "0.0.0.0",
    databaseUrl: required("DATABASE_URL"),
    kafkaBrokers: required("KAFKA_BROKERS"),
    ingestTopic: env.INGEST_TOPIC ?? "ingest",
  };
}
