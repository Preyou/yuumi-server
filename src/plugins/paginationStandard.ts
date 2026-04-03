import { Elysia } from 'elysia'
import { z } from 'zod'
import { ResponseCodeError, responseDTO } from './formatResponse'

type QueryRecord = Record<string, unknown>

export interface PaginationProtocolConfig {
  defaultPageSize: number
  firstPage: number
  maxPageSize: number
  minPage: number
  minPageSize: number
  query: {
    page: string
    pageSize: string
  }
  response: {
    list: string
    page: string
    pageSize: string
    total: string
  }
}

export interface PaginationRouteOptions extends Partial<PaginationProtocolConfig> {}

export interface PaginationState {
  limit: number
  offset: number
  page: number
  pageSize: number
}

type PaginationResponseKeys = PaginationProtocolConfig['response']

export const DEFAULT_PAGINATION_PROTOCOL: PaginationProtocolConfig = {
  defaultPageSize: 10,
  firstPage: 1,
  maxPageSize: 100,
  minPage: 1,
  minPageSize: 1,
  query: {
    page: 'page',
    pageSize: 'pageSize',
  },
  response: {
    list: 'list',
    page: 'page',
    pageSize: 'pageSize',
    total: 'total',
  },
}

function normalizeResponseKeys(keys?: Partial<PaginationResponseKeys>): PaginationResponseKeys {
  return {
    ...DEFAULT_PAGINATION_PROTOCOL.response,
    ...(keys ?? {}),
  }
}

function normalizeConfig(base: PaginationProtocolConfig, override?: PaginationRouteOptions): PaginationProtocolConfig {
  if (!override)
    return base

  return {
    ...base,
    ...override,
    query: {
      ...base.query,
      ...(override.query ?? {}),
    },
    response: {
      ...base.response,
      ...(override.response ?? {}),
    },
  }
}

function pickQueryValue(query: QueryRecord, key: string): unknown {
  return query[key]
}

function toInteger(value: unknown): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw === undefined || raw === null || raw === '')
    return undefined

  const parsed = Number.parseInt(String(raw), 10)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function assertPaginationNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number | undefined,
  fieldName: string,
) {
  const result = value ?? fallback

  if (!Number.isInteger(result) || result < min || (max !== undefined && result > max)) {
    throw new ResponseCodeError(400, `Invalid pagination field "${fieldName}"`)
  }

  return result
}

function buildPagePayload<Item>(
  list: Item[],
  total: number,
  pagination: PaginationState,
  protocol: PaginationProtocolConfig,
) {
  return {
    [protocol.response.list]: list,
    [protocol.response.page]: pagination.page,
    [protocol.response.pageSize]: pagination.pageSize,
    [protocol.response.total]: total,
  } as Record<string, unknown>
}

export function createPaginationStandardPlugin(config: PaginationRouteOptions = {}) {
  const protocol = normalizeConfig(DEFAULT_PAGINATION_PROTOCOL, config)

  return new Elysia({
    name: 'pagination-standard-plugin',
  })
    .decorate('paginationProtocol', protocol)
    .macro({
      usePagination: (routeConfig: boolean | PaginationRouteOptions = true) => {
        const currentProtocol = normalizeConfig(
          protocol,
          routeConfig === true || routeConfig === false ? undefined : routeConfig,
        )

        return {
          query: z.record(z.string(), z.unknown()),
          resolve({ query }) {
            try {
              const pageRaw = toInteger(pickQueryValue(query, currentProtocol.query.page))
              const pageSizeRaw = toInteger(pickQueryValue(query, currentProtocol.query.pageSize))

              const page = assertPaginationNumber(
                pageRaw,
                currentProtocol.firstPage,
                currentProtocol.minPage,
                undefined,
                currentProtocol.query.page,
              )
              const pageSize = assertPaginationNumber(
                pageSizeRaw,
                currentProtocol.defaultPageSize,
                currentProtocol.minPageSize,
                currentProtocol.maxPageSize,
                currentProtocol.query.pageSize,
              )
              const offset = Math.max(0, page - currentProtocol.firstPage) * pageSize

              const pagination = {
                limit: pageSize,
                offset,
                page,
                pageSize,
              } satisfies PaginationState

              return {
                buildPageData<Item>(list: Item[], total: number) {
                  return buildPagePayload(list, total, pagination, currentProtocol)
                },
                pagination,
              }
            }
            catch (error) {
              if (error instanceof ResponseCodeError) {
                throw error
              }

              throw new ResponseCodeError(400, 'Invalid pagination query')
            }
          },
        }
      },
    })
    .as('scoped')
}

export function pageData<TItemSchema extends z.ZodTypeAny>(
  itemSchema: TItemSchema,
  keys: Partial<PaginationResponseKeys> = {},
) {
  const responseKeys = normalizeResponseKeys(keys)
  const shape: z.ZodRawShape = {
    [responseKeys.list]: z.array(itemSchema),
    [responseKeys.page]: z.number().int().min(1),
    [responseKeys.pageSize]: z.number().int().min(1),
    [responseKeys.total]: z.number().int().min(0),
  }

  return z.object(shape)
}

export function pageDTO<TItemSchema extends z.ZodTypeAny>(
  itemSchema: TItemSchema,
  keys: Partial<PaginationResponseKeys> = {},
) {
  return responseDTO(pageData(itemSchema, keys))
}

export function page200<TItemSchema extends z.ZodTypeAny>(
  itemSchema: TItemSchema,
  keys: Partial<PaginationResponseKeys> = {},
) {
  return z.object({
    code: z.literal(200),
    data: pageData(itemSchema, keys),
    message: z.string(),
  })
}

export function pageResponse<TItemSchema extends z.ZodTypeAny>(
  itemSchema: TItemSchema,
  keys: Partial<PaginationResponseKeys> = {},
) {
  return {
    200: page200(itemSchema, keys),
  } as const
}

export default createPaginationStandardPlugin
