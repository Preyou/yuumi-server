import { drizzle } from 'drizzle-orm/bun-sqlite'
import drizzleEnv from '@/drizzle-env'
import * as tables from './schemas/tables'

function resolveSQLiteSource(url: string) {
  const normalized = url.trim()
  return normalized.startsWith('file:')
    ? normalized.slice(5)
    : normalized
}

export default drizzle({
  connection: {
    source: resolveSQLiteSource(drizzleEnv.databaseUrl),
  },
  schema: tables,
})
