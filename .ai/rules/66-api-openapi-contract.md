# 66 API OpenAPI Contract

Priority: P1  
Scope: `src/services/**`, `src/plugins/global.ts`, OpenAPI 生成流程

## Rule
- 最终产出的 OpenAPI 文档必须包含可用的接口契约（path、method、参数、响应结构）。
- 编写路由时允许省略局部 schema 定义，但不得影响最终 OpenAPI 文档生成与可读性。
- 治理插件产生的通用错误响应（如鉴权/鉴权失败、幂等冲突）应由插件自动补充到 OpenAPI。
- 对外接口变更后，必须确认 OpenAPI 文档可生成、可访问、结构完整。

## Non-Goals
- 不强制每个 handler 内联完整 schema。

## Exceptions
- 无。

## Checks
- 变更接口后，检查 OpenAPI 输出是否仍可生成。
- 评审时验证新增接口在 OpenAPI 中可见，且参数与响应字段齐全。
