# Environment Variable Rules

## Source Of Truth

- Runtime env must be parsed from [`src/env.ts`](/Users/ouyangwenhu/代码/yuumi/packages/server/src/env.ts), and imported as a readonly default object: `import env from '@/env'`.
- Drizzle env must be parsed from [`src/drizzle-env.ts`](/Users/ouyangwenhu/代码/yuumi/packages/server/src/drizzle-env.ts), and imported as a readonly default object: `import drizzleEnv from '@/drizzle-env'`.
- Both modules must export with `Object.freeze(...)` and must be the only env parsing entry points.

## Forbidden Usage

- Do not read `import.meta.env` directly outside `src/env.ts` and `src/drizzle-env.ts`.
- Do not parse env values inline (for example `Number.parseInt(import.meta.env.PORT, 10)`).

## Required Keys

- Runtime required keys:
  - `NODE_ENV`
  - `API_PREFIX`
  - `PORT`
  - `OPENAPI_URL`
  - `DATABASE_URL`
  - `JWT_SECRET`
- Drizzle required keys:
  - `DATABASE_URL`

## Type Conventions

- Numeric env vars must be converted in `src/env.ts`:
  - `PORT`
  - `LOG_MASK`
  - `LOG_FILE_MAX_BYTES`
  - `LOG_FILE_RETENTION_DAYS`
  - `IDEMPOTENCY_TTL_MS`
- `DIALECT` must normalize to `mysql | postgresql | sqlite`.
- Route-path vars like `API_PREFIX` and `OPENAPI_URL` must start with `/`.

## Validation Rule

- Missing required keys must fail fast during startup or drizzle config load.
- Invalid format or out-of-range numbers must throw explicit env errors.
- ESLint enforces this via `no-restricted-syntax` in `packages/server/eslint.config.ts`.
