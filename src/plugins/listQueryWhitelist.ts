import { Elysia } from 'elysia'
import { z } from 'zod'
import { ResponseCodeError } from './formatResponse'

type QueryRecord = Record<string, unknown>
type SortOrder = 'asc' | 'desc'

export interface ListQueryWhitelistConfig {
  pageKey: string
  pageSizeKey: string
  sortByKey: string
  sortOrderKey: string
}

export interface ListQueryWhitelistRouteOptions extends Partial<ListQueryWhitelistConfig> {
  allowFilterFields?: readonly string[]
  allowQueryKeys?: readonly string[]
  allowSortFields?: readonly string[]
  defaultSortOrder?: SortOrder
}

export interface ListQueryState {
  filters: Record<string, string | string[]>
  sortBy: string | null
  sortOrder: SortOrder | null
}

export const DEFAULT_LIST_QUERY_WHITELIST_CONFIG: ListQueryWhitelistConfig = {
  pageKey: 'page',
  pageSizeKey: 'pageSize',
  sortByKey: 'sortBy',
  sortOrderKey: 'sortOrder',
}

function mergeConfig(
  base: ListQueryWhitelistConfig,
  override?: Partial<ListQueryWhitelistConfig>,
): ListQueryWhitelistConfig {
  if (!override)
    return base

  return {
    ...base,
    ...override,
  }
}

function toQueryRecord(input: unknown): QueryRecord {
  return (input && typeof input === 'object')
    ? input as QueryRecord
    : {}
}

function readText(query: QueryRecord, key: string): string | undefined {
  const raw = query[key]
  const first = Array.isArray(raw) ? raw[0] : raw

  if (first === undefined || first === null)
    return undefined

  const text = String(first).trim()
  return text.length > 0 ? text : undefined
}

function readFilterValue(value: unknown): string | string[] | undefined {
  if (Array.isArray(value)) {
    const list = value
      .map(item => String(item).trim())
      .filter(Boolean)

    if (list.length === 0)
      return undefined

    return list
  }

  if (value === undefined || value === null)
    return undefined

  const text = String(value).trim()
  return text.length > 0 ? text : undefined
}

export function createListQueryWhitelistPlugin(config: Partial<ListQueryWhitelistConfig> = {}) {
  const baseConfig = mergeConfig(DEFAULT_LIST_QUERY_WHITELIST_CONFIG, config)

  return new Elysia({
    name: 'list-query-whitelist-plugin',
  })
    .decorate('listQueryWhitelistConfig', baseConfig)
    .macro({
      useListQueryWhitelist: (routeOptions: boolean | ListQueryWhitelistRouteOptions = true) => {
        const normalizedRouteOptions = routeOptions === true || routeOptions === false
          ? {}
          : routeOptions

        const currentConfig = mergeConfig(baseConfig, normalizedRouteOptions)

        return {
          query: z.record(z.string(), z.unknown()),
          resolve({ query }) {
            const queryRecord = toQueryRecord(query)
            const allowedSortFields = new Set(normalizedRouteOptions.allowSortFields ?? [])
            const allowedFilterFields = new Set(normalizedRouteOptions.allowFilterFields ?? [])
            const allowQueryKeys = new Set([
              ...(normalizedRouteOptions.allowQueryKeys ?? []),
              currentConfig.pageKey,
              currentConfig.pageSizeKey,
              currentConfig.sortByKey,
              currentConfig.sortOrderKey,
              ...allowedFilterFields,
            ])

            const unknownKeys = Object.keys(queryRecord).filter(key => !allowQueryKeys.has(key))
            if (unknownKeys.length > 0)
              throw new ResponseCodeError(400, `Unknown query keys: ${unknownKeys.join(', ')}`)

            const sortBy = readText(queryRecord, currentConfig.sortByKey)
            const sortOrderRaw = readText(queryRecord, currentConfig.sortOrderKey)?.toLowerCase()

            if (sortBy && !allowedSortFields.has(sortBy))
              throw new ResponseCodeError(400, `Invalid sortBy field: ${sortBy}`)

            if (!sortBy && sortOrderRaw)
              throw new ResponseCodeError(400, `sortOrder requires sortBy: ${sortOrderRaw}`)

            if (sortOrderRaw && sortOrderRaw !== 'asc' && sortOrderRaw !== 'desc')
              throw new ResponseCodeError(400, `Invalid sortOrder: ${sortOrderRaw}`)

            const sortOrder = (
              sortOrderRaw
              || (sortBy ? normalizedRouteOptions.defaultSortOrder : undefined)
              || null
            ) as SortOrder | null

            const filters: Record<string, string | string[]> = {}
            for (const field of allowedFilterFields) {
              const value = readFilterValue(queryRecord[field])
              if (value !== undefined)
                filters[field] = value
            }

            return {
              listQuery: {
                filters,
                sortBy: sortBy ?? null,
                sortOrder,
              } satisfies ListQueryState,
            }
          },
        }
      },
    })
    .as('scoped')
}

export default createListQueryWhitelistPlugin
