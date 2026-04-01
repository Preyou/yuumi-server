import { openapi } from '@elysiajs/openapi'
import { Elysia } from 'elysia'
import { z } from 'zod'
import { serverConfig } from '@/config/env'
import { createFormatResponsePlugin } from './formatResponse'
import { createIdempotencyPlugin } from './idempotency'
import jwt from './jwt'
import { createListQueryWhitelistPlugin } from './listQueryWhitelist'
import { createLoggerPlugin } from './logger'
import { createPaginationStandardPlugin } from './paginationStandard'

const idempotencyPluginOptions = serverConfig.IDEMPOTENCY_TTL_MS === undefined
  ? undefined
  : {
      options: {
        cacheTTLMS: serverConfig.IDEMPOTENCY_TTL_MS,
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
    path: serverConfig.OPENAPI_URL,
  }))
  .use(createLoggerPlugin({
    level: serverConfig.LOG_LEVEL,
  }))
  .use(createFormatResponsePlugin())
  .use(createIdempotencyPlugin(idempotencyPluginOptions))
  .use(createPaginationStandardPlugin())
  .use(createListQueryWhitelistPlugin())
  .use(jwt)
  .as('scoped')
