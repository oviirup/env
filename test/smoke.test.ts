import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { envalid } from "../src";

function ignoreErrors(cb: () => void) {
  try {
    cb();
  } catch (err) {}
}

describe("envalid", () => {
  test("server vars should not be prefixed", () => {
    ignoreErrors(() => {
      envalid({
        prefix: "FOO_",
        server: {
          // @ts-expect-error - server should not have FOO_ prefix
          FOO_BAR: z.string(),
          BAR: z.string(),
        },
        client: {},
      });
    });
  });

  test("client vars should be correctly prefixed", () => {
    ignoreErrors(() => {
      envalid({
        prefix: "FOO_",
        server: {},
        client: {
          FOO_BAR: z.string(),
          // @ts-expect-error - no FOO_ prefix
          BAR: z.string(),
        },
      });
    });
  });

  test("runtimeEnvStrict enforces all keys", () => {
    envalid({
      prefix: "FOO_",
      server: {},
      client: {},
      vars: {},
    });
    envalid({
      prefix: "FOO_",
      server: {},
      client: { FOO_BAR: z.string() },
      vars: { FOO_BAR: "foo" },
    });
    envalid({
      prefix: "FOO_",
      server: { BAR: z.string() },
      client: {},
      vars: { BAR: "foo" },
    });
    envalid({
      prefix: "FOO_",
      server: { BAR: z.string() },
      client: { FOO_BAR: z.string() },
      vars: { BAR: "foo", FOO_BAR: "foo" },
    });
    envalid({
      prefix: "FOO_",
      server: {},
      client: { FOO_BAR: z.string() },
      vars: { FOO_BAR: "foo", FOO_BAZ: "baz" },
    });
    ignoreErrors(() => {
      envalid({
        prefix: "FOO_",
        server: { BAR: z.string() },
        client: { FOO_BAR: z.string() },
        vars: { FOO_BAR: "foo" },
      });
    });
  });

  test("can pass number and booleans", () => {
    const env = envalid({
      prefix: "FOO_",
      server: {
        PORT: z.number(),
        IS_DEV: z.boolean(),
      },
      client: {},
      vars: { PORT: 123, IS_DEV: true },
    });

    expect(env).toMatchObject({
      PORT: 123,
      IS_DEV: true,
    });
  });
});
