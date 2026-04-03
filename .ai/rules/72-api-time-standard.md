# 72 Time Standard

Priority: P1  
Scope: `src/services/**`, `src/models/**`, `src/utils/time.ts`, `src/db/**`

## Rule
- API 输入参数、API 响应值、数据库存储时间字段统一使用毫秒时间戳（number）。
- 禁止新增 `Date` 作为接口或持久化层的时间类型。
- 时间戳 schema 统一复用 `src/utils/time.ts` 中的 `timestampMsSchema`（或同等语义 schema）。

## Non-Goals
- 不在本规则中定义时区展示格式（前端负责格式化）。

## Exceptions
- 无。

## Checks
- 新增响应 schema 时，检查是否出现 `z.date()` 暴露到接口层。
- 新增数据库时间字段时，检查是否使用时间戳存储而非 `timestamp/date` 类型。
- 新增时间参数时，检查是否复用 `timestampMsSchema` 或同等毫秒时间戳 schema。
