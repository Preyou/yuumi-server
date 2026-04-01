export interface ResponseCodeDefinition {
  httpStatus: number
  message: string
}

export type ResponseCodeMap = Record<number, ResponseCodeDefinition>

type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
type StatusByPrefix<Prefix extends string> = `${Prefix}${Digit}${Digit}` extends `${infer Value extends number}`
  ? Value
  : never
type ScopedResponseCodeMap<Code extends number> = Partial<Record<Code, ResponseCodeDefinition>>

export type SuccessResponseCode = StatusByPrefix<'2'>
export type BusinessErrorResponseCode = StatusByPrefix<'4'>
export type SystemErrorResponseCode = StatusByPrefix<'5'>

function defineSuccessCodes<Map extends ScopedResponseCodeMap<SuccessResponseCode>>(map: Map) {
  return map
}

function defineBusinessErrorCodes<Map extends ScopedResponseCodeMap<BusinessErrorResponseCode>>(map: Map) {
  return map
}

function defineSystemErrorCodes<Map extends ScopedResponseCodeMap<SystemErrorResponseCode>>(map: Map) {
  return map
}

export const RESPONSE_CODE_SCOPE_RULES = {
  businessError: '4xx',
  success: '2xx',
  systemError: '5xx',
} as const

export const SUCCESS_RESPONSE_CODE_MAP = defineSuccessCodes({
  200: {
    httpStatus: 200,
    message: 'success',
  },
  201: {
    httpStatus: 201,
    message: 'created',
  },
} as const)

export const BUSINESS_ERROR_RESPONSE_CODE_MAP = defineBusinessErrorCodes({
  400: {
    httpStatus: 400,
    message: 'bad request',
  },
  401: {
    httpStatus: 401,
    message: 'unauthorized',
  },
  403: {
    httpStatus: 403,
    message: 'forbidden',
  },
  404: {
    httpStatus: 404,
    message: 'not found',
  },
  409: {
    httpStatus: 409,
    message: 'conflict',
  },
  422: {
    httpStatus: 422,
    message: 'unprocessable entity',
  },
} as const)

export const SYSTEM_ERROR_RESPONSE_CODE_MAP = defineSystemErrorCodes({
  500: {
    httpStatus: 500,
    message: 'internal server error',
  },
} as const)

export const RESPONSE_CODE_MAP = {
  ...SUCCESS_RESPONSE_CODE_MAP,
  ...BUSINESS_ERROR_RESPONSE_CODE_MAP,
  ...SYSTEM_ERROR_RESPONSE_CODE_MAP,
} as const satisfies ResponseCodeMap

export type RegisteredResponseCode = Extract<keyof typeof RESPONSE_CODE_MAP, number>

export const DEFAULT_SUCCESS_CODE: RegisteredResponseCode = 200
export const DEFAULT_ERROR_CODE: RegisteredResponseCode = 500
