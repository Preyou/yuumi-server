type RawEnv = Record<string, string | undefined>

const APP_REQUIRED_KEYS = [
  'API_PREFIX',
  'DATABASE_URL',
  'JWT_SECRET',
  'NODE_ENV',
  'OPENAPI_URL',
  'PORT',
] as const

export type NodeEnv = 'development' | 'production' | 'test'
export type DatabaseDialect = 'mysql' | 'postgresql' | 'sqlite'

export interface ServerEnv {
  apiPrefix: string
  databaseUrl: string
  dialect: DatabaseDialect
  idempotencyTtlMs?: number
  jwtSecret: string
  logFileDir?: string
  logFileMaxBytes?: number
  logFileRetentionDays?: number
  logMask?: number
  nodeEnv: NodeEnv
  openapiUrl: string
  port: number
}

// eslint-disable-next-line no-restricted-syntax
const rawEnv = import.meta.env as unknown as RawEnv

function normalizeText(input: string | undefined) {
  const normalized = input?.trim()
  return normalized ? normalized : undefined
}

function ensureRequired(raw: RawEnv, keys: readonly string[]) {
  const missing = keys.filter((key) => {
    const value = normalizeText(raw[key])
    return !value
  })

  if (missing.length > 0) {
    throw new Error(`[env] Missing required env vars: ${missing.join(', ')}`)
  }
}

function parseIntEnv(
  key: string,
  value: string,
  options: {
    max?: number
    min?: number
  } = {},
) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed)) {
    throw new Error(`[env] ${key} must be an integer, got "${value}"`)
  }

  if (options.min !== undefined && parsed < options.min) {
    throw new Error(`[env] ${key} must be >= ${options.min}, got "${parsed}"`)
  }

  if (options.max !== undefined && parsed > options.max) {
    throw new Error(`[env] ${key} must be <= ${options.max}, got "${parsed}"`)
  }

  return parsed
}

function parseOptionalIntEnv(
  key: string,
  input: string | undefined,
  options: {
    max?: number
    min?: number
  } = {},
) {
  const value = normalizeText(input)
  if (!value) {
    return undefined
  }

  return parseIntEnv(key, value, options)
}

function parseNodeEnv(input: string): NodeEnv {
  const value = input.toLowerCase()
  if (value === 'development' || value === 'production' || value === 'test') {
    return value
  }

  throw new Error(`[env] NODE_ENV must be development|test|production, got "${input}"`)
}

function parseDialect(input: string | undefined): DatabaseDialect {
  const value = input?.toLowerCase()

  if (!value) {
    return 'sqlite'
  }

  if (value === 'mysql') {
    return 'mysql'
  }

  if (value === 'postgresql' || value === 'pg' || value === 'postgres') {
    return 'postgresql'
  }

  if (value === 'sqlite') {
    return 'sqlite'
  }

  throw new Error(`[env] DIALECT must be mysql|postgresql|sqlite, got "${input}"`)
}

function parsePathEnv(key: string, input: string) {
  const value = input.trim()
  if (!value.startsWith('/')) {
    throw new Error(`[env] ${key} must start with "/", got "${input}"`)
  }

  return value
}

function parseServerEnv(raw: RawEnv): ServerEnv {
  ensureRequired(raw, APP_REQUIRED_KEYS)

  const nodeEnv = parseNodeEnv(raw.NODE_ENV as string)
  const apiPrefix = parsePathEnv('API_PREFIX', raw.API_PREFIX as string)
  const openapiUrl = parsePathEnv('OPENAPI_URL', raw.OPENAPI_URL as string)
  const port = parseIntEnv('PORT', raw.PORT as string, {
    max: 65535,
    min: 1,
  })
  const databaseUrl = (raw.DATABASE_URL as string).trim()
  const jwtSecret = (raw.JWT_SECRET as string).trim()
  const dialect = parseDialect(normalizeText(raw.DIALECT))
  const logMask = parseOptionalIntEnv('LOG_MASK', raw.LOG_MASK, { min: 0 })
  const logFileDir = normalizeText(raw.LOG_FILE_DIR)
  const logFileMaxBytes = parseOptionalIntEnv('LOG_FILE_MAX_BYTES', raw.LOG_FILE_MAX_BYTES, { min: 1 })
  const logFileRetentionDays = parseOptionalIntEnv('LOG_FILE_RETENTION_DAYS', raw.LOG_FILE_RETENTION_DAYS, { min: 1 })
  const idempotencyTtlMs = parseOptionalIntEnv('IDEMPOTENCY_TTL_MS', raw.IDEMPOTENCY_TTL_MS, { min: 1 })

  return {
    apiPrefix,
    databaseUrl,
    dialect,
    idempotencyTtlMs,
    jwtSecret,
    logFileDir,
    logFileMaxBytes,
    logFileRetentionDays,
    logMask,
    nodeEnv,
    openapiUrl,
    port,
  }
}

const env: Readonly<ServerEnv> = Object.freeze(parseServerEnv(rawEnv))

export default env
