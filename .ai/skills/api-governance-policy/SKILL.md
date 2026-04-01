# API Governance Policy

## Trigger
- 用户要求处理 API 版本兼容、ID 语义一致、可空语义、废弃流程。
- 需求重点是治理策略，不是新增运行时插件。

## Inputs
- `policy`: `versioning` | `idConsistency` | `nullability` | `deprecation`。
- `scope`: 契约文件、路由定义、发布文档、变更说明。

## Workflow
1. 先确认是否可以通过现有封装与契约文档落地，避免新增运行时插件。
2. 在 OpenAPI/schema/发布说明中明确策略，不靠隐式约定。
3. 对破坏性策略变更补充迁移计划与时间窗口。
4. 变更后校对规则文件与 skill 触发关系是否一致。

## Output
- 可执行的治理策略文档与契约变更。
- 必要的迁移说明与风险说明。

## Guardrails
- 禁止把流程治理问题包装成新的运行时插件。
- 禁止在无迁移计划时直接做破坏性策略切换。

## Fallback
- 信息不足时先给保守策略：保持兼容、延长迁移窗口、补充可追踪公告。

## Examples
- 版本兼容：先标注新旧版本并给出迁移窗口，再决定下线时间。
- 废弃策略：先标记 `deprecated` 并公告，再执行移除。
