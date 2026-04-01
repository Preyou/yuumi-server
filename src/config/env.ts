import { z } from 'zod'

const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'] as const
const REQUIRED_ENV_KEYS = [
  'APP_ENV',
  'DATABASE_URL',
  'JWT_SECRET',
  'OPENAPI_URL',
  'OTEL_ENABLED',
  'PORT',
] as const

function parseOptionalInt(input: unknown) {
  if (input === undefined || input === null) { return undefined }

  if (typeof input === 'number') { return input }

  if (typeof input === 'string') {
    const text = input.trim()
    if (text.length === 0) { return undefined }

    if (!/^\d+$/.test(text)) { return Number.NaN }

    return Number.parseInt(text, 10)
  }

  return Number.NaN
}

function readText(input: unknown): string | undefined {
  if (typeof input !== 'string') { return undefined }

  const text = input.trim()
  return text.length > 0 ? text : undefined
}

function assertRequiredEnvironment(rawEnv: Record<string, unknown>) {
  const missingKeys = REQUIRED_ENV_KEYS.filter(key => !readText(rawEnv[key]))

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingKeys.join(', ')}. `
      + 'Please define them in env, env.[environment], or env.[environment].local before startup.',
    )
  }
}

const rawEnv = import.meta.env as unknown as Record<string, unknown>

assertRequiredEnvironment(rawEnv)

const envInput = {
  APP_ENV: readText(rawEnv.APP_ENV),
  DATABASE_URL: readText(rawEnv.DATABASE_URL),
  IDEMPOTENCY_TTL_MS: rawEnv.IDEMPOTENCY_TTL_MS,
  JWT_SECRET: readText(rawEnv.JWT_SECRET),
  LOG_LEVEL: readText(rawEnv.LOG_LEVEL),
  OPENAPI_URL: readText(rawEnv.OPENAPI_URL),
  OTEL_ENABLED: readText(rawEnv.OTEL_ENABLED),
  PORT: readText(rawEnv.PORT),
}

const envSchema = z.object({
  APP_ENV: z.enum(['development', 'production', 'test']),
  DATABASE_URL: z.string().trim().min(1),
  IDEMPOTENCY_TTL_MS: z.preprocess(
    parseOptionalInt,
    z.number().int().positive().optional(),
  ),
  JWT_SECRET: z.string().trim().min(1),
  LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
  OPENAPI_URL: z.string().trim().min(1),
  OTEL_ENABLED: z.enum(['0', '1']),
  PORT: z.preprocess(
    parseOptionalInt,
    z.number().int().min(1).max(65535),
  ),
})

const parsedEnv = envSchema.safeParse(envInput)

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ')
  throw new Error(`Invalid server environment: ${details}`)
}

export const serverConfig = {
  ...parsedEnv.data,
  isDevelopment: parsedEnv.data.APP_ENV === 'development',
  otelEnabled: parsedEnv.data.OTEL_ENABLED === '1',
} as const

export type ServerEnv = typeof serverConfig
