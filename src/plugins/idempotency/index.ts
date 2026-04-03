import {
  Idempotency,
  IdempotencyError,
  IdempotencyErrorCodes,
  type IdempotencyOptions,
  type IdempotencyParams,
} from '@node-idempotency/core'
import { MemoryStorageAdapter } from '@node-idempotency/storage-adapter-memory'
import { Elysia } from 'elysia'
import { z } from 'zod'
import {
  RESPONSE_CODE_MAP,
  type RegisteredResponseCode,
  type ResponseCodeMap,
} from '@/constants/responseCodeMap'
import { ResponseCodeError, responseDTO } from '../formatResponse'

const IDEMPOTENCY_STATE = Symbol.for('yuumi.idempotency.state')
const RESPONSE_CODE_INDEX: ResponseCodeMap = { ...RESPONSE_CODE_MAP }

const DEFAULT_ENABLED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

export const DEFAULT_IDEMPOTENCY_PLUGIN_OPTIONS: Required<Pick<IdempotencyPluginOptions, 'replayHeaderName' | 'statusHeaderName'>> & {
  options: IdempotencyOptions
} = {
  options: {
    cacheTTLMS: 24 * 60 * 60 * 1000,
    enforceIdempotency: true,
    inProgressStrategy: {
      maxWaitMs: 10_000,
      pollingIntervalMs: 200,
      wait: true,
    },
  },
  replayHeaderName: 'x-idempotency-replayed',
  statusHeaderName: 'x-idempotency-status',
}

type StorageAdapterLike = ConstructorParameters<typeof Idempotency>[0]

interface InternalRequestState {
  finalized: boolean
  request: IdempotencyParams
}

interface HeaderWritableContext {
  set: {
    headers?: Record<string, unknown>
    status?: number | string
  }
}

export interface IdempotencyPluginOptions {
  enabledMethods?: readonly string[]
  options?: IdempotencyOptions
  replayHeaderName?: string
  statusHeaderName?: string
  storage?: StorageAdapterLike
}

export interface IdempotencyRouteOptions {
  enabled?: boolean
  options?: IdempotencyOptions
  scope?: string
}

function isObject(input: unknown): input is Record<PropertyKey, unknown> {
  return !!input && typeof input === 'object'
}

function toStatusCode(rawStatus: unknown, fallback: number) {
  if (typeof rawStatus === 'number')
    return rawStatus

  if (typeof rawStatus === 'string') {
    const parsed = Number.parseInt(rawStatus, 10)
    if (Number.isFinite(parsed))
      return parsed
  }

  return fallback
}

function inferHttpStatusFromBody(response: unknown, fallbackStatus: number) {
  if (isObject(response) && typeof response.code === 'number') {
    const matched = RESPONSE_CODE_INDEX[response.code]
    if (matched)
      return matched.httpStatus
  }

  return fallbackStatus
}

function setHeader(context: HeaderWritableContext, key: string, value: string) {
  const currentHeaders = isObject(context.set.headers)
    ? context.set.headers
    : {}

  context.set.headers = {
    ...currentHeaders,
    [key]: value,
  }
}

function setRequestState(context: unknown, state: InternalRequestState) {
  if (!isObject(context))
    return

  const target = context as Record<PropertyKey, unknown>
  target[IDEMPOTENCY_STATE] = state
}

function getRequestState(context: unknown) {
  if (!isObject(context))
    return

  const target = context as Record<PropertyKey, unknown>
  return target[IDEMPOTENCY_STATE] as InternalRequestState | undefined
}

function clearRequestState(context: unknown) {
  if (!isObject(context))
    return

  const target = context as Record<PropertyKey, unknown>
  delete target[IDEMPOTENCY_STATE]
}

function toHeaders(input: unknown): Record<string, unknown> {
  if (!isObject(input))
    return {}

  return input
}

function toBody(input: unknown): Record<string, unknown> | undefined {
  if (input === undefined)
    return undefined

  if (Array.isArray(input))
    return { value: input }

  if (isObject(input))
    return input

  return { value: input }
}

function normalizeRouteOptions(routeOptions: boolean | IdempotencyRouteOptions): IdempotencyRouteOptions {
  if (routeOptions === true || routeOptions === false) {
    return {
      enabled: routeOptions,
    }
  }

  return routeOptions
}

function toIdempotencyRequest(
  context: {
    body: unknown
    headers: unknown
    path: string
    request: Request
  },
  routeOptions: IdempotencyRouteOptions,
): IdempotencyParams {
  return {
    body: toBody(context.body),
    headers: toHeaders(context.headers),
    method: context.request.method.toUpperCase(),
    options: routeOptions.options,
    path: routeOptions.scope ?? context.path,
  }
}

