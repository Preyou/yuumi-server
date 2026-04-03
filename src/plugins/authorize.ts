import type { RegisteredResponseCode } from '@/constants/responseCodeMap'
import { Elysia } from 'elysia'
import { z } from 'zod'
import { ResponseCodeError, responseDTO } from './formatResponse'

type MaybePromise<T> = T | Promise<T>

type Identity = number | string
type AuthzResponseCode = Extract<RegisteredResponseCode, 401 | 403>

type Resolver<TContext, TValue> = TValue | ((context: TContext) => MaybePromise<TValue>)

interface AuthorizeDecisionLike {
  allowed: boolean
  code?: AuthzResponseCode
  reason?: string
}

export interface AuthorizeInput {
  action: string
  actorId: Identity
  context?: unknown
  method?: string
  path?: string
  resource: string
  resourceId?: Identity
}

export type AuthorizePolicyResult = AuthorizeDecisionLike | boolean | null | undefined
export type AuthorizePolicy = (input: AuthorizeInput) => MaybePromise<AuthorizePolicyResult>

export interface AuthorizeRouteOptions<TContext = unknown> {
  action: Resolver<TContext, string>
  actorId?: Resolver<TContext, Identity | undefined>
  context?: Resolver<TContext, unknown>
  resource: Resolver<TContext, string>
  resourceId?: Resolver<TContext, Identity | undefined>
}

export interface AuthorizePluginOptions {
  exposeDenyReason?: boolean
  onDeny?: (payload: {
    decision: DeniedAuthorizeDecision
    input: AuthorizeInput
  }) => MaybePromise<void>
  policy?: AuthorizePolicy | readonly AuthorizePolicy[]
}

export type AuthorizeDecision = {
  allowed: true
  reason?: string
} | {
  allowed: false
  code: AuthzResponseCode
  reason?: string
}

export type DeniedAuthorizeDecision = Extract<AuthorizeDecision, { allowed: false }>

type BuildAuthorizeInputResult = {
  code: AuthzResponseCode
  decision: 'reject'
  reason?: string
} | {
  decision: 'proceed'
  input: AuthorizeInput
}

interface AuthorizeContextLike {
  auth?: {
    id?: unknown
  }
  authorize: (input: AuthorizeInput) => Promise<AuthorizeDecision>
  path: string
  request: Request
}

export const AUTHZ_RESPONSE_CODE = {
  forbidden: 403,
  unauthorized: 401,
} as const

const DEFAULT_DENY_DECISION: DeniedAuthorizeDecision = {
  allowed: false,
  code: AUTHZ_RESPONSE_CODE.forbidden,
}
const AUTHORIZE_ERROR_RESPONSE = {
  401: responseDTO(z.null()),
  403: responseDTO(z.null()),
} as const

export function defineAuthorizePolicy(policy: AuthorizePolicy) {
  return policy
}

function isResolverFunction<TContext, TValue>(
  input: Resolver<TContext, TValue>,
): input is (context: TContext) => MaybePromise<TValue> {
  return typeof input === 'function'
}

function isIdentity(input: unknown): input is Identity {
  if (typeof input === 'number') {
    return Number.isFinite(input)
  }

  if (typeof input !== 'string') {
    return false
  }

  return input.trim().length > 0
}

function toIdentity(input: unknown): Identity | undefined {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : undefined
  }

  if (typeof input !== 'string') {
    return undefined
  }

  const normalized = input.trim()
  return normalized.length > 0 ? normalized : undefined
}

function toRequiredText(input: unknown, field: string) {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new Error(`Invalid authorize option "${field}"`)
  }

  return input.trim()
}

async function resolveRouteOption<TContext, TValue>(
  option: Resolver<TContext, TValue> | undefined,
  context: TContext,
) {
  if (option === undefined) {
    return undefined
  }

  return isResolverFunction(option)
    ? await option(context)
    : option
}

function normalizePolicyResult(result: AuthorizePolicyResult): AuthorizeDecision | undefined {
  if (result === undefined || result === null) {
    return undefined
  }

  if (typeof result === 'boolean') {
    return result
      ? { allowed: true }
      : DEFAULT_DENY_DECISION
  }

  const code = result.code === AUTHZ_RESPONSE_CODE.unauthorized
    ? AUTHZ_RESPONSE_CODE.unauthorized
    : AUTHZ_RESPONSE_CODE.forbidden
  const reason = typeof result.reason === 'string' && result.reason.trim().length > 0
    ? result.reason.trim()
    : undefined

  if (result.allowed) {
    return {
      allowed: true,
      reason,
    }
  }

  return {
    allowed: false,
    code,
    reason,
  }
}

