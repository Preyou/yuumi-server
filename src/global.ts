import { openapi } from '@elysiajs/openapi'
import { Elysia } from 'elysia'
import { z } from 'zod'
import { mysql } from './db'
import env from './env'
import { createAuthorizePlugin } from './plugins/authorize'
import { createDatabasePlugin } from './plugins/database'
import { createFormatResponsePlugin } from './plugins/formatResponse'
import { createIdempotencyPlugin } from './plugins/idempotency'
import jwt from './plugins/jwt'
import { createListQueryWhitelistPlugin } from './plugins/listQueryWhitelist'
import { createLoggerPlugin } from './plugins/logger'
import { createPaginationStandardPlugin } from './plugins/paginationStandard'
import { createRealtimeDomainPlugin } from './plugins/realtimeDomain'

const idempotencyPluginOptions = env.idempotencyTtlMs === undefined
  ? undefined
  : {
      options: {
        cacheTTLMS: env.idempotencyTtlMs,
      },
    }

export const globalPlugin = new Elysia({
  name: 'global-governance-plugin',
})
  .use(createDatabasePlugin(mysql))
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
    path: env.openapiUrl,
  }))
  .use(createLoggerPlugin({
    logsDir: env.logFileDir,
    logsMaxBytes: env.logFileMaxBytes,
    logsRetentionDays: env.logFileRetentionDays,
  }))
  .use(createFormatResponsePlugin())
  .use(createIdempotencyPlugin(idempotencyPluginOptions))
  .use(createPaginationStandardPlugin())
  .use(createListQueryWhitelistPlugin())
  .use(jwt)
  .use(createAuthorizePlugin())
  .use(createRealtimeDomainPlugin())
  .as('scoped')
