import { createPinoLogger } from '@bogeychan/elysia-logger'
import { Elysia } from 'elysia'
import { serverConfig } from '@/config/env'

const REQUEST_ID_STATE = Symbol.for('yuumi.request-id')
const REQUEST_LOG_STATE = Symbol.for('yuumi.request-log')

const LOG_LEVELS = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'silent',
] as const

export type LogLevel = (typeof LOG_LEVELS)[number]

export interface RequestAutoLevelConfig {
  clientError: LogLevel
  serverError: LogLevel
  success: LogLevel
}

export interface LoggerRequestOptions {
  auto?: boolean
  autoLevel?: Partial<RequestAutoLevelConfig>
  defaultLevel?: LogLevel
  enabled?: boolean
  includeParams?: boolean
  includeQuery?: boolean
  message?: string
}

export interface LoggerPluginOptions {
  enabled?: boolean
  exposeRequestId?: boolean
  level?: LogLevel
  redactKeys?: readonly string[]
  redactPlaceholder?: string
  request?: LoggerRequestOptions
  requestIdHeader?: string
}

export interface UseLoggerRouteOptions {
  auto?: boolean
  enabled?: boolean
  level?: LogLevel
  message?: string
}

interface RequestLogConfig {
  auto: boolean
  autoLevel: RequestAutoLevelConfig
  defaultLevel: LogLevel
  enabled: boolean
  includeParams: boolean
  includeQuery: boolean
  message: string
}

interface RequestLogState {
  auto: boolean
  defaultLevel: LogLevel
  enabled: boolean
  message: string
  requestId: string
  startedAt: number
}

interface RequestContextLike {
  params?: unknown
  path: string
  query?: unknown
  request: Request
  set: {
    headers?: Record<string, unknown>
    status?: number | string
  }
}

export interface LoggerFunction {
  (data?: unknown): void
  debug: (data?: unknown) => void
  error: (data?: unknown) => void
  fatal: (data?: unknown) => void
  info: (data?: unknown) => void
  trace: (data?: unknown) => void
  warn: (data?: unknown) => void
}

type Logger = ReturnType<typeof createPinoLogger>

const DEFAULT_REQUEST_OPTIONS: RequestLogConfig = {
  auto: true,
  autoLevel: {
    clientError: 'warn',
    serverError: 'error',
    success: 'info',
  },
  defaultLevel: 'info',
  enabled: true,
  includeParams: true,
  includeQuery: true,
  message: 'request log',
}
const DEFAULT_REDACT_KEYS = [
  'accessToken',
  'authorization',
  'cookie',
  'jwt',
  'password',
  'refreshToken',
  'secret',
  'set-cookie',
  'token',
] as const
const DEFAULT_REDACT_PLACEHOLDER = '[REDACTED]'

function isLogLevel(input: unknown): input is LogLevel {
  return typeof input === 'string'
    && (LOG_LEVELS as readonly string[]).includes(input)
}

function normalizeLevel(input: unknown, fallback: LogLevel): LogLevel {
  return isLogLevel(input) ? input : fallback
}

function mergeRequestConfig(override?: LoggerRequestOptions): RequestLogConfig {
  if (!override) { return DEFAULT_REQUEST_OPTIONS }

  return {
    ...DEFAULT_REQUEST_OPTIONS,
    ...override,
    autoLevel: {
      ...DEFAULT_REQUEST_OPTIONS.autoLevel,
      ...(override.autoLevel ?? {}),
    },
    defaultLevel: normalizeLevel(override.defaultLevel, DEFAULT_REQUEST_OPTIONS.defaultLevel),
  }
}

function normalizeRedactKeys(keys?: readonly string[]) {
  const normalized = new Set<string>(
    DEFAULT_REDACT_KEYS.map(key => key.toLowerCase()),
  )

  for (const key of keys ?? []) {
    normalized.add(key.toLowerCase())
  }

  return normalized
}

function isPlainObject(input: unknown): input is Record<string, unknown> {
  if (!input || typeof input !== 'object')
    return false

  return Object.prototype.toString.call(input) === '[object Object]'
}

