# API Third-Party Plugins

## Trigger
- 用户要求接入或修改 API 的契约、鉴权、日志、链路追踪、幂等能力。
- 用户要求“使用成熟第三方插件，不要重复造轮子”。

## Inputs
- `scope`: 全局入口或指定路由。
- `capability`: `contract` | `auth` | `authz` | `logging` | `idempotency`。
- `risk`: 是否涉及破坏性变更。

## Workflow
1. 先使用现有封装，不直接在业务路由里拼第三方插件。
   - `src/plugins/third-party/contract.ts` -> `@elysiajs/openapi`
   - `src/plugins/third-party/auth.ts` -> `@elysiajs/bearer` + `@elysiajs/jwt`
   - `src/plugins/third-party/authz.ts` -> `@casl/ability`
   - `src/plugins/third-party/logging.ts` -> `@bogeychan/elysia-logger` + `@elysiajs/server-timing` + `@elysiajs/opentelemetry`
   - `src/plugins/third-party/idempotency.ts` -> `@node-idempotency/core`
2. 若现有封装能力不足，先扩展对应封装文件，再给业务路由使用。
3. 入口统一通过 `src/plugins/index.ts` 暴露与组装，避免多处散落 `.use(...)`。
4. 变更后至少运行一次 `bunx tsc -p tsconfig.json`。

## Output
- 复用或扩展后的第三方插件封装。
- 入口接入改动（通常在 `src/index.ts` 或 `src/plugins/index.ts`）。

## Guardrails
- 禁止在业务 service 路由直接重复封装第三方插件。
- 禁止在未评估现有封装前新增平行插件文件。
- 允许临时绕过仅限紧急修复，事后必须回收至统一封装。

## Fallback
- 第三方插件不满足需求时，保留统一封装入口，并在封装内部做最小扩展。

## Examples
- 为所有路由启用统一日志：修改 `src/plugins/third-party/logging.ts`，由 `src/plugins/index.ts` 统一挂载。
- 新增 JWT 鉴权能力：扩展 `src/plugins/third-party/auth.ts`，业务路由通过 `useAuth` 宏复用。
