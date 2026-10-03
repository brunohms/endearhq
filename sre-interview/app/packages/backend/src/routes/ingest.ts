import type { FastifyPluginAsync } from "fastify";
import { validateIngestPayload } from "../ingest.js";
import type { Producer } from "../kafka.js";

export const ingestRoutes =
  (producer: Producer, topic: string): FastifyPluginAsync =>
  async function ingestApi(app) {
    app.post("/", async function postIngest(request, reply) {
      const result = validateIngestPayload(request.body);

      if (!result.ok) {
        request.log.warn({ reason: result.error }, "rejected ingest payload");
        return reply.status(400).send({ error: result.error });
      }

      try {
        await producer.send(topic, result.value.id, JSON.stringify(request.body));
      } catch (error) {
        request.log.error(
          { err: error, topic, id: result.value.id },
          "could not publish to the ingest topic",
        );
        throw error;
      }

      request.log.info(
        { id: result.value.id, type: result.value.type, topic },
        "accepted for ingestion",
      );

      return reply.status(202).send({ status: "accepted", id: result.value.id });
    });
  };
