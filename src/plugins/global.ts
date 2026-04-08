import { openapi } from '@elysiajs/openapi'
import { Elysia } from 'elysia'
import { z } from 'zod'
import { createFormatResponsePlugin } from './formatResponse'
import { createIdempotencyPlugin } from './idempotency'
import { createAuthorizePlugin } from './authorize'
import jwt from './jwt'
import { createListQueryWhitelistPlugin } from './listQueryWhitelist'
import { createLoggerPlugin } from './logger'
import { createPaginationStandardPlugin } from './paginationStandard'
import { createRealtimeDomainPlugin } from './realtimeDomain'

const openapiUrl = import.meta.env.OPENAPI_URL
const logFileDir = import.meta.env.LOG_FILE_DIR?.trim() || undefined
const logFileMaxBytes = import.meta.env.LOG_FILE_MAX_BYTES
  ? Number.parseInt(import.meta.env.LOG_FILE_MAX_BYTES, 10)
  : undefined
const logFileRetentionDays = import.meta.env.LOG_FILE_RETENTION_DAYS
  ? Number.parseInt(import.meta.env.LOG_FILE_RETENTION_DAYS, 10)
  : undefined
const idempotencyTtlMs = import.meta.env.IDEMPOTENCY_TTL_MS
  ? Number.parseInt(import.meta.env.IDEMPOTENCY_TTL_MS, 10)
  : undefined

const idempotencyPluginOptions = idempotencyTtlMs === undefined
  ? undefined
  : {
      options: {
        cacheTTLMS: idempotencyTtlMs,
      },
    }

export const globalPlugin = new Elysia({
  name: 'global-governance-plugin',
})
  .use(openapi({
    documentation: {
      info: {
        title: '@yuumi/server API',
        version: '1.0.0',
      },
    },
    mapJsonSchema: {
      zod: (schema: z.ZodType) => z.toJSONSchema(schema),
    },
    path: openapiUrl,
  }))
  .use(createLoggerPlugin({
    logsDir: logFileDir,
    logsMaxBytes: logFileMaxBytes,
    logsRetentionDays: logFileRetentionDays,
  }))
  .use(createFormatResponsePlugin())
  .use(createIdempotencyPlugin(idempotencyPluginOptions))
  .use(createPaginationStandardPlugin())
  .use(createListQueryWhitelistPlugin())
  .use(jwt)
  .use(createAuthorizePlugin())
  .use(createRealtimeDomainPlugin())
  .as('scoped')
