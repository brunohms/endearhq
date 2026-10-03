import type { Database } from "@app/db";
import type { Logger } from "@app/logging";
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import type { Producer } from "./kafka.js";
import { apiRoutes } from "./routes/api.js";
import { ingestRoutes } from "./routes/ingest.js";

export interface AppOptions {
  db: Database;
  producer: Producer;
  ingestTopic: string;
  loggerInstance?: Logger | false;
}

export function buildApp(options: AppOptions): FastifyInstance {
  const serverOptions: FastifyServerOptions =
    options.loggerInstance === false
      ? { logger: false }
      : options.loggerInstance
        ? { loggerInstance: options.loggerInstance }
        : { logger: true };

  const app = Fastify(serverOptions);

  app.get("/health", { logLevel: "silent" }, async () => ({ status: "ok" }));

  app.register(apiRoutes(options.db), { prefix: "/api", logLevel: "warn" });
  app.register(ingestRoutes(options.producer, options.ingestTopic), {
    prefix: "/ingest",
  });

  return app;
}