async function evaluatePolicies(
  policies: readonly AuthorizePolicy[],
  input: AuthorizeInput,
) {
  let allowDecision: Extract<AuthorizeDecision, { allowed: true }> | undefined

  for (const policy of policies) {
    const normalizedDecision = normalizePolicyResult(await policy(input))
    if (!normalizedDecision) {
      continue
    }

    if (!normalizedDecision.allowed) {
      return normalizedDecision
    }

    allowDecision ??= normalizedDecision
  }

  return allowDecision ?? DEFAULT_DENY_DECISION
}

function toPolicies(input: AuthorizePluginOptions['policy']) {
  if (!input) {
    return [] as const
  }

  if (Array.isArray(input)) {
    return input.filter(policy => typeof policy === 'function')
  }

  return [input]
}

function throwAuthzError(
  code: AuthzResponseCode,
  reason: string | undefined,
  exposeDenyReason: boolean,
): never {
  throw new ResponseCodeError(code, exposeDenyReason ? reason ?? '' : '')
}

async function callOnDeny(
  onDeny: AuthorizePluginOptions['onDeny'],
  payload: {
    decision: DeniedAuthorizeDecision
    input: AuthorizeInput
  },
) {
  if (!onDeny) {
    return
  }

  try {
    await onDeny(payload)
  }
  catch (error) {
    console.error('[authorize] onDeny hook failed:', error)
  }
}

function normalizeRouteOptions(
  input: boolean | AuthorizeRouteOptions,
): AuthorizeRouteOptions | false {
  if (input === false) {
    return false
  }

  if (input === true) {
    throw new Error('Invalid useAuthorize option: true is not supported, provide route options instead.')
  }

  return input
}

async function buildAuthorizeInput(
  context: AuthorizeContextLike,
  options: AuthorizeRouteOptions,
): Promise<BuildAuthorizeInputResult> {
  const action = toRequiredText(
    await resolveRouteOption(options.action, context),
    'action',
  )
  const resource = toRequiredText(
    await resolveRouteOption(options.resource, context),
    'resource',
  )
  const resolvedActorId = await resolveRouteOption(options.actorId, context)
  const actorId = toIdentity(resolvedActorId) ?? toIdentity(context.auth?.id)

  if (!isIdentity(actorId)) {
    return {
      code: AUTHZ_RESPONSE_CODE.unauthorized,
      decision: 'reject' as const,
      reason: 'missing actor identity',
    }
  }

  const resolvedResourceId = await resolveRouteOption(options.resourceId, context)
  const resourceId = toIdentity(resolvedResourceId)

  return {
    decision: 'proceed' as const,
    input: {
      action,
      actorId,
      context: await resolveRouteOption(options.context, context),
      method: context.request.method.toUpperCase(),
      path: context.path,
      resource,
      resourceId,
    } satisfies AuthorizeInput,
  }
}

export function createAuthorizePlugin(options: AuthorizePluginOptions = {}) {
  const exposeDenyReason = !!options.exposeDenyReason
  const policies = toPolicies(options.policy)

  return new Elysia({
    name: 'authorize-plugin',
  })
    .decorate('authorize', async (input: AuthorizeInput) => {
      const normalizedInput = {
        ...input,
        action: toRequiredText(input.action, 'action'),
        resource: toRequiredText(input.resource, 'resource'),
      } satisfies AuthorizeInput

      if (!isIdentity(normalizedInput.actorId)) {
        return {
          allowed: false,
          code: AUTHZ_RESPONSE_CODE.unauthorized,
          reason: 'missing actor identity',
        } satisfies AuthorizeDecision
      }

      return await evaluatePolicies(policies, normalizedInput)
    })
    .macro({
      useAuthorize: (routeOptions: boolean | AuthorizeRouteOptions = false) => {
        const normalizedRouteOptions = normalizeRouteOptions(routeOptions)

        if (normalizedRouteOptions === false) {
          return
        }

        return {
          response: AUTHORIZE_ERROR_RESPONSE,
          async beforeHandle(context) {
            const typedContext = context as unknown as AuthorizeContextLike
            const buildResult = await buildAuthorizeInput(typedContext, normalizedRouteOptions)
            if (buildResult.decision === 'reject') {
              throwAuthzError(
                buildResult.code,
                buildResult.reason,
                exposeDenyReason,
              )
            }

            const decision = await typedContext.authorize(buildResult.input)
            if (decision.allowed) {
              return
            }

            await callOnDeny(options.onDeny, {
              decision,
              input: buildResult.input,
            })

            throwAuthzError(
              decision.code,
              decision.reason,
              exposeDenyReason,
            )
          },
        }
      },
    })
    .as('scoped')
}

export default createAuthorizePlugin
