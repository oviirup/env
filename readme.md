# @oviirup/env ![](https://img.shields.io/badge/WIP-gold)

Type-safe environment variable validation for JavaScript frameworks

A lightweight, type-safe environment variable validator built on top of Zod. Safely validate and access environment variables with full TypeScript support, runtime validation, and protection against accidentally exposing server-only variables to the client.

## Features

- ✅ **Type-safe** - Full TypeScript inference from your Zod schemas
- ✅ **Runtime validation** - Catch configuration errors before deployment
- ✅ **Client/server safety** - Prevent accidental access to server-only variables on the client
- ✅ **Framework agnostic** - Core module works with any JavaScript framework
- ✅ **Next.js optimized** - Pre-configured helper for Next.js projects
- ✅ **Zero dependencies** - Only requires Zod as a peer dependency
- ✅ **Built-in presets** - Ready-made configurations for popular platforms

## Installation

```bash
bun i @oviirup/env zod
```

**Note:** This package requires `zod` (>= 4)

## Quick Start

### Next.js

Use the Next.js-specific helper (`@oviirup/env/next`) for automatic configuration with Next.js defaults:

```ts
// env.ts
import { createEnv } from "@oviirup/env/next";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    SECRET_KEY: z.string().min(32),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
    NEXT_PUBLIC_APP_NAME: z.string().default("My App"),
  },
  vars: {
    DATABASE_URL: process.env.DATABASE_URL,
    SECRET_KEY: process.env.SECRET_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  },
});
```

The Next.js helper automatically:
- Sets `strict: true` for type safety
- Configures `prefix: "NEXT_PUBLIC_"` for client variables
- Enforces that client variables use the `NEXT_PUBLIC_` prefix

### Other Frameworks

Use the core module (`@oviirup/env`) for full control over configuration:

```ts
// env.ts
import { createEnv } from "@oviirup/env";
import { z } from "zod";

export const env = createEnv({
  strict: true,
  prefix: "VITE_", // Your framework's client prefix
  server: {
    DATABASE_URL: z.string().url(),
    API_SECRET: z.string(),
  },
  client: {
    VITE_API_URL: z.string().url(),
    VITE_APP_ENV: z.enum(["development", "production"]),
  },
  vars: import.meta.env, // or process.env
});
```

## Usage

After creating your environment configuration, import and use it throughout your application:

```ts
// server.ts (server-side only)
import { env } from "./env";

const dbUrl = env.DATABASE_URL; // ✅ Type-safe, validated
const secret = env.SECRET_KEY; // ✅ Available on server

// client.tsx (client-side)
import { env } from "./env";

const apiUrl = env.NEXT_PUBLIC_API_URL; // ✅ Safe on client
const dbUrl = env.DATABASE_URL; // ❌ Throws error - invalid access
```

## API Reference

### `createEnv(options)`

Creates a validated, type-safe environment object from your Zod schemas.

**Returns:** A readonly object containing parsed and validated environment variables. The return type is automatically inferred from your Zod schemas.

#### Options

##### `server` (optional)

An object mapping server-only environment variable names to Zod schemas. These variables are only accessible on the server and will throw an error if accessed on the client.

```ts
server: {
  DATABASE_URL: z.string().url(),
  SECRET_KEY: z.string().min(32),
}
```

##### `client` (optional)

An object mapping client-exposed environment variable names to Zod schemas. When `prefix` is configured, all client variable keys must start with that prefix.

```ts
client: {
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_APP_NAME: z.string(),
}
```

##### `shared` (optional)

Variables that are available on both client and server. These don't require a prefix.

```ts
shared: {
  NODE_ENV: z.enum(["development", "production", "test"]),
  APP_VERSION: z.string(),
}
```

##### `vars` (optional)

The source object to validate against. Defaults to `process.env`. Useful when working with frameworks that use different environment objects (e.g., `import.meta.env` in Vite).

```ts
vars: process.env // Default
vars: import.meta.env // Vite
vars: { CUSTOM_VAR: "value" } // Custom object
```

When `strict: true`, the `vars` object must contain all keys defined in your schemas. When `strict: false` (default), extra keys are allowed.

##### `strict` (optional)

When `true`, enforces that `vars` contains exactly the keys defined in your schemas. When `false`, allows additional keys. Defaults to `false`.

```ts
strict: true // Type-safe, exact matching
strict: false // Loose matching (default)
```

##### `prefix` (optional)

