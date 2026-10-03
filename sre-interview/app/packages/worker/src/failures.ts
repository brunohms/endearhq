export function isPermanentWriteError(error: unknown): boolean {
  return /^(22|23)/.test(sqlState(error) ?? "");
}

export function describeError(error: unknown): string {
  for (const link of chain(error)) {
    const code = (link as { code?: unknown }).code;
    const message = (link as { message?: unknown }).message;
    if (typeof code === "string" && typeof message === "string") {
      return `${code}: ${message}`;
    }
  }
  return error instanceof Error ? error.message : String(error);
}

function sqlState(error: unknown): string | undefined {
  for (const link of chain(error)) {
    const code = (link as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

function* chain(error: unknown): Generator<object> {
  let current = error;
  for (let depth = 0; depth < 8; depth++) {
    if (typeof current !== "object" || current === null) return;
    yield current;
    current = (current as { cause?: unknown }).cause;
  }
}
