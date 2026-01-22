import z, { ZodType } from "zod";
import {
  createEnv as createEnvBase,
  EnvOptions,
  ServerClientOptions,
  StrictOptions,
} from "./index";

const CLIENT_PREFIX = "NEXT_PUBLIC_" as const;
type Prefix = typeof CLIENT_PREFIX;
type Key = `${Prefix}${string}`;

type Options<
  S extends Record<string, ZodType> = NonNullable<unknown>,
  C extends Record<Key, ZodType> = NonNullable<unknown>,
  G extends Record<string, ZodType> = NonNullable<unknown>,
  E extends Record<string, unknown>[] = [],
> = Omit<
  StrictOptions<Prefix, S, C, G, E> & ServerClientOptions<Prefix, S, C>,
  "prefix" | "strict"
>;

export function createEnv<
  S extends Record<string, ZodType> = NonNullable<unknown>,
  C extends Record<string, ZodType> = NonNullable<unknown>,
  G extends Record<string, ZodType> = NonNullable<unknown>,
  const E extends Record<string, unknown>[] = [],
>(opts: Options<S, C, G, E>) {
  const client = typeof opts.client === "object" ? opts.client : {};
  const server = typeof opts.server === "object" ? opts.server : {};
  const shared = opts.shared;
  const envs = opts.vars ?? process.env;

  return createEnvBase<Prefix, S, C, G, E>({
    ...opts,
    server,
    client,
    shared,
    vars: envs,
    strict: true,
    prefix: CLIENT_PREFIX,
  });
}
