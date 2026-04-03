import { Elysia } from 'elysia'
import { z } from 'zod'
import type { RealtimeDomain } from '@/constants/realtimeDomains'
import { ALL_REALTIME_DOMAINS } from '@/constants/realtimeDomains'
import { responseDTO } from './formatResponse'

const encoder = new TextEncoder()
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

interface ClientConnection {
  controller: ReadableStreamDefaultController<Uint8Array>
  id: string
}

interface RouteLike {
  hooks?: {
    detail?: Record<string, unknown>
  }
  method?: unknown
  path?: unknown
}

interface PublishMetadata {
  method: string
  path: string
  traceId?: string
}

interface RealtimeEvent {
  domains: RealtimeDomain[]
  method: string
  path: string
  traceId?: string
  seq: number
  timestamp: number
}

export interface RealtimeDomainPluginOptions {
  domainMapPath?: string
  eventName?: string
  heartbeatIntervalMs?: number
  prefix?: string
  streamPath?: string
}

const domainMapPayloadSchema = z.object({
  map: z.record(z.string(), z.array(z.string())),
  version: z.number().int().min(1),
})
type DomainMapPayload = z.infer<typeof domainMapPayloadSchema>
type DomainMapResponse = {
  code: number
  data: DomainMapPayload
  message: string
}
const REALTIME_DOMAIN_SET = new Set<string>(ALL_REALTIME_DOMAINS)

function normalizeDomains(input: unknown): RealtimeDomain[] {
  if (!Array.isArray(input))
    return []

  const deduplicated = new Set<RealtimeDomain>()
  for (const item of input) {
    if (typeof item !== 'string')
      continue

    const value = item.trim()
    if (value.length === 0)
      continue

    if (!REALTIME_DOMAIN_SET.has(value))
      continue

    deduplicated.add(value as RealtimeDomain)
  }

  return [...deduplicated]
}

function createSSEFrame(eventName: string, payload: unknown, id?: number) {
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload)

  let frame = ''
  if (id !== undefined) {
    frame += `id: ${id}\n`
  }
  frame += `event: ${eventName}\n`

  for (const line of data.split('\n')) {
    frame += `data: ${line}\n`
  }

  frame += '\n'
  return encoder.encode(frame)
}

