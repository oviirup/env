import type { ZodError, ZodObject, ZodType } from "zod";
import { z } from "zod";

type ErrorMessage<T extends string> = T;
type Dictionary<T extends any = any> = Record<string, T>;
type Impossible<T extends Dictionary> = Partial<Record<keyof T, never>>;
type Mutable<T> = T extends Readonly<infer U> ? U : T;
type Key<Prefix extends string | undefined> = `${Prefix}${string}`;

type Simplify<T> = {
  readonly [P in keyof T as string extends P ? never : P]: T[P];
} & {};

type Reduce<Arr extends Dictionary<unknown>[], Acc = {}> = Arr extends []
  ? Acc
  : Arr extends [infer Head, ...infer Tail]
    ? Tail extends Dictionary<unknown>[]
      ? Head & Reduce<Tail, Acc>
      : never
    : never;

export type BaseOptions<
  G extends Record<string, ZodType>,
  E extends Record<string, unknown>[],
> = {
  /** How to determine whether the app is running on the server or the client */
  isServer?: boolean;
  /** Shared variables, available to both client and server */
  shared?: G;
  /** Extend from presets */
  extends?: E;
  /** Called when validation fails, by default an error is thrown */
  onError?: (error: ZodError) => never;
  /** Called when a server-side environment variable is accessed on the client */
  onBreach?: (variable: string) => never;
  /** Whether to skip validation of environment variables */
  skip?: boolean;
};

export type LooseOptions<
  G extends Record<string, ZodType>,
  E extends Record<string, unknown>[],
> = BaseOptions<G, E> & {
  strict?: false;
  vars: Dictionary<string | boolean | number | undefined>;
};

export type StrictOptions<
  P extends string | undefined,
  S extends Record<string, ZodType>,
  C extends Record<Key<P>, ZodType>,
  G extends Record<string, ZodType>,
  E extends Record<string, unknown>[],
> = BaseOptions<G, E> & {
  strict: true;
  vars: Record<
    | {
        [CK in keyof C]: P extends undefined
          ? never
          : CK extends Key<P>
            ? CK
            : never;
      }[keyof C]
    | {
        [SK in keyof S]: P extends undefined
          ? SK
          : SK extends Key<P>
            ? never
            : SK;
      }[keyof S]
    | {
        [K in keyof G]: K extends string ? K : never;
      }[keyof G],
    string | boolean | number | undefined
  >;
};

export type ClientOptions<
  P extends string | undefined,
  C extends Record<Key<P>, ZodType>,
> = {
  /** The prefix that client-side variables must have */
  prefix: P;
  /** Specify your client-side environment variables schema */
  client: Partial<{
    [K in keyof C]: K extends Key<P>
      ? C[K]
      : ErrorMessage<`${K extends string ? K : never} is not prefixed with ${P}.`>;
  }>;
};

export type ServerOptions<
  P extends string | undefined,
  S extends Record<string, ZodType>,
> = {
  /** Specify your server-side environment variables schema */
  server: Partial<{
    [K in keyof S]: P extends undefined
      ? S[K]
      : P extends ""
        ? S[K]
        : K extends Key<P>
          ? ErrorMessage<`${K extends Key<P> ? K : never} should not prefixed with ${P}.`>
          : S[K];
  }>;
};

export type ServerClientOptions<
  P extends string | undefined,
  S extends Record<string, ZodType>,
  C extends Record<Key<P>, ZodType>,
> =
  | (ClientOptions<P, C> & ServerOptions<P, S>)
  | (ServerOptions<P, S> & Impossible<ClientOptions<never, never>>)
  | (ClientOptions<P, C> & Impossible<ServerOptions<never, never>>);

export type EnvOptions<
  P extends string | undefined,
  S extends Record<string, ZodType>,
  C extends Record<Key<P>, ZodType>,
  G extends Record<string, ZodType>,
  E extends Record<string, unknown>[],
> =
  | (LooseOptions<G, E> & ServerClientOptions<P, S, C>)
  | (StrictOptions<P, S, C, G, E> & ServerClientOptions<P, S, C>);

export type EnvOutput<
  P extends string | undefined,
  S extends Record<string, ZodType>,
  C extends Record<Key<P>, ZodType>,
  G extends Record<string, ZodType>,
  E extends Record<string, unknown>[],
> = Simplify<
  z.output<ZodObject<S>> &
    z.output<ZodObject<C>> &
    z.output<ZodObject<G>> &
    Mutable<Reduce<E>>
>;

const ERRORS = {
  INVALID_ENV: `Invalid environment variables`,
  INVALID_ACCESS: `Attempted to access a server-side environment variable on the client`,
};

export function createEnv<
  P extends string | undefined,
  S extends Record<string, ZodType> = NonNullable<unknown>,
  C extends Record<string, ZodType> = NonNullable<unknown>,
  G extends Record<string, ZodType> = NonNullable<unknown>,
  const E extends Record<string, unknown>[] = [],
>(opts: EnvOptions<P, S, C, G, E>): EnvOutput<P, S, C, G, E> {
  const runtimeEnv = opts.vars ?? process.env;

  for (const [key, value] of Object.entries(runtimeEnv)) {
    if (value === "") delete runtimeEnv[key as keyof typeof runtimeEnv];
  }

  const skip = !!opts.skip;
  if (skip) return runtimeEnv as any;

  const _client = typeof opts.client === "object" ? opts.client : {};
  const _server = typeof opts.server === "object" ? opts.server : {};
  const _shared = typeof opts.shared === "object" ? opts.shared : {};
  const client = z.object(_client);
  const server = z.object(_server);
  const shared = z.object(_shared);
  const isServer = opts.isServer ?? typeof window === "undefined";

  const allClient = client.extend(shared.shape);
  const allServer = server.extend(shared.shape).extend(client.shape);
  const parsed = isServer
    ? allServer.safeParse(runtimeEnv) // on server we can validate all env vars
    : allClient.safeParse(runtimeEnv); // on client we can only validate the ones that are exposed

  const onValidationError =
    opts.onError ??
    ((error: ZodError) => {
      const errorVars = error.issues.map((e) => e.path).join(", ");
      console.error(`Invalid environment variables: ${errorVars}`);
      throw new Error(`${ERRORS.INVALID_ENV}: ${errorVars}`);
    });

  const onInvalidAccess =
    opts.onBreach ??
    ((variable: string) => {
      throw new Error(`${ERRORS.INVALID_ACCESS}: ${variable}`);
    });

  if (parsed.success === false) {
    return onValidationError(parsed.error);
  }

  const isServerAccess = (prop: string) => {
    if (!opts.prefix) return true;
    return !prop.startsWith(opts.prefix) && !(prop in shared.shape);
  };
  const isValidServerAccess = (prop: string) => {
    return isServer || !isServerAccess(prop);
  };
  const ignoreProp = (prop: string) => {
    return prop === "__esModule" || prop === "$$typeof";
  };

  const presetsEnvSet = (opts.extends ?? []).reduce((acc, curr) => {
    return Object.assign(acc, curr);
  }, {});
  const completeEnvSet = Object.assign(parsed.data, presetsEnvSet);

  const env = new Proxy(completeEnvSet, {
    get(target, prop) {
      if (typeof prop !== "string") return undefined;
      if (ignoreProp(prop)) return undefined;
      if (!isValidServerAccess(prop)) return onInvalidAccess(prop);
      return Reflect.get(target, prop);
    },
  });

  return env as any;
}
