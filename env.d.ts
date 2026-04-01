declare module 'bun' {
  interface Env {
    APP_ENV: 'development' | 'production' | 'test'
    DATABASE_URL: string
    JWT_SECRET: string
    OPENAPI_URL: string
    OTEL_ENABLED: '0' | '1'
    PORT: string
    LOG_LEVEL?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent'
    IDEMPOTENCY_TTL_MS?: string
  }
}
