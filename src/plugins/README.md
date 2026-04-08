# Plugins Guide

`src/plugins` 用于放置后端治理插件（响应规范、契约、分页、查询白名单、鉴权等）。

## Overview

- `formatResponse.ts`
  - 统一响应结构：`{ code, data, message }`
  - 统一错误处理：按状态码映射表生成 HTTP Status 与默认消息
  - 业务层统一返回 `format(data, code?)`
  - 提供 `responseDTO` 作为通用响应 schema 生成器
- `logger.ts`
  - 维护 `x-trace-id`
  - 注入 `log(data?)` 上下文函数
  - 导出 `LogBits`（正交位）与 `LogMasks`（常用组合）常量
  - 提供 `useLogger` 宏用于路由级日志覆盖
- `realtimeDomain.ts`
  - 提供 `SSE` 接口：`GET {API_PREFIX}/realtime/stream`
  - 提供映射接口：`GET {API_PREFIX}/realtime/domain-map`
  - 提供 `domains` 路由配置项：声明接口影响的数据域
  - `GET` 路由声明 `domains` 会进入 `domain-map`
  - 非 `GET` 路由声明 `domains`，成功调用后会推送 `SSE`
- `src/constants/responseCodeMap.ts`
  - 集中定义业务码到 HTTP Status 的映射关系（插件直接读取）
- `src/constants/realtimeDomains.ts`
  - 集中维护数据域常量，其他模块只能引用，不写字面量
- `paginationStandard.ts`
  - 提供 `usePagination` 宏，统一解析分页参数并注入分页上下文
- `listQueryWhitelist.ts`
  - 提供 `useListQueryWhitelist` 宏，约束列表查询字段、排序字段、过滤字段
- `idempotency/index.ts`
  - 基于 `@node-idempotency/core` 提供 `useIdempotency` 宏，约束写接口幂等
- `jwt.ts`
  - 提供 `useAuth` 宏，默认所有路由鉴权，公开接口需显式 `useAuth: false`
- `authorize.ts`
  - 提供 `useAuthorize` 宏（声明式鉴权）
  - 注入 `authorize(input)`（命令式鉴权）
  - 鉴权策略默认拒绝（deny-by-default）
- `global.ts`
  - 治理包装插件，组合 OpenAPI 契约、日志、响应格式、幂等、分页、查询白名单、认证与鉴权插件
  - 供每个路由插件通过 `.use(globalPlugin)` 复用
- `import.meta.env`
  - 各模块直接读取环境变量，并只做必要类型转换
- `src/utils/time.ts`
  - 统一时间戳工具与 schema（毫秒时间戳）

## Global Mount

在每个路由插件内部挂载治理包装插件：

```ts
import { Elysia } from 'elysia'
import { globalPlugin } from '@/plugins/global'

export const usersService = new Elysia({
  name: 'service.users',
})
  .use(globalPlugin)
  .group('/users', app => app)
```

推荐启动方式（`src/index.ts`）：

```ts
import { Elysia } from 'elysia'
import { authService } from '@/services/auth'
import { usersService } from '@/services/users'

const apiPrefix = import.meta.env.API_PREFIX ?? '/api'
const port = Number.parseInt(import.meta.env.PORT ?? '3000', 10)

export const app = new Elysia()
  .group(apiPrefix, app => app
    .use(authService)
    .use(usersService))

app.listen(port)
```

## Response Plugin

默认规则：

- 所有响应遵循 `{ code, data, message }`
- 业务层返回 `format(data, code?)`，`code` 省略时自动使用成功码
- `format` 的 `code` 类型会收窄为已在 `responseCodeMap` 注册的 code
- 响应码按号段约束：
  - `2xx` 成功码
  - `4xx` 业务错误码
  - `5xx` 系统错误码
- 错误处理由 `formatResponse` 插件统一收敛，不在业务层拼装错误消息
- 插件中的可预期业务错误应抛 `ResponseCodeError(code)`，由 `formatResponse` 统一映射业务码
- 未显式处理的未知错误抛 `Error`，由 `formatResponse` 统一包装为 500 响应
- 插件内 `guard` 使用 `schema: 'standalone'` 做全局约束
- `x-trace-id` 由 `logger` 插件维护（不进入响应体）
- 最终生成的 OpenAPI 文档必须包含完整可用契约；路由定义可简写但不能影响文档生成
- 响应码文档通过脚本自动生成：`bun run docs:response-codes`
- `ResponseCodeError` 快速手册见 `docs/response-code-error.md`

