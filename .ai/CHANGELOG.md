# Changelog

## 2026-03-30
- 初始化 `packages/server/.ai` 目录。
- 新增数据库创建与维护 skill：`skills/db-create-maintain/SKILL.md`。
- 新增后端数据库规则拆分（source of truth、migration、兼容性变更确认、seed、约束、索引、环境隔离、验证）。
- 新增后端日志 skill：`skills/backend-logging/SKILL.md`。

## 2026-03-31
- 补齐并落地 `rules/60` 到 `rules/77` 的完整 API 规则集文件，统一规则模板（`Priority`、`Scope`、`Rule`、`Non-Goals`、`Exceptions`、`Checks`）。
- 明确“第三方优先”规则：`61`（`@elysiajs/openapi`）、`63`（Elysia + TypeBox/Zod/Ajv）、`65`（`@elysiajs/jwt` + `@elysiajs/bearer` + `@casl/ability`）、`66`（`@bogeychan/elysia-logger` + `@elysiajs/opentelemetry` + `@elysiajs/server-timing`）、`70`（`@node-idempotency/core`）。
- 明确“自研插件补位”规则：`60`、`62`、`64`、`72`、`73`、`74`。
- 明确“规则治理为主（不做插件）”规则：`71`、`75`、`76`、`77`。
- 更新 `INDEX.md`，补全 API 规则索引，保证目录与文件状态一致。
- 新增 `rules/63-api-input-validation.md`：采用“类型系统优先”，避免类型已覆盖场景下的重复运行时校验，并保留边界与安全例外。
