import { defineConfig } from 'drizzle-kit'

const DIALECT_TO_SCHEMA_DIR = {
  mysql: 'mysql',
  postgresql: 'pg',
  sqlite: 'sqlite',
} as const

const DIALECT_TO_MIGRATION_OUT_DIR = {
  mysql: './drizzle/mysql',
  postgresql: './drizzle',
  sqlite: './drizzle/sqlite',
} as const

type DrizzleDialect = keyof typeof DIALECT_TO_SCHEMA_DIR

type RawEnv = Record<string, string | undefined>
const rawEnv = import.meta.env as unknown as RawEnv

function normalizeText(input: string | undefined) {
  const normalized = input?.trim()
  return normalized ? normalized : undefined
}

function parseDialect(input: string | undefined): DrizzleDialect {
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

  throw new Error(`[drizzle config] DIALECT must be mysql|postgresql|sqlite, got "${input}"`)
}

const databaseUrl = normalizeText(rawEnv.DATABASE_URL)
if (!databaseUrl) {
  throw new Error('[drizzle config] Missing required env var: DATABASE_URL')
}

const dialect: DrizzleDialect = parseDialect(normalizeText(rawEnv.DIALECT))

export default defineConfig({
  dbCredentials: {
    url: databaseUrl,
    // 或分开写：host, port, user: process.env.DB_USER, password: process.env.DB_PASSWORD 等
  },
  dialect,
  out: DIALECT_TO_MIGRATION_OUT_DIR[dialect],
  schema: `./src/db/${DIALECT_TO_SCHEMA_DIR[dialect]}/schemas/*.ts`,
})
