# P0-DB-MIGRATION-ONLY

Priority: P0
Scope: `packages/server/src/db/**`, `packages/server/drizzle/**`, `packages/server/package.json`, CI/部署脚本

## Rule
- 所有数据库结构变更（DDL）必须通过 migration 落地，并提交对应迁移文件。
- `db:push` 仅允许本地临时开发使用，禁止用于 CI、staging、prod。
- staging/prod 只能执行 migration 流程（推荐统一 `db:migrate` 命令）。
- 已合并历史 migration 禁止修改；修复通过新增 migration 完成。

## Non-Goals
- 不限制本地研发阶段的临时调试方式。
- 不限制 migration 文件命名风格。

## Exceptions
- 无。

## Checks
- PR 若修改 `src/db/**/schemas` 但未新增 migration，拦截。
- CI/部署脚本若出现 `db:push`，拦截。
- 非最新未合并迁移被修改时，拦截。

