import { describe, expect, expectTypeOf, spyOn, test } from "bun:test";
import { z } from "zod";
import { createEnv } from "../src";

function ignoreErrors(cb: () => void) {
  try {
    cb();
  } catch (err) {}
}

describe("env", () => {
  test("server vars should not be prefixed", () => {
    ignoreErrors(() => {
      createEnv({
        prefix: "FOO_",
        // @ts-expect-error - server should not have FOO_ prefix
        server: { FOO_BAR: z.string(), BAR: z.string() },
        client: {},
      });
    });
  });

  test("client vars should be correctly prefixed", () => {
    ignoreErrors(() => {
      createEnv({
        prefix: "FOO_",
        server: {},
        // @ts-expect-error - no FOO_ prefix
        client: { FOO_BAR: z.string(), BAR: z.string() },
      });
    });
  });

  test("runtimeEnvStrict enforces all keys", () => {
    createEnv({
      prefix: "FOO_",
      server: {},
      client: {},
      vars: {},
    });
    createEnv({
      prefix: "FOO_",
      server: {},
      client: { FOO_BAR: z.string() },
      strict: true,
      vars: { FOO_BAR: "foo" },
    });
    createEnv({
      prefix: "FOO_",
      server: { BAR: z.string() },
      client: {},
      vars: { BAR: "foo" },
    });
    createEnv({
      prefix: "FOO_",
      server: { BAR: z.string() },
      client: { FOO_BAR: z.string() },
      vars: { BAR: "foo", FOO_BAR: "foo" },
    });
    createEnv({
      prefix: "FOO_",
      server: {},
      client: { FOO_BAR: z.string() },
      strict: true,
      // @ts-expect-error - FOO_BAZ is extraneous
      vars: { FOO_BAR: "foo", FOO_BAZ: "baz" },
    });
    ignoreErrors(() => {
      // @ts-expect-error - BAR is missing
      createEnv({
        prefix: "FOO_",
        server: { BAR: z.string() },
        client: { FOO_BAR: z.string() },
        strict: true,
        vars: { FOO_BAR: "foo" },
      });
    });
  });

  test("can pass number and booleans", () => {
    const env = createEnv({
      prefix: "FOO_",
      server: { PORT: z.number(), IS_DEV: z.boolean() },
      client: {},
      strict: true,
      vars: { PORT: 123, IS_DEV: true },
    });
    expectTypeOf(env).toEqualTypeOf<
      Readonly<{ PORT: number; IS_DEV: boolean }>
    >();
    expect(env).toMatchObject({ PORT: 123, IS_DEV: true });
  });

  describe("return type is correctly inferred", () => {
    test("simple", () => {
      const env = createEnv({
        prefix: "FOO_",
        server: { BAR: z.string() },
        client: { FOO_BAR: z.string() },
        strict: true,
        vars: { BAR: "bar", FOO_BAR: "foo" },
      });
      expectTypeOf(env).toEqualTypeOf<
        Readonly<{ BAR: string; FOO_BAR: string }>
      >();
      expect(env).toMatchObject({ BAR: "bar", FOO_BAR: "foo" });
    });
    test("with transforms", () => {
      const env = createEnv({
        prefix: "FOO_",
        server: { BAR: z.string().transform(Number) },
        client: { FOO_BAR: z.string() },
        strict: true,
        vars: { BAR: "123", FOO_BAR: "foo" },
      });
      expectTypeOf(env).toEqualTypeOf<
        Readonly<{ BAR: number; FOO_BAR: string }>
      >();
      expect(env).toMatchObject({ BAR: 123, FOO_BAR: "foo" });
    });
    test("without client vars", () => {
      const env = createEnv({
        prefix: "FOO_",
        server: { BAR: z.string() },
        client: {},
        strict: true,
        vars: { BAR: "bar" },
      });
      expectTypeOf(env).toEqualTypeOf<Readonly<{ BAR: string }>>();
      expect(env).toMatchObject({ BAR: "bar" });
    });
  });
});