function createSSEComment(comment: string) {
  return encoder.encode(`: ${comment}\n\n`)
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

function resolveStatusCode(context: {
  responseValue: unknown
  set: {
    status?: number | string
  }
}, fallback: number) {
  const fromSet = toStatusCode(context.set.status, Number.NaN)
  if (Number.isFinite(fromSet)) {
    return fromSet
  }

  if (context.responseValue instanceof Response) {
    return context.responseValue.status
  }

  return fallback
}

function parseDomainsFromRoute(route: RouteLike) {
  return normalizeDomains(route.hooks?.detail?.domains)
}

function buildDomainMap(routes: RouteLike[]) {
  const map = new Map<string, Set<string>>()

  for (const route of routes) {
    if (route.method !== 'GET')
      continue

    if (typeof route.path !== 'string')
      continue

    const domains = parseDomainsFromRoute(route)
    if (domains.length === 0)
      continue

    for (const domain of domains) {
      const set = map.get(domain) ?? new Set<string>()
      set.add(route.path)
      map.set(domain, set)
    }
  }

  const output: Record<string, string[]> = {}
  for (const [domain, routesOfDomain] of map.entries()) {
    output[domain] = [...routesOfDomain]
  }

  return output
}

function extractRouteHistory(instance: unknown) {
  const router = (instance as {
    router?: {
      history?: RouteLike[]
    }
  }).router

  return Array.isArray(router?.history) ? router.history : []
}

export function createRealtimeDomainPlugin(options: RealtimeDomainPluginOptions = {}) {
  const prefix = options.prefix ?? '/realtime'
  const domainMapPath = options.domainMapPath ?? '/domain-map'
  const streamPath = options.streamPath ?? '/stream'
  const eventName = options.eventName ?? 'domains.invalidate'
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 20_000

  const clients = new Map<string, ClientConnection>()
  let domainMap: Record<string, string[]> = {}
  let seq = 0
  let version = 1

  function publishDomains(domains: RealtimeDomain[], metadata: PublishMetadata) {
    if (domains.length === 0 || clients.size === 0)
      return

    const event = {
      domains,
      method: metadata.method,
      path: metadata.path,
      ...(metadata.traceId ? { traceId: metadata.traceId } : {}),
      seq: ++seq,
      timestamp: Date.now(),
    } satisfies RealtimeEvent

    const frame = createSSEFrame(eventName, event, event.seq)

    for (const [id, client] of clients.entries()) {
      try {
        client.controller.enqueue(frame)
      }
      catch {
        clients.delete(id)
      }
    }
  }

  return new Elysia({
    name: 'realtime-domain-plugin',
  })
    .macro({
      domains: (domains: readonly RealtimeDomain[] = []) => {
        const normalized = normalizeDomains(domains)
        if (normalized.length === 0) {
          return {
            resolve() {
              return {
                realtimeDomains: [],
              }
            },
          }
        }

        return {
          detail: {
            domains: normalized,
          } as any,
          resolve() {
            return {
              realtimeDomains: normalized,
            }
          },
        }
      },
    })
    .group(prefix, app =>
      app
        .get(domainMapPath, (context) => {
          const format = (context as {
            format?: (data: DomainMapPayload) => DomainMapResponse
          }).format

          if (typeof format !== 'function') {
            throw new Error('realtime-domain-plugin requires formatResponse plugin')
          }

          return format({
            map: domainMap,
            version,
          })
        }, {
          detail: {
            tags: ['realtime'],
          },
          response: {
            200: responseDTO(domainMapPayloadSchema),
          },
        })
        .get(streamPath, ({ request }) => {
          const id = crypto.randomUUID()
          let heartbeatTimer: ReturnType<typeof setInterval> | undefined

          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              clients.set(id, {
                controller,
                id,
              })

              const readyEvent = {
                seq,
                timestamp: Date.now(),
                version,
              }
              controller.enqueue(createSSEFrame('ready', readyEvent))

              heartbeatTimer = setInterval(() => {
                try {
                  controller.enqueue(createSSEComment('ping'))
                }
                catch {
                  clients.delete(id)
                  if (heartbeatTimer) {
                    clearInterval(heartbeatTimer)
                  }
                }
              }, heartbeatIntervalMs)

              request.signal.addEventListener('abort', () => {
                clients.delete(id)
                if (heartbeatTimer) {
                  clearInterval(heartbeatTimer)
                }
                controller.close()
              })
            },
            cancel() {
              clients.delete(id)
              if (heartbeatTimer) {
                clearInterval(heartbeatTimer)
              }
            },
          })

          return new Response(stream, {
            headers: {
              'cache-control': 'no-cache',
              connection: 'keep-alive',
              'content-type': 'text/event-stream; charset=utf-8',
              'x-accel-buffering': 'no',
            },
          })
        }, {
          detail: {
            tags: ['realtime'],
          },
        }),
    )
    .onAfterHandle((context) => {
      const method = context.request.method.toUpperCase()
      if (!WRITE_METHODS.has(method))
        return

      const domains = normalizeDomains((context as {
        realtimeDomains?: unknown
      }).realtimeDomains)

      if (domains.length === 0)
        return

      const status = resolveStatusCode(context, 200)
      if (status < 200 || status >= 300)
        return

      publishDomains(domains, {
        method,
        path: context.route,
        traceId: typeof (context as {
          traceId?: unknown
        }).traceId === 'string'
          ? (context as {
              traceId?: string
            }).traceId
          : undefined,
      })
    })
    .onStart((instance) => {
      domainMap = buildDomainMap(extractRouteHistory(instance))
    })
    .as('scoped')
}

export default createRealtimeDomainPlugin
