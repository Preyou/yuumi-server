# P0-DB-EXPAND-CONTRACT

Priority: P0
Scope: `packages/server/src/db/**`, `packages/server/drizzle/**`, 受影响 service/model/script

## Rule
- 非兼容性结构变更必须走两阶段：`expand -> contract`。
- `expand` 只允许向后兼容变更（加列、加索引、兼容读写、回填准备）。
- 数据回填完成且读写切换后，才允许 `contract`（删旧列、删旧约束、收紧约束）。
- 禁止在同一发布内同时执行“不可逆 DDL + 读写切换”，除非用户明确接受停机窗口并完成二次确认。

## Non-Goals
- 不限制兼容阶段的业务实现细节。
- 不禁止对低风险兼容变更进行快速发布。

## Exceptions
- 无。

## Checks
- 涉及非兼容性 DDL 的 PR，必须标注当前阶段（expand 或 contract）。
- 存在回填时，必须说明可重入与失败恢复策略。
- 缺少阶段计划时，拦截。

