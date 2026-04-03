import type {
  RegisteredResponseCode,
  ResponseCodeDefinition,
  ResponseCodeMap,
} from '@/constants/responseCodeMap'
import { Elysia } from 'elysia'
import { z } from 'zod'
import {
  DEFAULT_ERROR_CODE,
  DEFAULT_SUCCESS_CODE,
  RESPONSE_CODE_MAP,
} from '@/constants/responseCodeMap'

export interface ResponseEnvelope<D = unknown> {
  code: RegisteredResponseCode
  data: D
  message: string
}

export interface FormatResponsePluginOptions {
  codeMap?: ResponseCodeMap
  defaultErrorCode?: RegisteredResponseCode
  defaultSuccessCode?: RegisteredResponseCode
}

const RESPONSE_CODE_ERROR_BRAND = Symbol.for('yuumi.response-code-error')

export class ResponseCodeError extends Error {
  code: RegisteredResponseCode
  readonly [RESPONSE_CODE_ERROR_BRAND] = true

  constructor(code: RegisteredResponseCode, message = '') {
    super(message)
    this.name = 'ResponseCodeError'
    this.code = code
  }
}

const responseFormat = z.object({
  code: z.number(),
  data: z.unknown(),
  message: z.string(),
})

function buildResponseSchemaByStatus(codeMap: ResponseCodeMap, fallbackHttpStatus: number) {
  const statusSet = new Set<number>([fallbackHttpStatus])

  for (const definition of Object.values(codeMap)) { statusSet.add(definition.httpStatus) }

  const schemaMap: Record<number, typeof responseFormat> = {}
  for (const status of statusSet) { schemaMap[status] = responseFormat }

  return schemaMap
}

function resolveCodeDefinition(
  codeMap: ResponseCodeMap,
  code: RegisteredResponseCode,
  defaultErrorCode: RegisteredResponseCode,
) {
  return codeMap[code]
    ?? codeMap[defaultErrorCode]
    ?? {
      httpStatus: 500,
      message: 'internal server error',
    } satisfies ResponseCodeDefinition
}

function withDefaultMessage(message: string, fallback: string) {
  return message.length > 0 ? message : fallback
}

function hasOwn(obj: object, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function isResponseCodeError(error: unknown): error is ResponseCodeError {
  if (error instanceof ResponseCodeError) {
    return true
  }

  if (!error || typeof error !== 'object') {
    return false
  }

  if (!hasOwn(error, RESPONSE_CODE_ERROR_BRAND)) {
    return false
  }

  return typeof (error as ResponseCodeError).code === 'number'
}

function resolveErrorCode(
  codeMap: ResponseCodeMap,
  error: unknown,
  fallback: RegisteredResponseCode,
) {
  if (!isResponseCodeError(error)) {
    return fallback
  }

  if (!codeMap[error.code]) {
    return fallback
  }

  return error.code
}

function resolveErrorMessage(error: unknown) {
  if (!error) {
    return ''
  }

  if (error instanceof Error) {
    return error.message
  }

  return ''
}

export function createFormatResponsePlugin(options: FormatResponsePluginOptions = {}) {
  const codeMap: ResponseCodeMap = {
    ...RESPONSE_CODE_MAP,
    ...(options.codeMap ?? {}),
  }
  const defaultSuccessCode = options.defaultSuccessCode ?? DEFAULT_SUCCESS_CODE
  const defaultErrorCode = options.defaultErrorCode ?? DEFAULT_ERROR_CODE
  const fallbackDefinition = resolveCodeDefinition(codeMap, defaultErrorCode, defaultErrorCode)

  return new Elysia({
    name: 'response-format',
  })
    .decorate('format', <D = unknown>(
      data: D,
      code: RegisteredResponseCode = defaultSuccessCode,
    ): ResponseEnvelope<D> => ({
      code,
      data,
      message: '',
    }))
    .guard({
      response: buildResponseSchemaByStatus(codeMap, fallbackDefinition.httpStatus),
      schema: 'standalone',
    })
    .onAfterHandle((context) => {
      if (context.responseValue instanceof Response)
        return

      const raw = context.responseValue as ResponseEnvelope<unknown>
      const definition = resolveCodeDefinition(codeMap, raw.code, defaultErrorCode)

      const formattedResponse = {
        code: raw.code,
        data: raw.data,
        message: withDefaultMessage(raw.message, definition.message),
      } satisfies ResponseEnvelope
      context.set.status = definition.httpStatus

      return formattedResponse
    })
    .onError((context) => {
      const code = resolveErrorCode(codeMap, context.error, defaultErrorCode)
      const definition = resolveCodeDefinition(codeMap, code, defaultErrorCode)

      const response = {
        code,
        data: null,
        message: withDefaultMessage(
          resolveErrorMessage(context.error),
          definition.message,
        ),
      } satisfies ResponseEnvelope

      return context.status(definition.httpStatus, response)
    })
    .as('scoped')
}

export function responseDTO<TSchema extends z.ZodTypeAny>(schema: TSchema) {
  return z.object({
    code: z.number(),
    data: schema,
    message: z.string(),
  })
}