function redactUnknown(
  value: unknown,
  keys: Set<string>,
  placeholder: string,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (Array.isArray(value)) {
    return value.map(item => redactUnknown(item, keys, placeholder, seen))
  }

  if (!isPlainObject(value))
    return value

  if (seen.has(value))
    return '[Circular]'

  seen.add(value)

  const output: Record<string, unknown> = {}
  for (const [key, innerValue] of Object.entries(value)) {
    output[key] = keys.has(key.toLowerCase())
      ? placeholder
      : redactUnknown(innerValue, keys, placeholder, seen)
  }

  return output
}

function createRequestState(config: RequestLogConfig, requestId: string): RequestLogState {
  return {
    auto: config.auto,
    defaultLevel: config.defaultLevel,
    enabled: config.enabled,
    message: config.message,
    requestId,
    startedAt: Date.now(),
  }
}

function toStatusCode(status: unknown, fallback: number) {
  if (typeof status === 'number') { return status }

  if (typeof status === 'string') {
    const parsed = Number.parseInt(status, 10)
    if (Number.isFinite(parsed)) { return parsed }
  }

  return fallback
}

function getStatusCode(context: {
  responseValue: unknown
  set: {
    status?: number | string
  }
}, fallback: number) {
  const fromSet = toStatusCode(context.set.status, Number.NaN)
  if (Number.isFinite(fromSet)) { return fromSet }

  if (context.responseValue instanceof Response) { return context.responseValue.status }

  return fallback
}
function chooseAutoLevel(status: number, config: RequestAutoLevelConfig): LogLevel {
  if (status >= 500) { return config.serverError }

  if (status >= 400) { return config.clientError }

  return config.success
}

function ensureRequestId(
  context: {
    request: Request
  },
  requestIdHeader: string,
) {
  const target = context as Record<PropertyKey, unknown>
  const existingRequestId = target[REQUEST_ID_STATE]
  const requestId = (
    typeof existingRequestId === 'string' && existingRequestId.length > 0
      ? existingRequestId
      : context.request.headers.get(requestIdHeader) ?? crypto.randomUUID()
  )

  target[REQUEST_ID_STATE] = requestId
  return requestId
}

function setRequestIdHeader(context: {
  set: {
    headers?: Record<string, unknown>
  }
}, requestIdHeader: string, requestId: string, exposeRequestId: boolean) {
  if (!exposeRequestId) { return }

  context.set.headers = {
    ...(context.set.headers ?? {}),
    [requestIdHeader]: requestId,
  }
}

function setRequestLogState(context: unknown, state: RequestLogState) {
  const target = context as Record<PropertyKey, unknown>
  target[REQUEST_LOG_STATE] = state
}

function getRequestLogState(context: unknown) {
  const target = context as Record<PropertyKey, unknown>
  return target[REQUEST_LOG_STATE] as RequestLogState | undefined
}

function applyRouteLogConfig(state: RequestLogState, routeOptions: boolean | UseLoggerRouteOptions) {
  if (routeOptions === false) {
    state.enabled = false
    return
  }

  if (routeOptions === true) { return }

  if (routeOptions.enabled !== undefined) { state.enabled = routeOptions.enabled }

  if (routeOptions.auto !== undefined) { state.auto = routeOptions.auto }

  if (routeOptions.level !== undefined) { state.defaultLevel = normalizeLevel(routeOptions.level, state.defaultLevel) }

  if (routeOptions.message !== undefined) { state.message = routeOptions.message }
}

function buildRequestMeta(
  context: RequestContextLike,
  state: RequestLogState,
  config: RequestLogConfig,
  redactKeys: Set<string>,
  redactPlaceholder: string,
) {
  return {
    method: context.request.method,
    ...(config.includeParams
      ? { params: redactUnknown(context.params ?? null, redactKeys, redactPlaceholder) }
      : {}),
    path: context.path,
    ...(config.includeQuery
      ? { query: redactUnknown(context.query ?? null, redactKeys, redactPlaceholder) }
      : {}),
    requestId: state.requestId,
  }
}

function writeLog(
  logger: Logger,
  level: LogLevel,
  context: RequestContextLike,
  state: RequestLogState,
  config: RequestLogConfig,
  redactKeys: Set<string>,
  redactPlaceholder: string,
  data?: unknown,
) {
  if (level === 'silent') { return }

  const method = logger[level] as (data: unknown, message?: string) => void
  const requestMeta = buildRequestMeta(
    context,
    state,
    config,
    redactKeys,
    redactPlaceholder,
  )

  if (data === undefined) {
    method(requestMeta, state.message)
    return
  }

  if (typeof data === 'string') {
    method(requestMeta, data)
    return
  }

  method({
    ...requestMeta,
    data: redactUnknown(data, redactKeys, redactPlaceholder),
  }, state.message)
}