状态码映射表集中在：

- `src/constants/responseCodeMap.ts`

示例：

```ts
export const RESPONSE_CODE_MAP = {
  200: { httpStatus: 200, message: 'success' },
  400: { httpStatus: 400, message: 'bad request' },
  500: { httpStatus: 500, message: 'internal server error' },
}

export const RESPONSE_CODE_SCOPE_RULES = {
  success: '2xx',
  businessError: '4xx',
  systemError: '5xx',
}
```

常用 schema 工具：

```ts
import { responseDTO } from '@/plugins/formatResponse'
import { z } from 'zod'

const userSchema = z.object({ id: z.number(), name: z.string() })

const response = {
  200: responseDTO(userSchema),
  404: responseDTO(z.null()),
}

const response2 = {
  200: responseDTO(userSchema), // 通用版，code 为 number
}
```

业务层返回示例：

```ts
new Elysia()
  .get('/demo', ({ format }) => {
    return format(user) // 默认成功码
    // return format(null, 404) // 指定业务码
  })
```

`formatResponse` 已将 `format` 注入上下文，也可以直接用：

```ts
new Elysia()
  .get('/demo', ({ format }) => format({ ok: true }))
```

插件抛业务错误示例：

```ts
import { ResponseCodeError } from '@/plugins/formatResponse'

if (!authorized) {
  throw new ResponseCodeError(403)
}
```

## Logger Plugin

默认规则：

- 自动日志默认位图：
  - `NODE_ENV=development` 时默认 `LogMasks.DEV_DEFAULT`（全量请求/响应参数，不写文件）
  - `NODE_ENV=production` 时默认 `LogMasks.PROD_DEFAULT`（仅错误时记录参数与响应值，并写文件）
- 每个请求都会维护 `traceId`，并通过响应头 `x-trace-id` 返回
- 日志会默认脱敏敏感字段（如 `authorization`、`cookie`、`password`、`token`）
- 可选文件日志目录 `LOG_FILE_DIR`（不传则不写文件）
- 是否写文件是正交能力：只有 `mask` 含 `LogBits.WRITE_FILE` 才会写入 `${YYYY-MM-DD}.log`
- 若 `mask` 含 `LogBits.WRITE_FILE` 但未配置 `logsDir/LOG_FILE_DIR`，会打印一次警告并跳过文件写入
- 文件日志默认按 100KB 切分（`YYYY-MM-DD.log`, `YYYY-MM-DD.1.log`, ...），可通过 `LOG_FILE_MAX_BYTES` 覆盖
- 日切与保留策略均按本地时间计算
- 文件日志支持可选策略：`LOG_FILE_RETENTION_DAYS`（保留天数清理）
- 文件日志磁盘满（`ENOSPC`/`EDQUOT`）时会打印错误并直接退出进程
- 遇到二进制或流式响应时，日志使用占位符（`[BinaryResponse]` / `[StreamResponse]`）
- 上下文注入 `log(data?)`，默认跟随当前路由的日志开关
- 提供 `useLogger` 宏做路由级覆盖，优先级高于全局插件配置
- `useLogger` 类型为 `boolean | number`
  - `false`：等价 `0`，同时关闭自动日志与手动 `log(data?)`
  - `true`：使用全局配置（与省略一致）
  - `number`：直接作为 `mask`
- 自动日志能力由位图控制，按位组合使用 `|`（不是 `&`）
- `LogBits` 协议冻结：已分配位不可复用，未知位会被直接忽略
- 常用组合常量：
  - `LogMasks.DEV_DEFAULT`
  - `LogMasks.PROD_DEFAULT`
  - `LogMasks.ERROR_CONTEXT`
  - `LogMasks.FILE_ERROR_CONTEXT`
  - `LogMasks.INFO`
  - `LogMasks.TRACE`
  - `LogMasks.FILE_INFO`
  - `LogMasks.FILE_TRACE`
  - `LogMasks.MANUAL_ONLY`

基础用法：

