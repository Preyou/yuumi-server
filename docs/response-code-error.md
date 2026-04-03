# ResponseCodeError 开发手册

`ResponseCodeError` 用于表达“可预期业务错误”，并交给 `formatResponse` 插件统一输出响应格式与 HTTP 状态码。

## 使用原则

- 可预期业务错误：抛 `new ResponseCodeError(code, message?)`
- 未知系统错误：抛普通 `Error`
- 插件内不要手写 `{ code, data, message }` 错误响应
- 插件内不要直接 `context.status(..., errorEnvelope)` 拼错误包

## 何时使用

- 鉴权失败：`401` / `403`
- 参数或协议不合法：`400` / `422`
- 资源冲突：`409`
- 资源不存在：`404`

## 示例

```ts
import { ResponseCodeError } from '@/plugins/formatResponse'

if (!token) {
  throw new ResponseCodeError(401)
}

if (!allowed) {
  throw new ResponseCodeError(403, 'forbidden by policy')
}
```

## 与 formatResponse 的关系

- `formatResponse.onError` 会识别 `ResponseCodeError.code`
- 响应体统一为 `{ code, data: null, message }`
- 未识别错误统一降级为 `500`

## OpenAPI 约定

- 通用插件错误响应应由插件自动补齐（例如 `useAuth` 的 `401`、`useAuthorize` 的 `401/403`、`useIdempotency` 的 `400/409`）
- 业务路由仍需声明自身业务成功响应与特定错误响应
