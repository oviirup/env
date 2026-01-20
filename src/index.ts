import { type ZodError, type ZodObject, type ZodType, z } from "zod";

type ErrorMessage<T extends string> = T;
type Dictionary<T extends any = any> = Record<string, T>;
type Simplify<T> = Readonly<{ readonly [P in keyof T]: T[P] }> & {};
type Impossible<T extends Dictionary> = Partial<Record<keyof T, never>>;
type Mutable<T> = T extends Readonly<infer U> ? U : T;

type Reduce<Arr extends Dictionary<unknown>[], Acc = {}> = Arr extends []
  ? Acc
  : Arr extends [infer Head, ...infer Tail]
    ? Tail extends Dictionary<unknown>[]
      ? Head & Reduce<Tail, Acc>
      : never
    : never;

export interface BaseOptions<
  Shared extends Record<string, ZodType>,
  Extends extends Array<Record<string, unknown>>,
> {
  /** How to determine whether the app is running on the server or the client */
  isServer?: boolean;
  /** Shared variables, available to both client and server */
  shared?: Shared;
  /** Extend from presets */
  extends?: Extends;
  /** Called when validation fails, by default an error is thrown */
  onError?: (error: ZodError) => never;
  /** Called when a server-side environment variable is accessed on the client */
  onBreach?: (variable: string) => never;
  /** Whether to skip validation of environment variables */
  skip?: boolean;
}

export interface LooseOptions<
  Shared extends Record<string, ZodType>,
  Extends extends Array<Record<string, unknown>>,
> extends BaseOptions<Shared, Extends> {
  strict?: false;
  vars: Record<string, string | boolean | number | undefined>;
}

export interface StrictOptions<
  Prefix extends string | undefined,
  Server extends Record<string, ZodType>,
  Client extends Record<string, ZodType>,
  Shared extends Record<string, ZodType>,
  Extends extends Array<Record<string, unknown>>,
> extends BaseOptions<Shared, Extends> {
  strict: true;
  vars: Record<
    | {
        [K in keyof Client]: Prefix extends undefined
          ? never
          : K extends `${Prefix}${string}`
            ? K
            : never;
      }[keyof Client]
    | {
        [K in keyof Server]: Prefix extends undefined
          ? K
          : K extends `${Prefix}${string}`
            ? never
            : K;
      }[keyof Server]
    | {
        [K in keyof Shared]: K extends string ? K : never;
      }[keyof Shared],
    string | boolean | number | undefined
  >;
}

export interface ClientOptions<
  Prefix extends string | undefined,
  Client extends Dictionary<ZodType>,
> {
  /** The prefix that client-side variables must have */
  prefix: Prefix;
  /** Specify your client-side environment variables schema */
  client: Partial<{
    [K in keyof Client]: K extends `${Prefix}${string}`
      ? Client[K]
      : ErrorMessage<`${K extends string
          ? K
          : never} is not prefixed with ${Prefix}.`>;
  }>;
}

export interface ServerOptions<
  Prefix extends string | undefined,
  Server extends Record<string, ZodType>,
> {
  /** Specify your server-side environment variables schema */
  server: Partial<{
    [K in keyof Server]: Prefix extends undefined
      ? Server[K]
      : Prefix extends ""
        ? Server[K]
        : K extends `${Prefix}${string}`
          ? ErrorMessage<`${K extends `${Prefix}${string}`
              ? K
              : never} should not prefixed with ${Prefix}.`>
          : Server[K];
  }>;
}

export type ServerClientOptions<
  TPrefix extends string | undefined,
  TServer extends Record<string, ZodType>,
  TClient extends Record<string, ZodType>,
> =
  | (ClientOptions<TPrefix, TClient> & ServerOptions<TPrefix, TServer>)
  | (ServerOptions<TPrefix, TServer> & Impossible<ClientOptions<never, never>>)
  | (ClientOptions<TPrefix, TClient> & Impossible<ServerOptions<never, never>>);

export type EnvOptions<
  TPrefix extends string | undefined,
  TServer extends Record<string, ZodType>,
  TClient extends Record<string, ZodType>,
  TShared extends Record<string, ZodType>,
  TExtends extends Array<Record<string, unknown>>,
> =
  | (LooseOptions<TShared, TExtends> &
      ServerClientOptions<TPrefix, TServer, TClient>)
  | (StrictOptions<TPrefix, TServer, TClient, TShared, TExtends> &
      ServerClientOptions<TPrefix, TServer, TClient>);

const ERRORS = {
  INVALID_ENV: `Invalid environment variables`,
  INVALID_ACCESS: `Attempted to access a server-side environment variable on the client`,
};

export function envalid<
  TPrefix extends string | undefined,
  TServer extends Record<string, ZodType> = NonNullable<unknown>,
  TClient extends Record<string, ZodType> = NonNullable<unknown>,
  TShared extends Record<string, ZodType> = NonNullable<unknown>,
  const TExtends extends Array<Record<string, unknown>> = [],
>(
  opts: EnvOptions<TPrefix, TServer, TClient, TShared, TExtends>,
): Simplify<
  z.output<ZodObject<TServer>> &
    z.output<ZodObject<TClient>> &
    z.output<ZodObject<TShared>> &
    Mutable<Reduce<TExtends>>
> {
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