```ts
import { createLoggerPlugin, LogBits, LogMasks, bits } from '@/plugins/logger'

new Elysia()
  .use(createLoggerPlugin({
    // 不传则按 NODE_ENV 走默认位图
    mask: LogMasks.INFO,
    // 文件目录由全局配置控制，插件可显式传入覆盖
    logsDir: 'logs',
    // 可选：日志按 14 天保留清理
    logsRetentionDays: 14,
    // 可选：单文件 10MB 上限，超出自动切分
    logsMaxBytes: 10 * 1024 * 1024,
  }))
  .get('/demo', ({ log }) => {
    log('手动日志：受 useLogger 开关控制')
    log({
      stage: 'before-query',
    })
  }, {
    useLogger: LogMasks.FILE_TRACE,
    // 或者直接写 mask：
    // useLogger: bits(LogBits.ERROR, LogBits.RESPONSE_BODY, LogBits.MANUAL),
  })
```

## Realtime Domain Plugin

默认规则：

- `domains` 是可选配置项，不强制声明
- 数据域在 `src/constants/realtimeDomains.ts` 统一维护，其他位置仅允许引用
- 未声明 `domains` 的接口，视为无副作用，不入映射也不推送
- `GET` 路由声明了 `domains`，会进入 `domain-map`
- 非 `GET` 路由声明了同名 `domains`，并且成功（`2xx`）后会推送 `SSE`
- 插件提供两个接口：
  - `GET {API_PREFIX}/realtime/domain-map`
  - `GET {API_PREFIX}/realtime/stream`

用法示例：

```ts
import { REALTIME_DOMAINS } from '@/constants/realtimeDomains'

new Elysia()
  .get('/users/me', handler, {
    domains: [REALTIME_DOMAINS.USER_PROFILE],
  })
  .patch('/users/me', handler, {
    domains: [REALTIME_DOMAINS.USER_PROFILE],
  })
```

`domain-map` 返回结构示例：

```json
{
  "code": 200,
  "data": {
    "version": 1,
    "map": {
      "user.profile": [
        "{API_PREFIX}/users/me",
        "{API_PREFIX}/users/user/:id"
      ]
    }
  },
  "message": "success"
}
```

## Auth Policy

默认策略：

- 所有路由默认要求鉴权（`useAuth: true` 由插件 `guard` 注入）
- 公开接口必须显式声明 `useAuth: false`
- `useAuth: true` 的路由会自动在 OpenAPI 补充 `401` 响应

公开路由示例：

```ts
new Elysia()
  .group('/auth', {
    useAuth: false,
  }, app => app)
```

## Authorize Plugin

用途：

- 在认证通过后执行资源级鉴权（`action + resource (+ resourceId)`）
- 支持声明式路由鉴权（`useAuthorize`）
- 支持命令式鉴权（`authorize(input)`）

默认策略：

- 未声明 `useAuthorize` 等价于不启用鉴权
- `useAuthorize: true` 不合法；必须提供完整鉴权参数对象
- 声明了 `useAuthorize` 但未匹配到允许策略，默认拒绝（deny-by-default）
- 即使未配置任何 `policy`，启用 `useAuthorize` 后也按默认拒绝处理
- `actorId` 未解析到时返回 `401`
- 鉴权拒绝时返回 `403`
- 插件支持多策略链；任一策略拒绝即拒绝（deny 优先）
- `onDeny` 属于旁路审计钩子：执行失败仅记录，不影响主流程返回
- 启用 `useAuthorize` 后，OpenAPI 会自动补充 `401/403` 响应

声明式用法：

```ts
new Elysia()
  .get('/users/user/:id', ({ format }) => format(null), {
    useAuthorize: {
      action: 'user.read',
      resource: 'user',
      resourceId: ({ params }) => Number(params.id),
    },
  })
```

命令式用法：

```ts
new Elysia()
  .post('/users/:id/transfer', async ({ auth, authorize, format, params }) => {
    const decision = await authorize({
      actorId: auth.id,
      action: 'user.transfer',
      resource: 'wallet',
      resourceId: Number(params.id),
    })

    if (!decision.allowed) {
      return format(null, decision.code)
    }

    return format(true)
  })
```

全局挂载策略示例：

```ts
import { createAuthorizePlugin, defineAuthorizePolicy } from '@/plugins/authorize'

const allowSelfRead = defineAuthorizePolicy(({ action, actorId, resource, resourceId }) => {
  if (action === 'user.read' && resource === 'user' && resourceId === actorId) {
    return true
  }

  return undefined
})

new Elysia()
  .use(createAuthorizePlugin({
    policy: [allowSelfRead],
  }))
```

## Time Standard

默认规则：

- API 输入参数、API 响应值、数据库中的时间字段统一使用毫秒时间戳（number）
- 禁止新增 `Date` 作为接口与持久化层时间类型

示例工具：

