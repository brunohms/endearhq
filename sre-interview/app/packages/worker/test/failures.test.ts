import { describe, expect, it } from "vitest";
import { describeError, isPermanentWriteError } from "../src/failures.js";

const wrapped = (code: string, message: string) =>
  new Error("Failed query: insert into \"orders\"", {
    cause: Object.assign(new Error(message), { name: "PostgresError", code }),
  });

describe("isPermanentWriteError", () => {
  it("dead letters a value too wide for the column", () => {
    expect(isPermanentWriteError(wrapped("22003", "numeric field overflow"))).toBe(true);
  });

  it("dead letters a value the column cannot parse", () => {
    expect(
      isPermanentWriteError(wrapped("22P02", 'invalid input syntax for type numeric: "x"')),
    ).toBe(true);
  });

  it("dead letters an integrity violation", () => {
    expect(isPermanentWriteError(wrapped("23503", "foreign key violation"))).toBe(true);
    expect(isPermanentWriteError(wrapped("23502", "not null violation"))).toBe(true);
  });

  it("retries a database that is not there, rather than dead lettering it", () => {
    expect(isPermanentWriteError(wrapped("08006", "connection terminated"))).toBe(false);
    expect(isPermanentWriteError(wrapped("57P01", "terminating connection"))).toBe(false);
    expect(isPermanentWriteError(wrapped("40P01", "deadlock detected"))).toBe(false);
  });

  it("retries an error that carries no SQLSTATE at all", () => {
    expect(isPermanentWriteError(new Error("socket hang up"))).toBe(false);
    expect(isPermanentWriteError(undefined)).toBe(false);
    expect(isPermanentWriteError("not an error")).toBe(false);
  });

  it("finds the SQLSTATE however deeply it is wrapped", () => {
    const deep = new Error("outer", { cause: wrapped("22003", "numeric field overflow") });
    expect(isPermanentWriteError(deep)).toBe(true);
  });

  it("does not spin on a cause that points at itself", () => {
    const loop: { cause?: unknown } = {};
    loop.cause = loop;
    expect(isPermanentWriteError(loop)).toBe(false);
  });
});

describe("describeError", () => {
  it("keeps the SQLSTATE next to the message", () => {
    expect(describeError(wrapped("22003", "numeric field overflow"))).toBe(
      "22003: numeric field overflow",
    );
  });

  it("falls back to the message when there is no SQLSTATE", () => {
    expect(describeError(new Error("socket hang up"))).toBe("socket hang up");
  });
});
