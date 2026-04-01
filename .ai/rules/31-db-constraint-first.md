# P0-DB-CONSTRAINT-FIRST

Priority: P0
Scope: `packages/server/src/db/**/schemas/*.ts`, 对应 migration SQL

## Rule
- 关键数据完整性约束必须落在数据库层，不能只在应用层校验。
- 新表或新增字段默认评估并补齐：`NOT NULL`、`DEFAULT`、`UNIQUE`、`CHECK`、`FK`。
- 唯一性按真实业务键建模，必要时使用复合唯一键，禁止仅靠应用层“先查后写”。
- 禁止仅在 DTO/接口层定义约束而数据库层缺失对应约束。

## Non-Goals
- 不限制约束命名风格细节。
- 不禁止在应用层增加额外防御性校验。

## Exceptions
- 无。

## Checks
- 新增持久化字段但无约束说明时，要求补充。
- 出现“应用层保证唯一”但无数据库唯一约束时，拦截。
- migration SQL 中应可追踪到新增约束。