The prefix that client-side variables must have. When set, enforces that:
- Client variables start with this prefix
- Server variables do NOT start with this prefix

```ts
prefix: "NEXT_PUBLIC_" // Next.js
prefix: "VITE_" // Vite
prefix: undefined // No prefix enforcement
```

**Note:** The Next.js helper (`@oviirup/env/next`) automatically sets `prefix: "NEXT_PUBLIC_"` and `strict: true`.

##### `isServer` (optional)

Override the automatic server/client detection. By default, detects server-side by checking `typeof window === "undefined"`.

```ts
isServer: typeof window === "undefined" // Default
isServer: true // Force server mode
isServer: false // Force client mode
```

##### `extends` (optional)

An array of plain objects to merge into the final environment object. Useful for extending with preset configurations or computed values.

```ts
extends: [
  { FEATURE_FLAG: true },
  { BUILD_TIME: Date.now() },
]
```

##### `skip` (optional)

When `true`, skips validation and returns the raw environment object. Useful for testing or development.

```ts
skip: true // Skip validation
```

##### `onError` (optional)

Custom error handler called when validation fails. Receives the `ZodError` and should throw or handle the error.

```ts
onError: (error) => {
  console.error("Environment validation failed:", error);
  process.exit(1);
}
```

##### `onBreach` (optional)

Custom handler called when a server-only variable is accessed on the client. Defaults to throwing an error.

```ts
onBreach: (variable) => {
  console.warn(`Attempted to access server variable "${variable}" on client`);
  return undefined;
}
```

## Advanced Examples

### Shared Variables

Variables that should be available on both client and server:

```ts
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  shared: {
    NODE_ENV: z.enum(["development", "production", "test"]),
    APP_VERSION: z.string(),
  },
  vars: process.env,
});
```

### Custom Error Handling

Provide custom error handlers for better error messages:

```ts
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  vars: process.env,
  onError: (error) => {
    const issues = error.issues.map((issue) => 
      `${issue.path.join(".")}: ${issue.message}`
    ).join("\n");
    throw new Error(`Environment validation failed:\n${issues}`);
  },
  onBreach: (variable) => {
    throw new Error(
      `Cannot access server-only variable "${variable}" on the client. ` +
      `Use a NEXT_PUBLIC_ prefixed variable instead.`
    );
  },
});
```

### Using with Presets

Combine custom configuration with presets:

```ts
import { vercel } from "@oviirup/env/presets";
import { createEnv } from "@oviirup/env/next";
import { z } from "zod";

export const env = createEnv({
  extends: [vercel()],
  server: {
    CUSTOM_SERVER_VAR: z.string(),
  },
  client: {
    NEXT_PUBLIC_CUSTOM_CLIENT_VAR: z.string(),
  },
  vars: process.env,
});
```

## Presets

Pre-configured environment variable schemas for popular platforms and services.

### Available Presets

- **`vercel()`** - Vercel system environment variables
- **`neonVercel()`** - Neon database integration on Vercel
- **`supabaseVercel()`** - Supabase integration on Vercel
- **`upstashRedis()`** - Upstash Redis configuration
- **`vite()`** - Vite environment wrapper (uses `import.meta.env`)

### Usage

```ts
import { vercel, supabaseVercel } from "@oviirup/env/presets";
import { createEnv } from "@oviirup/env/next";

export const env = createEnv({
  extends: [vercel(), supabaseVercel()],
  server: {
    // Your custom server variables
  },
  client: {
    // Your custom client variables
  },
  vars: process.env,
});
```

Each preset returns a validated environment object with the appropriate Zod schemas and configuration.

## TypeScript

Full TypeScript support with automatic type inference:

```ts
import { createEnv } from "@oviirup/env/next";
import { z } from "zod";

export const env = createEnv({
  server: {
    PORT: z.coerce.number(),
    DATABASE_URL: z.string().url(),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  vars: process.env,
});

// TypeScript automatically infers:
// env.PORT: number
// env.DATABASE_URL: string
// env.NEXT_PUBLIC_API_URL: string
```

## Why?

Environment variable validation is crucial for catching configuration errors early. This library provides:

1. **Type Safety** - Catch typos and type mismatches at compile time
2. **Runtime Validation** - Ensure all required variables are present and valid
3. **Security** - Prevent accidentally exposing sensitive server variables to the client
4. **Developer Experience** - Clear error messages and full IDE autocomplete support
5. **Framework Flexibility** - Use the same validation logic across different frameworks

## License

MIT
