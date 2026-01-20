# envalid

Validate environment variables with zod for Next.js and other JavaScript/TypeScript projects.

A tiny helper around zod that makes it easy to validate runtime environment variables and safely expose client-side variables (prefixed with `NEXT_PUBLIC_`). Includes a few presets for common setups (Vercel, Supabase, Neon, Upstash, Vite).

## Features

- Validate server and client environment variables with zod schemas.
- Prevent accidental access to server-only variables on the client.
- Small, zero-dependency helper (peer dependency: `zod`).
- Built-in presets for common platforms.

## Installation

This package has a peer dependency on `zod` (>= 4). Install both:

```bash
# npm
npm install @oviirup/envalid zod

# or yarn
yarn add @oviirup/envalid zod

# or pnpm
pnpm add @oviirup/envalid zod
```

## Quick Start

Create a small module that validates your environment and exports the typed env object.

```ts
import envalid from "@oviirup/envalid";
import { z } from "zod";

export const env = envalid({
  server: {
    DATABASE_URL: z.string(),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url().optional(),
  },
  // in next.js you have to pass the environment variables individually
  vars: {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
});

// Usage elsewhere
// import { env } from "./env";
// const dbUrl = env.DATABASE_URL; // server-side only
// const apiUrl = env.NEXT_PUBLIC_API_URL; // safe on client
```

## API

### envalid(options)

Returns: a readonly object containing the parsed and validated environment variables (the return type is inferred from your zod schemas).

Options (fields you'll commonly use):

- `server` — an object where keys are server-only env var names and values are zod types (e.g. `z.string()`).
- `client` — an object for client-exposed env vars. Client keys must be prefixed with `NEXT_PUBLIC_`.
- `shared` — a zod record of variables shared between client and server (no prefix required).
- `extends` — an array of plain records to extend the returned env object with arbitrary values.
- `vars` — (optional) the source object to validate (defaults to `process.env`). When `strict` is `true`, provides strict type checking. When `strict` is `false` or omitted, uses loose typing. Useful for Vite or testing where env is in `import.meta.env`.
- `strict` — (optional) boolean flag. When `true`, `vars` must match the exact keys from your schema. When `false` or omitted, `vars` can contain any keys (defaults to `false`).
- `isServer` — (optional) boolean override to determine server vs client runtime. By default it detects `typeof window === "undefined"`.
- `skipValidation` — (optional) if true, validation is skipped and the raw runtime env is returned.
- `onValidationError` — (optional) callback invoked with the `ZodError` when validation fails. Default logs a readable error and throws.
- `onInvalidAccess` — (optional) callback invoked when a server-only variable is accessed on the client. Defaults to throwing an error.

Notes:

- Client env keys must start with the `NEXT_PUBLIC_` prefix. Server env keys must not use that prefix.
- By default, on the client only variables starting with `NEXT_PUBLIC_` (and shared keys) are validated and available; accessing server-only keys on the client triggers `onInvalidAccess`.

## Presets

The package exposes a set of ready-made presets in `./presets` that validate common provider environment variables. Import them like:

```ts
import {
  vercel,
  supabaseVercel,
  neonVercel,
  upstashRedis,
  vite,
} from "@oviirup/envalid/presets";

// Example:
export const env = vercel();
```

Available presets (current):

- `vercel()` — Vercel system env vars
- `neonVercel()` — Neon DB integration on Vercel
- `supabaseVercel()` — Supabase integration on Vercel
- `upstashRedis()` — Upstash Redis
- `vite()` — Vite environment wrapper (uses `import.meta.env`)

Each preset returns the result of calling `envalid(...)` with sensible zod schemas and `vars` set appropriately.

## Next.js / Usage notes

- Put a small `env.ts` or `env.mjs` module in your project that calls `envalid(...)` and exports the resulting object. Import that module where you need typed env values.
- Keep server-only variables (DB credentials, service role keys) without the `NEXT_PUBLIC_` prefix. Only expose values on the client with the `NEXT_PUBLIC_` prefix.

## Development & Build

This project uses `bunchee` to build the package. Available scripts from `package.json`:

```bash
npm run build   # bundle for distribution
npm run dev     # watch mode
npm run format  # run prettier
```

## Contributing

Contributions are welcome. Please open issues or PRs if you need additional presets or changes.

## License

MIT
