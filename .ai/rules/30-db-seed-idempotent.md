# P0-DB-SEED-IDEMPOTENT

Priority: P0
Scope: `packages/server/scripts/**`, 初始化任务与上线数据准备脚本

## Rule
- 所有 seed/初始化脚本必须幂等，允许重复执行且结果稳定。
- 写入必须显式声明冲突策略（如 `onConflictDoNothing` 或 upsert），禁止重复执行必然报错的实现。
- 作为唯一键的业务字段在入库前必须归一化（例如 `method` 统一大写，路径规则一致）。
- seed 仅用于基础静态数据与系统初始化数据，不承担一次性历史修复。

## Non-Goals
- 不限制脚本具体实现语言与组织方式。
- 不禁止在独立迁移任务中做一次性数据修复。

## Exceptions
- 无。

## Checks
- 脚本需支持连续执行两次，第二次不产生脏数据。
- 必须能在代码中看到冲突目标与冲突行为。
- 若依赖外部输入源，必须具备空值与异常保护。

