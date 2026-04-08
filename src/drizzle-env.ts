import type { DatabaseDialect } from './env'

type RawEnv = Record<string, string | undefined>
export interface DrizzleEnv {
  databaseUrl: string
  dialect: DatabaseDialect
}

// eslint-disable-next-line no-restricted-syntax
const rawEnv = import.meta.env as unknown as RawEnv

function normalizeText(input: string | undefined) {
  const normalized = input?.trim()
  return normalized ? normalized : undefined
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

const databaseUrl = normalizeText(rawEnv.DATABASE_URL)
if (!databaseUrl) {
  throw new Error('[env] Missing required env vars: DATABASE_URL')
}

const drizzleEnv: Readonly<DrizzleEnv> = Object.freeze({
  databaseUrl,
  dialect: parseDialect(normalizeText(rawEnv.DIALECT)),
})

export default drizzleEnv
