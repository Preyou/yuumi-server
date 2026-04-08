# Environment Variable Rules

## Source Of Truth

- For files under `src/**`, environment variables must be read only via [`src/env.ts`](/Users/ouyangwenhu/代码/yuumi/packages/server/src/env.ts).
- `src/env.ts` must export a readonly default object with `Object.freeze(...)`.
- Files outside `src/**` (for example `drizzle.config.ts`, `scripts/**`) are allowed to read `import.meta.env`, but must do local validation.

## Forbidden Usage

- In `src/**`, do not read `import.meta.env` directly outside `src/env.ts`.
- In `src/**`, do not parse env values inline (for example `Number.parseInt(import.meta.env.PORT, 10)`).

## Required Keys (src runtime)

- Runtime required keys:
  - `NODE_ENV`
  - `API_PREFIX`
  - `PORT`
  - `OPENAPI_URL`
  - `DATABASE_URL`
  - `JWT_SECRET`

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

- Missing required keys in `src/env.ts` must fail fast during startup.
- Invalid format or out-of-range numbers must throw explicit env errors.
- ESLint enforces this for `src/**` via `no-restricted-syntax` in `packages/server/eslint.config.ts`.
