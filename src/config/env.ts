import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const SERVER_ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const REQUIRED_ENV_KEYS = [
  'API_PREFIX',
  'APP_ENV',
  'DATABASE_URL',
  'JWT_SECRET',
  'OPENAPI_URL',
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

function resolveLogFileDir(input: string | undefined) {
  if (!input) { return undefined }

  if (path.isAbsolute(input)) {
    return path.normalize(input)
  }

  return path.resolve(SERVER_ROOT_DIR, input)
}

function normalizeApiPrefix(input: string) {
  const value = input.trim()

  if (!value.startsWith('/')) {
    throw new Error('API_PREFIX must start with "/"')
  }

  if (value.length > 1 && value.endsWith('/')) {
    return value.slice(0, -1)
  }

  return value
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
  API_PREFIX: readText(rawEnv.API_PREFIX),
  APP_ENV: readText(rawEnv.APP_ENV),
  DATABASE_URL: readText(rawEnv.DATABASE_URL),
  IDEMPOTENCY_TTL_MS: rawEnv.IDEMPOTENCY_TTL_MS,
  JWT_SECRET: readText(rawEnv.JWT_SECRET),
  LOG_FILE_DIR: readText(rawEnv.LOG_FILE_DIR),
  LOG_FILE_MAX_BYTES: rawEnv.LOG_FILE_MAX_BYTES,
  LOG_FILE_RETENTION_DAYS: rawEnv.LOG_FILE_RETENTION_DAYS,
  LOG_MASK: rawEnv.LOG_MASK,
  OPENAPI_URL: readText(rawEnv.OPENAPI_URL),
  PORT: readText(rawEnv.PORT),
}

const envSchema = z.object({
  API_PREFIX: z.string().trim().min(1),
  APP_ENV: z.enum(['development', 'production', 'test']),
  DATABASE_URL: z.string().trim().min(1),
  IDEMPOTENCY_TTL_MS: z.preprocess(
    parseOptionalInt,
    z.number().int().positive().optional(),
  ),
  JWT_SECRET: z.string().trim().min(1),
  LOG_FILE_DIR: z.string().trim().min(1).optional(),
  LOG_FILE_MAX_BYTES: z.preprocess(
    parseOptionalInt,
    z.number().int().positive().optional(),
  ),
  LOG_FILE_RETENTION_DAYS: z.preprocess(
    parseOptionalInt,
    z.number().int().positive().optional(),
  ),
  LOG_MASK: z.preprocess(
    parseOptionalInt,
    z.number().int().nonnegative().optional(),
  ),
  OPENAPI_URL: z.string().trim().min(1),
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

const logFileDir = resolveLogFileDir(parsedEnv.data.LOG_FILE_DIR)
const apiPrefix = normalizeApiPrefix(parsedEnv.data.API_PREFIX)

export const serverConfig = {
  ...parsedEnv.data,
  API_PREFIX: apiPrefix,
  LOG_FILE_DIR: logFileDir,
  isDevelopment: parsedEnv.data.APP_ENV === 'development',
} as const

export type ServerEnv = typeof serverConfig
