# 64 API Error Mapping

Priority: P1  
Scope: `src/constants/responseCodeMap.ts`, `src/plugins/formatResponse.ts`, `src/plugins/**`, `scripts/generateResponseCodeDoc.ts`, `docs/response-codes.md`

## Rule
- 业务响应码必须集中定义在 `responseCodeMap`，禁止在业务层散落定义。
- 号段约束固定为：`2xx` 成功、`4xx` 业务错误、`5xx` 系统错误。
- 插件中的可预期业务错误统一抛 `ResponseCodeError(code)`，由 `formatResponse` 统一封装响应。
- 未显式映射的错误统一按 `500` 返回。
- 每次新增或变更响应码后，必须更新自动生成文档 `docs/response-codes.md`。

## Non-Goals
- 不在本规则中限定具体业务错误码分配策略。

## Exceptions
- 无。

## Checks
- 变更响应码后执行：`bun run docs:response-codes`。
- 提交前确认 `docs/response-codes.md` 与代码一致。
- 评审时禁止插件内手写 `{ code, data, message }` 错误响应对象。