function createLoggerFunction(
  context: RequestContextLike,
  logger: Logger,
  enabled: boolean,
  requestConfig: RequestLogConfig,
  redactKeys: Set<string>,
  redactPlaceholder: string,
): LoggerFunction {
  const writeByLevel = (level: LogLevel, data?: unknown) => {
    const state = getRequestLogState(context)
    if (!enabled || !state || !state.enabled) { return }

    writeLog(
      logger,
      level,
      context,
      state,
      requestConfig,
      redactKeys,
      redactPlaceholder,
      data,
    )
  }

  const invoke = ((data?: unknown) => {
    const state = getRequestLogState(context)
    const level = state?.defaultLevel ?? requestConfig.defaultLevel
    writeByLevel(level, data)
  }) as LoggerFunction

  invoke.trace = data => writeByLevel('trace', data)
  invoke.debug = data => writeByLevel('debug', data)
  invoke.info = data => writeByLevel('info', data)
  invoke.warn = data => writeByLevel('warn', data)
  invoke.error = data => writeByLevel('error', data)
  invoke.fatal = data => writeByLevel('fatal', data)

  return invoke
}

export function createLoggerPlugin(options: LoggerPluginOptions = {}) {
  const isDevelopment = serverConfig.isDevelopment
  const enabled = options.enabled ?? isDevelopment
  const exposeRequestId = options.exposeRequestId ?? isDevelopment
  const requestIdHeader = options.requestIdHeader ?? 'x-request-id'
  const requestConfig = mergeRequestConfig(options.request)
  const redactKeys = normalizeRedactKeys(options.redactKeys)
  const redactPlaceholder = options.redactPlaceholder ?? DEFAULT_REDACT_PLACEHOLDER
  const baseLevel = normalizeLevel(
    options.level ?? serverConfig.LOG_LEVEL,
    isDevelopment ? 'debug' : 'info',
  )
  const logger = createPinoLogger({
    level: baseLevel,
  })

  return new Elysia({
    name: 'logger-plugin',
  })
    .onRequest((context) => {
      const requestId = ensureRequestId(context, requestIdHeader)
      const state = createRequestState(requestConfig, requestId)
      setRequestLogState(context, state)
      setRequestIdHeader(context, requestIdHeader, requestId, exposeRequestId)
    })
    .derive({ as: 'global' }, context => ({
      logger: createLoggerFunction(
        context,
        logger,
        enabled,
        requestConfig,
        redactKeys,
        redactPlaceholder,
      ),
      requestId: ensureRequestId(context, requestIdHeader),
    }))
    .macro({
      useLogger: (routeOptions: boolean | UseLoggerRouteOptions = true) => ({
        resolve(context) {
          const state = getRequestLogState(context)
          if (!state) { return }

          applyRouteLogConfig(state, routeOptions)
        },
      }),
    })
    .onAfterHandle((context) => {
      const state = getRequestLogState(context)
      if (!state) { return }

      setRequestIdHeader(context, requestIdHeader, state.requestId, exposeRequestId)

      if (!enabled || !state.enabled || !state.auto) { return }

      const status = getStatusCode(context, 200)
      const autoLevel = chooseAutoLevel(status, requestConfig.autoLevel)
      writeLog(
        logger,
        autoLevel,
        context,
        state,
        requestConfig,
        redactKeys,
        redactPlaceholder,
        {
          durationMs: Date.now() - state.startedAt,
          status,
        },
      )
    })
    .onError((context) => {
      const state = getRequestLogState(context)
      if (!state) { return }

      setRequestIdHeader(context, requestIdHeader, state.requestId, exposeRequestId)

      if (!enabled || !state.enabled || !state.auto) { return }

      const status = toStatusCode(context.set.status, 500)
      const autoLevel = chooseAutoLevel(status, requestConfig.autoLevel)
      writeLog(
        logger,
        autoLevel,
        context,
        state,
        requestConfig,
        redactKeys,
        redactPlaceholder,
        {
          durationMs: Date.now() - state.startedAt,
          error: context.error instanceof Error ? context.error.message : context.code,
          status,
        },
      )
    })
    .as('scoped')
}

export default createLoggerPlugin