```ts
import { timestampMsSchema } from '@/utils/time'

const bodySchema = z.object({
  startedAt: timestampMsSchema,
})

const responseSchema = z.object({
  startedAt: timestampMsSchema,
})
```

## Routing Prefix

默认规则：

- 对外根前缀统一由环境变量 `API_PREFIX` 提供
- 在 `src/index.ts` 通过父级 `.group(import.meta.env.API_PREFIX, ...)` 挂载
- 各 service 内仅写相对路径（如 `/auth`、`/users`）

分页响应快捷工具（避免重复写 response 声明）：

```ts
import { page200, pageResponse } from '@/plugins/paginationStandard'
import { z } from 'zod'

const userSchema = z.object({ id: z.number(), name: z.string() })

const responseA = {
  200: page200(userSchema),
}

const responseB = pageResponse(userSchema) // 等价于 { 200: page200(userSchema) }
```

## Pagination Plugin

默认协议（与当前前端分页协议一致）：

- query: `page`, `pageSize`
- firstPage: `1`
- defaultPageSize: `10`
- response data keys: `list`, `total`, `page`, `pageSize`

基础用法：

```ts
import { Elysia } from 'elysia'
import { z } from 'zod'

new Elysia()
  .get('/users', async ({ buildPageData, format, pagination }) => {
    const rows = [{ id: 1, name: 'Alice' }]
    const total = 1

    return format(buildPageData(rows, total))
  }, {
    usePagination: true,
    response: pageResponse(z.object({ id: z.number(), name: z.string() })),
  })
```

路由级配置覆盖：

```ts
{
  usePagination: {
    query: { page: 'current', pageSize: 'size' },
    firstPage: 1,
    defaultPageSize: 20,
    maxPageSize: 200,
    response: { list: 'items', total: 'totalCount', page: 'current', pageSize: 'size' },
  },
}
```

## List Query Whitelist Plugin

用途：

- 拦截未授权 query key
- 校验排序字段是否在白名单内
- 统一解析 `sortBy/sortOrder` 与过滤字段
- 查询/排序/过滤能力均为“显式声明才支持”

语义区分：

- 查询（query/search）：关键词检索，通常是模糊或多字段匹配
- 过滤（filter）：结构化条件，按字段精确或范围约束

基础用法：

```ts
new Elysia()
  .get('/users', async ({ format, listQuery }) => {
    // listQuery.sortBy / listQuery.sortOrder / listQuery.filters
    return format(listQuery)
  }, {
    useListQueryWhitelist: {
      allowSortFields: ['createdAt', 'name'],
      allowFilterFields: ['name', 'email'],
      allowQueryKeys: ['q'],
      defaultSortOrder: 'desc',
    },
  })
```

## Recommended Combo

列表接口建议同时开启：

```ts
{
  usePagination: true,
  useListQueryWhitelist: {
    allowSortFields: ['createdAt'],
    allowFilterFields: ['name'],
  },
}
```

这样可以同时获得：

- 安全分页参数
- 可控排序/过滤
- 统一响应格式

## Idempotency Plugin

用途：

- 防重复提交（同一 `Idempotency-Key` + 相同请求体直接回放）
- 并发冲突保护（处理中请求可等待或返回冲突）
- 与统一响应格式兼容（回放结构仍为 `{ code, data, message }`）

默认策略：

- 默认禁用；仅显式声明 `useIdempotency` 的路由启用
- 未启用时，请求不做任何幂等特殊处理
- 仅对 `POST/PUT/PATCH/DELETE` 生效
- 默认要求 `Idempotency-Key`（`enforceIdempotency: true`）
- 进行中请求默认等待（轮询 200ms，最长 10s）
- 默认缓存 TTL 为 24 小时
- 启用 `useIdempotency` 后，OpenAPI 会自动补充 `400/409` 响应

基础用法（路由级开启）：

```ts
import { Elysia } from 'elysia'
import { responseDTO } from '@/plugins/formatResponse'
import { z } from 'zod'

new Elysia()
  .post('/orders', ({ format }) => {
    return format({ id: 1 }, 201)
  }, {
    useIdempotency: true,
    response: {
      201: responseDTO(z.object({ id: z.number() })),
    },
  })
```

路由级配置覆盖（例如自定义 scope 或行为）：

```ts
{
  useIdempotency: {
    scope: '/orders:create',
    options: {
      cacheTTLMS: 60_000,
      inProgressStrategy: {
        wait: false,
      },
    },
  },
}
```