function resolveIdempotencyErrorCode(error: IdempotencyError): RegisteredResponseCode {
  const codeMap: Record<IdempotencyErrorCodes, RegisteredResponseCode> = {
    [IdempotencyErrorCodes.IDEMPOTENCY_FINGERPRINT_MISSMATCH]: 409,
    [IdempotencyErrorCodes.IDEMPOTENCY_KEY_LEN_EXEEDED]: 400,
    [IdempotencyErrorCodes.IDEMPOTENCY_KEY_MISSING]: 400,
    [IdempotencyErrorCodes.REQUEST_IN_PROGRESS]: 409,
  }

  return codeMap[error.code] ?? 409
}

function toError(error: unknown) {
  if (error instanceof IdempotencyError) {
    return new ResponseCodeError(
      resolveIdempotencyErrorCode(error),
      error.message,
    )
  }

  return error instanceof Error
    ? error
    : new Error('idempotency request failed')
}

function stripDebugFields(response: unknown) {
  if (!isObject(response))
    return response

  const source = response as Record<string, unknown>
  if (!('requestId' in source) && !('traceId' in source))
    return response

  const output = { ...source }
  delete output.requestId
  delete output.traceId
  return output
}

function createFinalizedResponse(
  response: unknown,
  statusCode: number,
) {
  return {
    additional: {
      status: statusCode,
    },
    body: stripDebugFields(response),
  }
}

export function createIdempotencyPlugin(options: IdempotencyPluginOptions = {}) {
  const enabledMethods = new Set(
    (options.enabledMethods ?? DEFAULT_ENABLED_METHODS).map(method => method.toUpperCase()),
  )
  const idempotency = new Idempotency(
    options.storage ?? new MemoryStorageAdapter(),
    {
      ...DEFAULT_IDEMPOTENCY_PLUGIN_OPTIONS.options,
      ...(options.options ?? {}),
      inProgressStrategy: {
        ...DEFAULT_IDEMPOTENCY_PLUGIN_OPTIONS.options.inProgressStrategy,
        ...(options.options?.inProgressStrategy ?? {}),
      },
    },
  )
  const replayHeaderName = options.replayHeaderName ?? DEFAULT_IDEMPOTENCY_PLUGIN_OPTIONS.replayHeaderName
  const statusHeaderName = options.statusHeaderName ?? DEFAULT_IDEMPOTENCY_PLUGIN_OPTIONS.statusHeaderName

  return new Elysia({
    name: 'idempotency-plugin',
  })
    .macro({
      useIdempotency: (routeOptions: boolean | IdempotencyRouteOptions = false) => {
        const normalizedRouteOptions = normalizeRouteOptions(routeOptions)
        const routeEnabled = normalizedRouteOptions.enabled ?? false

        const hooks = {
          response: routeEnabled
            ? {
                400: responseDTO(z.null()),
                409: responseDTO(z.null()),
              }
            : undefined,
          async beforeHandle(context: any) {
            if (!routeEnabled)
              return

            const method = context.request.method.toUpperCase()
            if (!enabledMethods.has(method))
              return

            const request = toIdempotencyRequest(context, normalizedRouteOptions)

            try {
              const replayedResponse = await idempotency.onRequest(request)
              if (replayedResponse) {
                const replayStatusCode = toStatusCode(replayedResponse.additional?.status, 200)
                setHeader(context, replayHeaderName, '1')
                setHeader(context, statusHeaderName, 'replayed')
                return context.status(replayStatusCode, replayedResponse.body)
              }

              setHeader(context, statusHeaderName, 'acquired')
              setRequestState(context, {
                finalized: false,
                request,
              })
            }
            catch (error) {
              setHeader(context, statusHeaderName, 'rejected')
              throw toError(error)
            }
          },
          async afterHandle(context: any) {
            const state = getRequestState(context)
            if (!state || state.finalized)
              return

            state.finalized = true
            try {
              const statusCode = inferHttpStatusFromBody(
                context.responseValue,
                toStatusCode(context.set.status, 200),
              )
              await idempotency.onResponse(
                state.request,
                createFinalizedResponse(context.responseValue, statusCode),
              )
              setHeader(context, statusHeaderName, 'finalized')
            }
            catch {
              setHeader(context, statusHeaderName, 'finalize-failed')
            }
            finally {
              clearRequestState(context)
            }
          },
          async error(context: any) {
            const state = getRequestState(context)
            if (!state || state.finalized)
              return

            state.finalized = true
            try {
              const statusCode = inferHttpStatusFromBody(
                context.error,
                toStatusCode(context.set.status, 500),
              )
              const message = context.error instanceof Error ? context.error.message : context.code
              await idempotency.onResponse(
                state.request,
                createFinalizedResponse({
                  code: statusCode,
                  data: null,
                  message,
                }, statusCode),
              )
              setHeader(context, statusHeaderName, 'finalized-error')
            }
            catch {
              setHeader(context, statusHeaderName, 'finalize-failed')
            }
            finally {
              clearRequestState(context)
            }
          },
        }

        return hooks
      },
    })
    .as('scoped')
}

export default createIdempotencyPlugin
