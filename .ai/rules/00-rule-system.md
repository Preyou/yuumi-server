# RULE-SYSTEM

Priority: P0
Scope: `packages/server/.ai/rules/*`

## Rule
- 所有规则文件必须采用统一结构：`Priority`、`Scope`、`Rule`、`Non-Goals`、`Exceptions`、`Checks`。
- 规则冲突按优先级处理：`P0 > P1 > P2`。
- 同优先级冲突时，优先采用 `Scope` 更窄的规则。
- 用户当前会话若明确覆盖规则，需先说明影响；涉及高风险数据库操作时必须二次确认。

## Non-Goals
- 本文件不定义具体数据库建模细节。
- 本文件不替代具体规则文件中的检查项。

## Exceptions
- 无。

## Checks
- 评审新增规则时，确认章节完整。
- 对无法验证的抽象口号类规则，拒绝合入。

