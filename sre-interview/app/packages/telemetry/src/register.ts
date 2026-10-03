import { loadConfig } from "./config.js";
import { createSdk } from "./sdk.js";

const sdk = createSdk(loadConfig());
sdk?.start();

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    void sdk?.shutdown().catch(() => {
    });
  });
}
