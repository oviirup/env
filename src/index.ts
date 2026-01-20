import { type ZodError, type ZodObject, type ZodType, z } from "zod";

type ErrorMessage<T extends string> = T;
type Dictionary<T extends any = any> = Record<string, T>;
type Simplify<T> = Readonly<{ [P in keyof T]: T[P] } & {}>;
type Impossible<T extends Dictionary> = Partial<Record<keyof T, never>>;
type Mutable<T> = T extends Readonly<infer U> ? U : T;

type Reduce<
  TArr extends Array<Dictionary<unknown>>,
  TAcc = {},
> = TArr extends []
  ? TAcc
  : TArr extends [infer Head, ...infer Tail]
    ? Tail extends Array<Dictionary<unknown>>
      ? Head & Reduce<Tail, TAcc>
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

type StrictEnvType<
  Prefix extends string | undefined,
  Server extends Dictionary<ZodType>,
  Client extends Dictionary<ZodType>,
  Shared extends Dictionary<ZodType>,
> = Record<
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

type LooseVarsOptions<
  Shared extends Dictionary<ZodType>,
  Extends extends Dictionary<unknown>[],
> = BaseOptions<Shared, Extends> & {
  strict?: false;
  /** What object holds the environment variables at runtime */
  vars?: Dictionary<string | boolean | number | undefined>;
};

type StrictVarsOptions<
  Prefix extends string | undefined,
  Server extends Dictionary<ZodType>,
  Client extends Dictionary<ZodType>,
  Shared extends Dictionary<ZodType>,
  Extends extends Dictionary<unknown>[],
> = BaseOptions<Shared, Extends> & {
  strict: true;
  /** Runtime Environment variables to use for validation */
  vars: StrictEnvType<Prefix, Server, Client, Shared>;
};

export interface ClientOptions<
  Prefix extends string | undefined,
  Client extends Dictionary<ZodType>,
> {
  /**
   * The prefix that client-side variables must have. This is enforced both at
   * a type-level and at runtime.
   */
  prefix: Prefix;

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app isn't
   * built with invalid env vars.
   */
  client: Partial<{
    [K in keyof Client]: K extends `${Prefix}${string}`
      ? Client[K]
      : ErrorMessage<`${K extends string
          ? K
          : never} is not prefixed with ${Prefix}.`>;
  }>;
}

export interface ServerOptions<
  TPrefix extends string | undefined,
  TServer extends Record<string, ZodType>,
> {
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app isn't
   * built with invalid env vars.
   */
  server: Partial<{
    [TKey in keyof TServer]: TPrefix extends undefined
      ? TServer[TKey]
      : TPrefix extends ""
        ? TServer[TKey]
        : TKey extends `${TPrefix}${string}`
          ? ErrorMessage<`${TKey extends `${TPrefix}${string}`
              ? TKey
              : never} should not prefixed with ${TPrefix}.`>
          : TServer[TKey];
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
  | (LooseVarsOptions<TShared, TExtends> &
      ServerClientOptions<TPrefix, TServer, TClient>)
  | (StrictVarsOptions<TPrefix, TServer, TClient, TShared, TExtends> &
      ServerClientOptions<TPrefix, TServer, TClient>);

export type EnvOutput<
  TServer extends Record<string, ZodType>,
  TClient extends Record<string, ZodType>,
  TShared extends Record<string, ZodType>,
  TExtends extends Array<Record<string, unknown>>,
> = Simplify<
  z.infer<ZodObject<TServer>> &
    z.infer<ZodObject<TClient>> &
    z.infer<ZodObject<TShared>> &
    Mutable<Reduce<TExtends>>
>;

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
): EnvOutput<TServer, TClient, TShared, TExtends> {
  const runtimeEnv = opts.vars ?? process.env;

  for (const [key, value] of Object.entries(runtimeEnv)) {
    if (value === "") delete runtimeEnv[key];
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

  const mergedClient = client.extend(shared);
  const mergedServer = server.extend(shared).extend(client);
  const parsed = isServer
    ? mergedServer.safeParse(runtimeEnv) // on server we can validate all env vars
    : mergedClient.safeParse(runtimeEnv); // on client we can only validate the ones that are exposed

  const onValidationError =
    opts.onError ??
    ((error: ZodError) => {
      throw new Error(`${ERRORS.INVALID_ENV}: ${error.message}`);
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

  const extendedObj = (opts.extends ?? []).reduce((acc, curr) => {
    return Object.assign(acc, curr);
  }, {});
  const fullObj = Object.assign(parsed.data, extendedObj);

  const env = new Proxy(fullObj, {
    get(target, prop) {
      if (typeof prop !== "string") return undefined;
      if (ignoreProp(prop)) return undefined;
      if (!isValidServerAccess(prop)) return onInvalidAccess(prop);
      return Reflect.get(target, prop);
    },
  });

  // biome-ignore lint/suspicious/noExplicitAny: proxy return type is complex
  return env as any;
}
