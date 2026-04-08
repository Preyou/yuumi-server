declare module 'bun' {
  interface Env {
    API_PREFIX: string
    NODE_ENV: 'development' | 'production' | 'test'
    DATABASE_URL: string
    DIALECT: 'postgresql' | 'mysql' | 'sqlite'
    JWT_SECRET: string
    LOG_FILE_DIR: string
    LOG_FILE_MAX_BYTES?: string
    LOG_FILE_RETENTION_DAYS?: string
    LOG_MASK?: string
    OPENAPI_URL: string
    PORT: string
    IDEMPOTENCY_TTL_MS: string
  }
}
