# API Custom Governance Plugins

## Trigger
- 用户要求统一分页、响应白名单、错误映射、时间字段、命名一致性、列表查询白名单。
- 用户要求“没有成熟第三方实现时，走自研封装”。

## Inputs
- `scope`: 全局入口或指定路由。
- `capability`: `pagination` | `responseWhitelist` | `errorMapping` | `timeStandard` | `fieldNaming` | `listQueryWhitelist`。

## Workflow
1. 仅在 `src/plugins/custom/*` 中实现或扩展治理封装：
   - `paginationStandard.ts`
   - `responseWhitelist.ts`
   - `errorMapping.ts`
   - `timeStandard.ts`
   - `fieldNamingConsistency.ts`
   - `listQueryWhitelist.ts`
2. 统一从 `src/plugins/index.ts` 暴露，不在业务代码中复制工具函数。
3. 需要路由接入时，优先通过插件 `decorate` 或 `macro`，避免每个路由手写。
4. 变更后执行 `bunx tsc -p tsconfig.json`。

## Output
- 自研治理插件的新增或增强。
- 统一导出与接入更新。

## Guardrails
- 禁止新增重复语义的第二套自研插件。
- 禁止把治理逻辑散落在 `services/*` 业务路由中。

## Fallback
- 无法立即插件化时，先实现单一边界适配函数，并在后续任务收敛回 `src/plugins/custom/*`。

## Examples
- 统一分页参数：复用 `paginationStandard.parse`，禁止在路由里重复写 `page/pageSize` 解析。
- 统一错误体：在 `errorMapping.ts` 扩展状态码映射，而不是在每个路由 `try/catch` 返回不同结构。
