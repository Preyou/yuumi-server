import {
  appendFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from 'node:fs'
import path from 'node:path'
import { Elysia } from 'elysia'
import env from '@/env'

const TRACE_ID_STATE = Symbol.for('yuumi.trace-id')
const REQUEST_LOG_STATE = Symbol.for('yuumi.request-log')

const TRACE_ID_REGEX = /^[0-9a-f]{32}$/i
const TRACEPARENT_HEADER = 'traceparent'
const ZERO_TRACE_ID = '00000000000000000000000000000000'

export const LogBits = {
  // 0 is reserved as an explicit silent sentinel.
  SILENT: 0,
  ERROR: 1 << 6,
  ERROR_REQUEST: 1 << 11,
  ERROR_RESPONSE: 1 << 12,
  MANUAL: 1 << 9,
  REQUEST: 1 << 0,
  REQUEST_BODY: 1 << 1,
  REQUEST_HEADERS: 1 << 2,
  RESPONSE: 1 << 3,
  RESPONSE_BODY: 1 << 4,
  RESPONSE_HEADERS: 1 << 5,
  TIMING: 1 << 7,
  TRACE_STEP: 1 << 8,
  WRITE_FILE: 1 << 10,
} as const

export type LogBitMask = number
export type UseLoggerOption = LogBitMask | boolean

const KNOWN_LOG_MASK = (
  LogBits.ERROR
  | LogBits.ERROR_REQUEST
  | LogBits.ERROR_RESPONSE
  | LogBits.MANUAL
  | LogBits.REQUEST
  | LogBits.REQUEST_BODY
  | LogBits.REQUEST_HEADERS
  | LogBits.RESPONSE
  | LogBits.RESPONSE_BODY
  | LogBits.RESPONSE_HEADERS
  | LogBits.TIMING
  | LogBits.TRACE_STEP
  | LogBits.WRITE_FILE
)

export const LOG_BITS_PROTOCOL = {
  // Frozen allocation map: bits 0-12 are assigned, bits 13-30 reserved for future use.
  reservedFromBit: 13,
  reservedToBit: 30,
  version: 1,
} as const

const MASK_INFO = (
  LogBits.REQUEST
  | LogBits.REQUEST_BODY
  | LogBits.RESPONSE
  | LogBits.RESPONSE_BODY
  | LogBits.ERROR
  | LogBits.TIMING
  | LogBits.MANUAL
)

const MASK_TRACE = (
  LogBits.REQUEST
  | LogBits.REQUEST_BODY
  | LogBits.REQUEST_HEADERS
  | LogBits.RESPONSE
  | LogBits.RESPONSE_BODY
  | LogBits.RESPONSE_HEADERS
  | LogBits.ERROR
  | LogBits.TIMING
  | LogBits.TRACE_STEP
  | LogBits.MANUAL
)

const MASK_ERROR_CONTEXT = (
  LogBits.ERROR
  | LogBits.ERROR_REQUEST
  | LogBits.ERROR_RESPONSE
  | LogBits.TIMING
  | LogBits.MANUAL
)

export const LogMasks = {
  DEV_DEFAULT: MASK_INFO,
  ERROR_CONTEXT: MASK_ERROR_CONTEXT,
  FILE_ERROR_CONTEXT: MASK_ERROR_CONTEXT | LogBits.WRITE_FILE,
  FILE_INFO: MASK_INFO | LogBits.WRITE_FILE,
  FILE_TRACE: MASK_TRACE | LogBits.WRITE_FILE,
  INFO: MASK_INFO,
  MANUAL_ONLY: LogBits.MANUAL,
  PROD_DEFAULT: MASK_ERROR_CONTEXT | LogBits.WRITE_FILE,
  SILENT: LogBits.SILENT,
  TRACE: MASK_TRACE,
} as const

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
const DEFAULT_TRACE_ID_HEADER = 'x-trace-id'
const DEFAULT_MESSAGE_LIMIT = 2000
const DEFAULT_ERROR_CONTEXT_LIMIT = 1200
const DEFAULT_ERROR_MESSAGE_LIMIT = 800
const DEFAULT_ERROR_STACK_LIMIT = 4000
const DEFAULT_LOG_FILE_MAX_BYTES = 100 * 1024
const DAY_MS = 24 * 60 * 60 * 1000
const LOG_FILE_NAME_REGEX = /^(\d{4})-(\d{2})-(\d{2})(?:\.(\d+))?\.log$/

type LogChannel = 'error' | 'info' | 'log' | 'trace'
type FileLogWriter = (line: string) => void

interface RequestState {
  mask: number
  startedAt: number
  traceId: string
}

interface RequestContextLike {
  body?: unknown
  params?: unknown
  path: string
  query?: unknown
  request: Request
  responseValue?: unknown
  set: {
    headers?: Record<string, unknown>
    status?: number | string
  }
}

export interface LoggerPluginOptions {
  logsDir?: string
  logsMaxBytes?: number
  logsRetentionDays?: number
  mask?: LogBitMask
  traceIdHeader?: string
  redactKeys?: readonly string[]
  redactPlaceholder?: string
}

export type LogFunction = (data?: unknown) => void

export function bits(...values: number[]) {
  return values.reduce((mask, value) => mask | value, 0)
}

const appEnv = env.nodeEnv
const isDevelopment = appEnv === 'development'
const envLogMask = env.logMask

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
  if (!input || typeof input !== 'object') {
    return false
  }

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

  if (!isPlainObject(value)) {
    return value
  }

  if (seen.has(value)) {
    return '[Circular]'
  }

  seen.add(value)

  const output: Record<string, unknown> = {}
  for (const [key, innerValue] of Object.entries(value)) {
    output[key] = keys.has(key.toLowerCase())
      ? placeholder
      : redactUnknown(innerValue, keys, placeholder, seen)
  }

  return output
}

