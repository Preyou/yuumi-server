# P0-DB-SOURCE-OF-TRUTH

Priority: P0
Scope: `packages/server/src/db/**`, `packages/server/drizzle/**`

## Rule
- 每种数据库引擎独立在 `src/db/<engine>/` 下维护（例如 `pg`、`mysql`、`redis`）。
- 该引擎的结构定义唯一来源是 `src/db/<engine>/schemas/*.ts`。
- 迁移与快照按引擎隔离存放（例如 `drizzle/<engine>/**`），仅作为生成产物与历史记录，不作为手写主定义。
- 同一业务实体只能有一个主数据库 owner；跨库镜像必须有显式同步机制与文档，禁止隐式双写。

## Non-Goals
- 不限制单引擎内的模块拆分方式。
- 不禁止按需新增数据库引擎。

## Exceptions
- 无。

## Checks
- 发现同一实体在多个引擎 schema 中重复定义且无 owner 说明，拦截。
- 发现手改 `drizzle/**/meta/*` 或生成快照内容，拦截。
- 新增引擎时，必须同时新增对应 `src/db/<engine>/` 与迁移目录。

