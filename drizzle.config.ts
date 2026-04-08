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

const dialect = (import.meta.env.DIALECT?.trim().toLowerCase() as DrizzleDialect | undefined) ?? 'postgresql'

export default defineConfig({
  dbCredentials: {
    url: import.meta.env.DATABASE_URL, // 只用环境变量
    // 或分开写：host, port, user: process.env.DB_USER, password: process.env.DB_PASSWORD 等
  },
  dialect,
  out: DIALECT_TO_MIGRATION_OUT_DIR[dialect],
  schema: `./src/db/${DIALECT_TO_SCHEMA_DIR[dialect]}/schemas/*.ts`,
})
