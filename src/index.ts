import * as pi from "picocolors";
import { object, z } from "zod";
import type { ZodError, ZodObject, ZodType } from "zod";

const CLIENT_PREFIX = "NEXT_PUBLIC_" as const;

type TPrefix = typeof CLIENT_PREFIX;
type TRecord = Record<string, ZodType>;
type ErrorMessage<T extends string> = T;
type Simplify<T> = { [P in keyof T]: T[P] } & {};
type Mutable<T> = T extends Readonly<infer U> ? U : T;

type Impossible<T extends Record<string, any>> = Partial<
  Record<keyof T, never>
>;

type Reduce<
  TArr extends Array<Record<string, unknown>>,
  TAcc = {},
> = TArr extends []
  ? TAcc
  : TArr extends [infer Head, ...infer Tail]
    ? Tail extends Array<Record<string, unknown>>
      ? Head & Reduce<Tail, TAcc>
      : never
    : never;

export interface BaseOptions<
  TShared extends TRecord,
  TExtends extends Array<Record<string, unknown>>,
> {
  /**
   * How to determine whether the app is running on the server or the client.
   *
   * @default typeof window === "undefined"
   */
  isServer?: boolean;

  /**
   * Shared variables, often those that are provided by build tools and is
   * available to both client and server, but isn't prefixed and doesn't require
   * to be manually supplied. For example `NODE_ENV`, `VERCEL_URL` etc.
   */
  shared?: TShared;

  /** Extend presets */
  extends?: TExtends;

  /**
   * Called when validation fails. By default the error is logged, and an error
   * is thrown telling what environment variables are invalid.
   */
  onValidationError?: (error: ZodError) => never;

  /**
   * Called when a server-side environment variable is accessed on the client.
   * By default an error is thrown.
   */
  onInvalidAccess?: (variable: string) => never;

  /**
   * Whether to skip validation of environment variables.
   *
   * @default false
   */
  skipValidation?: boolean;
}

interface StrictOptions<
  TServer extends TRecord,
  TClient extends TRecord,
  TShared extends TRecord,
  TExtends extends Array<Record<string, unknown>>,
> extends BaseOptions<TShared, TExtends> {
  runtimeEnv: Record<
    | {
        [TKey in keyof TClient]: TKey extends `${TPrefix}${string}`
          ? TKey
          : never;
      }[keyof TClient]
    | {
        [TKey in keyof TServer]: TKey extends `${TPrefix}${string}`
          ? never
          : TKey;
      }[keyof TServer]
    | {
        [TKey in keyof TShared]: TKey extends string ? TKey : never;
      }[keyof TShared],
    string | boolean | number | undefined
  >;
}

export interface ClientOptions<TClient extends TRecord> {
  /**
   * Specify your client-side environment variables schema here. This way you
   * can ensure the app isn't built with invalid env vars.
   */
  client: Partial<{
    [TKey in keyof TClient]: TKey extends `${TPrefix}${string}`
      ? TClient[TKey]
      : ErrorMessage<`${TKey extends string ? TKey : never} is not prefixed with ${TPrefix}.`>;
  }>;
}

export interface ServerOptions<TServer extends TRecord> {
  /**
   * Specify your server-side environment variables schema here. This way you
   * can ensure the app isn't built with invalid env vars.
   */
  server: Partial<{
    [TKey in keyof TServer]: TKey extends `${TPrefix}${string}`
      ? ErrorMessage<`${TKey extends `${TPrefix}${string}` ? TKey : never} should not prefixed with ${TPrefix}.`>
      : TServer[TKey];
  }>;
}

export type ServerClientOptions<
  TServer extends TRecord,
  TClient extends TRecord,
> =
  | (ClientOptions<TClient> & ServerOptions<TServer>)
  | (ServerOptions<TServer> & Impossible<ClientOptions<never>>)
  | (ClientOptions<TClient> & Impossible<ServerOptions<never>>);

export type EnvOptions<
  TServer extends TRecord,
  TClient extends TRecord,
  TShared extends TRecord,
  TExtends extends Array<Record<string, unknown>>,
> = StrictOptions<TServer, TClient, TShared, TExtends> &
  ServerClientOptions<TServer, TClient>;

type TServerFormat = TRecord;
type TClientFormat = TRecord;
type TSharedFormat = TRecord;
type TExtendsFormat = Array<Record<string, unknown>>;

export type CreateEnv<
  TServer extends TServerFormat,
  TClient extends TClientFormat,
  TShared extends TSharedFormat,
  TExtends extends TExtendsFormat,
> = Readonly<
  Simplify<
    z.output<ZodObject<TServer>> &
      z.output<ZodObject<TClient>> &
      z.output<ZodObject<TShared>> &
      Mutable<Reduce<TExtends>>
  >
>;

function displayError(error: ZodError) {
  console.error(`${pi.red("\u00D7")} Invalid environment variables:`);
  const errorList = error.issues;
  const errorCount = errorList.length;
  errorList.forEach((err, i) => {
    const key = err.path[0].toString();
    const message = err.message || "Invalid value";
    const prefix = i === errorCount - 1 ? "└──" : "├──";
    console.error(`${prefix} ${key}: ${message}`);
  });
}

export function envalid<
  TServer extends TServerFormat = NonNullable<unknown>,
  TClient extends TClientFormat = NonNullable<unknown>,
  TShared extends TSharedFormat = NonNullable<unknown>,
  const TExtends extends TExtendsFormat = [],
>(
  opts: EnvOptions<TServer, TClient, TShared, TExtends>,
): CreateEnv<TServer, TClient, TShared, TExtends> {
  const runtimeEnv = opts.runtimeEnv ?? process.env;

  // remove empty strings from runtime env
  for (const [key, value] of Object.entries(runtimeEnv)) {
    if (value && value === "") {
      // @ts-expect-error unnecessarily cautious
      delete runtimeEnv[key];
    }
  }

  const skip = !!opts.skipValidation;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  if (skip) return runtimeEnv as any;

  const _client = typeof opts.client === "object" ? opts.client : {};
  const _server = typeof opts.server === "object" ? opts.server : {};
  const _shared = typeof opts.shared === "object" ? opts.shared : {};
  const client = object(_client);
  const server = object(_server);
  const shared = object(_shared);
  const isServer =
    opts.isServer ?? (typeof window === "undefined" || "Deno" in window);

  const allClient = client.extend(shared);
  const allServer = server.extend(shared).extend(client);
  const parsed = isServer
    ? allServer.safeParse(runtimeEnv) // on server we can validate all env vars
    : allClient.safeParse(runtimeEnv); // on client we can only validate the ones that are exposed

  const onValidationError =
    opts.onValidationError ??
    ((error: ZodError) => {
      displayError(error);
      throw new Error("Invalid environment variables");
    });

  const onInvalidAccess =
    opts.onInvalidAccess ??
    ((_variable: string) => {
      throw new Error(
        "❌ Attempted to access a server-side environment variable on the client",
      );
    });

  if (parsed.success === false) {
    return onValidationError(parsed.error);
  }

  const isServerAccess = (prop: string) => {
    return !prop.startsWith(CLIENT_PREFIX) && !(prop in shared.shape);
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

  return env as any;
}
