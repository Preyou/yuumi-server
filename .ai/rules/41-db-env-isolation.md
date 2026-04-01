# P1-DB-ENV-ISOLATION

Priority: P1
Scope: `packages/server/.env*`, `packages/server/drizzle.config.ts`, CI/部署环境变量

## Rule
- `DATABASE_URL` 必须按环境隔离（local/dev/staging/prod），禁止共用同一实例。
- 迁移账号与应用运行账号建议分权：迁移账号可 DDL，应用账号默认仅 DML。
- 禁止在代码、脚本、日志中输出完整连接串与敏感凭据。
- 本地默认配置不得指向生产数据库。

## Non-Goals
- 不限制具体密钥管理实现方式。
- 不强制单一部署平台。

## Exceptions
- 无。

## Checks
- 配置变更需能明确映射到目标环境。
- 日志与错误信息不得出现明文凭据。
- 部署前检查目标连接是否符合环境边界。