function pad(value: number, size = 2) {
  return value.toString().padStart(size, '0')
}

function formatTimestamp(date = new Date()) {
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hour = pad(date.getHours())
  const minute = pad(date.getMinutes())
  const second = pad(date.getSeconds())
  const millisecond = pad(date.getMilliseconds(), 3)

  const offsetMinutes = -date.getTimezoneOffset()
  const offsetSign = offsetMinutes >= 0 ? '+' : '-'
  const offsetHours = pad(Math.trunc(Math.abs(offsetMinutes) / 60))
  const offsetRemainder = pad(Math.abs(offsetMinutes) % 60)

  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${millisecond}${offsetSign}${offsetHours}:${offsetRemainder}`
}

function formatDateForFile(date = new Date()) {
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  return `${year}-${month}-${day}`
}

function toStatusCode(status: unknown, fallback: number) {
  if (typeof status === 'number') {
    return status
  }

  if (typeof status === 'string') {
    const parsed = Number.parseInt(status, 10)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

function resolveStatusCode(context: RequestContextLike, fallback: number) {
  const fromSet = toStatusCode(context.set.status, Number.NaN)
  if (Number.isFinite(fromSet)) {
    return fromSet
  }

  if (context.responseValue instanceof Response) {
    return context.responseValue.status
  }

  return fallback
}

function normalizeTraceId(input: unknown): string | undefined {
  if (typeof input !== 'string') {
    return undefined
  }

  const normalized = input.trim().toLowerCase()
  if (!TRACE_ID_REGEX.test(normalized)) {
    return undefined
  }

  if (normalized === ZERO_TRACE_ID) {
    return undefined
  }

  return normalized
}

function parseTraceParent(headerValue: string | null): string | undefined {
  if (!headerValue) {
    return undefined
  }

  const first = headerValue
    .split(',')
    .map(item => item.trim())
    .find(Boolean)

  if (!first) {
    return undefined
  }

  const segments = first.split('-')
  if (segments.length < 4) {
    return undefined
  }

  return normalizeTraceId(segments[1])
}

function createTraceId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  let traceId = ''

  for (const byte of bytes) {
    traceId += byte.toString(16).padStart(2, '0')
  }

  return traceId
}

function cacheTraceId(context: unknown, traceId: string) {
  const target = context as Record<PropertyKey, unknown>
  target[TRACE_ID_STATE] = traceId
}

function resolveTraceId(
  context: {
    request: Request
  },
  traceIdHeader: string,
) {
  const target = context as Record<PropertyKey, unknown>
  const existing = normalizeTraceId(target[TRACE_ID_STATE])
  if (existing) {
    return existing
  }

  const traceId = (
    parseTraceParent(context.request.headers.get(TRACEPARENT_HEADER))
    ?? normalizeTraceId(context.request.headers.get(traceIdHeader))
    ?? createTraceId()
  )

  cacheTraceId(context, traceId)
  return traceId
}

function setTraceIdHeader(
  context: {
    set: {
      headers?: Record<string, unknown>
    }
  },
  traceIdHeader: string,
  traceId: string,
) {
  context.set.headers = {
    ...(context.set.headers ?? {}),
    [traceIdHeader]: traceId,
  }
}

function setRequestState(context: unknown, state: RequestState) {
  const target = context as Record<PropertyKey, unknown>
  target[REQUEST_LOG_STATE] = state
}

function getRequestState(context: unknown) {
  const target = context as Record<PropertyKey, unknown>
  return target[REQUEST_LOG_STATE] as RequestState | undefined
}

function syncTraceId(context: RequestContextLike, state: RequestState, traceIdHeader: string) {
  setTraceIdHeader(context, traceIdHeader, state.traceId)
}

function hasBit(mask: number, bit: number) {
  return (mask & bit) !== 0
}

function normalizePayload(payload: unknown, maxLength = DEFAULT_MESSAGE_LIMIT) {
  if (payload === undefined) {
    return ''
  }

  if (typeof payload === 'string') {
    return payload.length > maxLength ? `${payload.slice(0, maxLength)}...` : payload
  }

  let serialized: string
  try {
    serialized = JSON.stringify(payload)
  }
  catch {
    serialized = String(payload)
  }
  if (serialized.length <= maxLength) {
    return serialized
  }

  return `${serialized.slice(0, maxLength)}...`
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text
  }

  const omitted = text.length - maxLength
  return `${text.slice(0, maxLength)}...[TRUNCATED:${omitted}]`
}

function truncateUnknown(value: unknown, maxLength: number): unknown {
  if (value === undefined || value === null) {
    return value
  }

  if (typeof value === 'string') {
    return truncateText(value, maxLength)
  }

  let serialized: string
  try {
    serialized = JSON.stringify(value)
  }
  catch {
    serialized = String(value)
  }

  if (serialized.length <= maxLength) {
    return value
  }

  return truncateText(serialized, maxLength)
}

function isTextualContentType(contentType: string) {
  const normalized = contentType.toLowerCase()
  return normalized.startsWith('text/')
    || normalized.includes('json')
    || normalized.includes('xml')
    || normalized.includes('javascript')
    || normalized.includes('x-www-form-urlencoded')
}

function normalizeLogValue(
  value: unknown,
  redactKeys: Set<string>,
  redactPlaceholder: string,
  maxLength: number,
) {
  if (value instanceof Response) {
    const contentType = value.headers.get('content-type')
    return {
      body: contentType && isTextualContentType(contentType)
        ? '[StreamResponse]'
        : '[BinaryResponse]',
      contentType: contentType ?? null,
      status: value.status,
      type: 'Response',
    }
  }

  if (
    value instanceof ReadableStream
    || value instanceof ArrayBuffer
    || ArrayBuffer.isView(value)
    || value instanceof Blob
  ) {
    return '[BinaryOrStreamData]'
  }

  return truncateUnknown(
    redactUnknown(value, redactKeys, redactPlaceholder),
    maxLength,
  )
}

function toErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') {
    return undefined
  }

  const code = (error as {
    code?: unknown
  }).code
  return typeof code === 'string' ? code : undefined
}

function parseLogDateParts(fileName: string) {
  const match = LOG_FILE_NAME_REGEX.exec(fileName)
  if (!match) {
    return undefined
  }

  const year = Number.parseInt(match[1], 10)
  const month = Number.parseInt(match[2], 10)
  const day = Number.parseInt(match[3], 10)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return undefined
  }

  const stamp = new Date(year, month - 1, day).setHours(0, 0, 0, 0)
  if (!Number.isFinite(stamp)) {
    return undefined
  }

  return {
    fileName,
    stamp,
  }
}

function writeLine(
  channel: LogChannel,
  context: RequestContextLike,
  state: RequestState,
  payload?: unknown,
  fileWriter?: FileLogWriter,
) {
  const prefix = `[${formatTimestamp()}] [${channel}] [trace:${state.traceId}] ${context.request.method} ${context.path}`
  const suffix = normalizePayload(payload)
  const content = suffix.length > 0 ? `${prefix} - ${suffix}` : prefix
  if (fileWriter && hasBit(state.mask, LogBits.WRITE_FILE)) {
    fileWriter(content)
  }

  switch (channel) {
    case 'error':
      console.error(content)
      return
    case 'trace':
      console.debug(content)
      return
    case 'info':
      console.info(content)
      return
    default:
      console.log(content)
  }
}

interface FileLogPolicy {
  logsDir?: string
  logsMaxBytes?: number
  logsRetentionDays?: number
}

function normalizePositiveInt(input: number | undefined) {
  if (typeof input !== 'number' || !Number.isFinite(input)) {
    return undefined
  }

  if (input <= 0) {
    return undefined
  }

  return Math.trunc(input)
}

function resolveSegmentedLogFilePath(
  resolvedDir: string,
  dateKey: string,
  nextLineBytes: number,
  maxBytes: number,
) {
  for (let segment = 0; ; segment += 1) {
    const fileName = segment === 0
      ? `${dateKey}.log`
      : `${dateKey}.${segment}.log`
    const filePath = path.join(resolvedDir, fileName)

    try {
      const stats = statSync(filePath)
      if (!stats.isFile()) {
        continue
      }

      if (stats.size + nextLineBytes <= maxBytes) {
        return filePath
      }
    }
    catch (error) {
      if (toErrorCode(error) === 'ENOENT') {
        return filePath
      }

      return filePath
    }
  }
}

function cleanupExpiredLogFiles(
  resolvedDir: string,
  retentionDays: number,
  currentDateKey: string,
) {
  const currentDate = parseLogDateParts(`${currentDateKey}.log`)
  if (!currentDate) {
    return
  }

  const threshold = currentDate.stamp - (retentionDays - 1) * DAY_MS
  const files = readdirSync(resolvedDir)

  for (const fileName of files) {
    const parsed = parseLogDateParts(fileName)
    if (!parsed || parsed.stamp >= threshold) {
      continue
    }

    unlinkSync(path.join(resolvedDir, parsed.fileName))
  }
}

function createFileLogWriter(policy: FileLogPolicy): FileLogWriter | undefined {
  const maxBytes = normalizePositiveInt(policy.logsMaxBytes) ?? DEFAULT_LOG_FILE_MAX_BYTES
  const retentionDays = normalizePositiveInt(policy.logsRetentionDays)

  if (!policy.logsDir) {
    let warned = false

    return () => {
      if (warned) {
        return
      }

      warned = true
      console.warn('[logger] LogBits.WRITE_FILE is enabled but logsDir is not configured; file logging is disabled.')
    }
  }

  const resolvedDir = path.resolve(policy.logsDir)
  let dirReady = false
  let warnedCreateDir = false
  let warnedWrite = false
  let warnedCleanup = false
  let cleanupDateKey: string | undefined

  return (line: string) => {
    if (!dirReady) {
      try {
        mkdirSync(resolvedDir, { recursive: true })
        dirReady = true
      }
      catch (error) {
        if (!warnedCreateDir) {
          warnedCreateDir = true
          console.error(`[logger] failed to create log directory: ${resolvedDir}`, error)
        }
        return
      }
    }

    const dateKey = formatDateForFile()

    if (retentionDays && cleanupDateKey !== dateKey) {
      cleanupDateKey = dateKey

      try {
        cleanupExpiredLogFiles(resolvedDir, retentionDays, dateKey)
      }
      catch (error) {
        if (!warnedCleanup) {
          warnedCleanup = true
          console.error(`[logger] failed to cleanup expired logs in: ${resolvedDir}`, error)
        }
      }
    }

    const contentWithEol = `${line}\n`
    const nextLineBytes = Buffer.byteLength(contentWithEol, 'utf8')
    const filePath = resolveSegmentedLogFilePath(resolvedDir, dateKey, nextLineBytes, maxBytes)

    try {
      appendFileSync(filePath, contentWithEol, 'utf8')
    }
    catch (error) {
      const code = toErrorCode(error)
      if (code === 'ENOSPC' || code === 'EDQUOT') {
        console.error(`[logger] disk is full for file logging, exiting process: ${resolvedDir}`, error)
        process.exit(1)
      }

      if (!warnedWrite) {
        warnedWrite = true
        console.error(`[logger] failed to write file log: ${filePath}`, error)
      }
    }
  }
}

function normalizeMask(mask: number) {
  if (!Number.isFinite(mask)) {
    return LogBits.SILENT
  }

  if (mask < 0) {
    return LogBits.SILENT
  }

  return Math.trunc(mask) >>> 0
}

function sanitizeMask(mask: number) {
  const normalized = normalizeMask(mask)
  return normalized & KNOWN_LOG_MASK
}

function resolveMask(
  mask: number | undefined,
  fallbackMask: number,
) {
  if (typeof mask === 'number') {
    return sanitizeMask(mask)
  }

  return sanitizeMask(fallbackMask)
}

function resolveRouteMask(
  routeOptions: UseLoggerOption,
  baseMask: number,
) {
  if (routeOptions === false || routeOptions === LogBits.SILENT) {
    return LogBits.SILENT
  }

  if (routeOptions === true) {
    return baseMask
  }

  return sanitizeMask(routeOptions)
}

function pickRequestPayload(context: RequestContextLike, state: RequestState, redactKeys: Set<string>, redactPlaceholder: string) {
  const payload: Record<string, unknown> = {}

  if (hasBit(state.mask, LogBits.REQUEST)) {
    payload.params = redactUnknown(context.params ?? null, redactKeys, redactPlaceholder)
    payload.query = redactUnknown(context.query ?? null, redactKeys, redactPlaceholder)
  }

  if (hasBit(state.mask, LogBits.REQUEST_BODY)) {
    payload.body = redactUnknown(context.body ?? null, redactKeys, redactPlaceholder)
  }

  if (hasBit(state.mask, LogBits.REQUEST_HEADERS)) {
    const headers = Object.fromEntries(context.request.headers.entries())
    payload.headers = redactUnknown(headers, redactKeys, redactPlaceholder)
  }

  return payload
}

function pickResponsePayload(
  context: RequestContextLike,
  state: RequestState,
  redactKeys: Set<string>,
  redactPlaceholder: string,
) {
  const payload: Record<string, unknown> = {
    status: resolveStatusCode(context, 200),
  }

  if (hasBit(state.mask, LogBits.TIMING)) {
    payload.durationMs = Date.now() - state.startedAt
  }

  if (hasBit(state.mask, LogBits.RESPONSE_BODY)) {
    payload.response = normalizeLogValue(
      context.responseValue ?? null,
      redactKeys,
      redactPlaceholder,
      DEFAULT_MESSAGE_LIMIT,
    )
  }

  if (hasBit(state.mask, LogBits.RESPONSE_HEADERS)) {
    payload.responseHeaders = redactUnknown(context.set.headers ?? null, redactKeys, redactPlaceholder)
  }

  return payload
}

function pickErrorPayload(
  context: RequestContextLike & {
    code: unknown
    error: unknown
  },
  state: RequestState,
  redactKeys: Set<string>,
  redactPlaceholder: string,
) {
  const payload: Record<string, unknown> = {
    code: context.code,
    status: toStatusCode(context.set.status, 500),
  }

  if (hasBit(state.mask, LogBits.TIMING)) {
    payload.durationMs = Date.now() - state.startedAt
  }

  if (hasBit(state.mask, LogBits.ERROR_REQUEST)) {
    payload.params = normalizeLogValue(
      context.params ?? null,
      redactKeys,
      redactPlaceholder,
      DEFAULT_ERROR_CONTEXT_LIMIT,
    )
    payload.query = normalizeLogValue(
      context.query ?? null,
      redactKeys,
      redactPlaceholder,
      DEFAULT_ERROR_CONTEXT_LIMIT,
    )
    payload.body = normalizeLogValue(
      context.body ?? null,
      redactKeys,
      redactPlaceholder,
      DEFAULT_ERROR_CONTEXT_LIMIT,
    )
  }

  if (hasBit(state.mask, LogBits.ERROR_RESPONSE)) {
    payload.response = normalizeLogValue(
      context.responseValue ?? null,
      redactKeys,
      redactPlaceholder,
      DEFAULT_ERROR_CONTEXT_LIMIT,
    )
  }

  if (context.error instanceof Error) {
    payload.error = truncateText(context.error.message, DEFAULT_ERROR_MESSAGE_LIMIT)
    if (context.error.stack) {
      payload.stack = truncateText(context.error.stack, DEFAULT_ERROR_STACK_LIMIT)
    }
  }
  else {
    payload.error = truncateText(String(context.error), DEFAULT_ERROR_MESSAGE_LIMIT)
  }

  return payload
}

function createLogFunction(
  context: RequestContextLike,
  redactKeys: Set<string>,
  redactPlaceholder: string,
  fileWriter?: FileLogWriter,
): LogFunction {
  return (data?: unknown) => {
    const state = getRequestState(context)
    if (!state || !hasBit(state.mask, LogBits.MANUAL)) {
      return
    }

    writeLine('log', context, state, redactUnknown(data, redactKeys, redactPlaceholder), fileWriter)
  }
}

export function createLoggerPlugin(options: LoggerPluginOptions = {}) {
  const defaultMask = isDevelopment ? LogMasks.DEV_DEFAULT : LogMasks.PROD_DEFAULT
  const traceIdHeader = options.traceIdHeader ?? DEFAULT_TRACE_ID_HEADER
  const redactKeys = normalizeRedactKeys(options.redactKeys)
  const redactPlaceholder = options.redactPlaceholder ?? DEFAULT_REDACT_PLACEHOLDER
  const fileWriter = createFileLogWriter({
    logsDir: options.logsDir,
    logsMaxBytes: options.logsMaxBytes,
    logsRetentionDays: options.logsRetentionDays,
  })
  const baseMask = resolveMask(options.mask ?? envLogMask, defaultMask)

  return new Elysia({
    name: 'logger-plugin',
  })
    .onRequest((context) => {
      const traceId = resolveTraceId(context, traceIdHeader)
      setRequestState(context, {
        mask: baseMask,
        startedAt: Date.now(),
        traceId,
      })
      setTraceIdHeader(context, traceIdHeader, traceId)
    })
    .derive({ as: 'global' }, context => ({
      log: createLogFunction(context, redactKeys, redactPlaceholder, fileWriter),
      traceId: resolveTraceId(context, traceIdHeader),
    }))
    .macro({
      useLogger: (routeOptions: UseLoggerOption = true) => ({
        transform(context) {
          const state = getRequestState(context)
          if (!state) {
            return
          }

          state.mask = resolveRouteMask(routeOptions, baseMask)
        },
        resolve(context) {
          const state = getRequestState(context)
          if (!state) {
            return
          }

          state.mask = resolveRouteMask(routeOptions, baseMask)
        },
      }),
    })
    .onBeforeHandle((context) => {
      const state = getRequestState(context)
      if (!state) {
        return
      }

      syncTraceId(context, state, traceIdHeader)

      if (hasBit(state.mask, LogBits.TRACE_STEP)) {
        writeLine('trace', context, state, 'handler:start', fileWriter)
      }

      if (
        hasBit(state.mask, LogBits.REQUEST)
        || hasBit(state.mask, LogBits.REQUEST_BODY)
        || hasBit(state.mask, LogBits.REQUEST_HEADERS)
      ) {
        writeLine(
          'info',
          context,
          state,
          pickRequestPayload(context, state, redactKeys, redactPlaceholder),
          fileWriter,
        )
      }
    })
    .onAfterHandle((context) => {
      const state = getRequestState(context)
      if (!state) {
        return
      }

      syncTraceId(context, state, traceIdHeader)

      const shouldLogResponse = (
        hasBit(state.mask, LogBits.RESPONSE)
        || hasBit(state.mask, LogBits.RESPONSE_BODY)
        || hasBit(state.mask, LogBits.RESPONSE_HEADERS)
      )

      if (shouldLogResponse) {
        writeLine(
          'info',
          context,
          state,
          pickResponsePayload(context, state, redactKeys, redactPlaceholder),
          fileWriter,
        )
      }

      if (hasBit(state.mask, LogBits.TRACE_STEP)) {
        writeLine('trace', context, state, 'handler:end', fileWriter)
      }
    })
    .onError((context) => {
      const state = getRequestState(context)
      if (!state) {
        return
      }

      syncTraceId(context, state, traceIdHeader)

      if (hasBit(state.mask, LogBits.ERROR)) {
        writeLine(
          'error',
          context,
          state,
          pickErrorPayload(context, state, redactKeys, redactPlaceholder),
          fileWriter,
        )
      }

      if (hasBit(state.mask, LogBits.TRACE_STEP)) {
        writeLine('trace', context, state, 'handler:error', fileWriter)
      }
    })
    .as('scoped')
}

export default createLoggerPlugin
