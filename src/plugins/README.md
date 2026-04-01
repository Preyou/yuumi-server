# Plugins Guide

`src/plugins` 用于放置后端治理插件（响应规范、契约、分页、查询白名单、鉴权等）。

## Overview

- `formatResponse.ts`
  - 统一响应结构：`{ code, data, message }`
  - 统一错误处理：按状态码映射表生成 HTTP Status 与默认消息
  - 业务层统一返回 `format(data, code?)`
  - 提供 `responseDTO` 作为通用响应 schema 生成器
- `logger.ts`
  - 维护 `x-request-id`
  - 注入 `logger()` 上下文函数（支持 `logger.info()` 风格）
  - 提供 `useLogger` 宏用于路由级日志覆盖
- `src/constants/responseCodeMap.ts`
  - 集中定义业务码到 HTTP Status 的映射关系（插件直接读取）
- `paginationStandard.ts`
  - 提供 `usePagination` 宏，统一解析分页参数并注入分页上下文
- `listQueryWhitelist.ts`
  - 提供 `useListQueryWhitelist` 宏，约束列表查询字段、排序字段、过滤字段
- `idempotency/index.ts`
  - 基于 `@node-idempotency/core` 提供 `useIdempotency` 宏，约束写接口幂等
- `jwt.ts`
  - 提供 `useAuth` 宏，默认所有路由鉴权，公开接口需显式 `useAuth: false`
- `global.ts`
  - 治理包装插件，组合 OpenAPI 契约、日志、响应格式、幂等、分页、查询白名单、鉴权插件
  - 供每个路由插件通过 `.use(globalPlugin)` 复用
- `src/config/env.ts`
  - 统一基于 `import.meta.env` 做环境变量读取与 `zod` 校验（启动即 fail-fast）

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
import { serverConfig } from '@/config/env'
import { authService } from '@/services/auth'
import { usersService } from '@/services/users'

export const app = new Elysia()
  .use(authService)
  .use(usersService)

app.listen(serverConfig.PORT)
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
- 自定义插件内部出错直接抛 `Error`，`formatResponse` 会统一包装为 500 响应
- 插件内 `guard` 使用 `schema: 'standalone'` 做全局约束
- `x-request-id` 由 `logger` 插件维护（不进入响应体）

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

## Logger Plugin

默认规则：

- 总开关默认仅开发环境启用（`APP_ENV=development`）
- 每个请求都会维护 `requestId`，并通过响应头 `x-request-id` 返回
- 日志会默认脱敏敏感字段（如 `authorization`、`cookie`、`password`、`token`）
- 上下文注入 `logger` 函数，支持：
  - `logger()`：使用 `useLogger` 指定级别输出当前请求信息
  - `logger.info()`：按指定级别输出当前请求信息
  - `logger.info(data)`：按指定级别输出请求信息 + 自定义数据
- 提供 `useLogger` 宏做路由级覆盖

基础用法：

```ts
new Elysia()
  .get('/demo', ({ logger }) => {
    logger()
    logger.info()
    logger.info({
      stage: 'before-query',
    })
  }, {
    useLogger: {
      level: 'debug',
    },
  })
```

## Auth Policy

默认策略：

- 所有路由默认要求鉴权（`useAuth: true` 由插件 `guard` 注入）
- 公开接口必须显式声明 `useAuth: false`

公开路由示例：

```ts
new Elysia()
  .group('/auth', {
    useAuth: false,
  }, app => app)
```

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

- 仅对 `POST/PUT/PATCH/DELETE` 生效
- 默认要求 `Idempotency-Key`（`enforceIdempotency: true`）
- 进行中请求默认等待（轮询 200ms，最长 10s）
- 默认缓存 TTL 为 24 小时

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
