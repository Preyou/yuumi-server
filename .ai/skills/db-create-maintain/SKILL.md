# DB Create & Maintain

## Trigger
- 用户明确要求创建数据库、创建数据表、修改表结构、增加索引、设计迁移脚本、初始化种子数据。
- 用户要求“给出后端数据库实现方案并落地代码”。

## Inputs
- `engine`: 数据库引擎（如 `pg`、`mysql`）。
- `entity`: 业务实体名（如 `users`、`permissions`）。
- `columns`: 字段定义（类型、是否可空、默认值）。
- `constraints`: 约束（`PRIMARY KEY`、`UNIQUE`、`CHECK`、`FK`）。
- `indexes`: 索引策略（高频查询字段）。
- `data_migration`: 是否需要回填或数据迁移。
- `env`: 目标环境（local/dev/staging/prod）。

## Workflow
1. 定位数据库 owner 与落点：
   - 结构定义仅放在 `src/db/<engine>/schemas/*.ts`。
   - 不在多个引擎目录重复定义同一实体，除非用户明确要求跨库镜像并给出同步策略。
2. 设计表结构（先约束后代码）：
   - 明确主键、唯一键、检查约束、外键、审计字段。
   - 默认补齐 `created_at`、`updated_at` 字段与默认值策略。
3. 修改 schema：
   - 更新 `src/db/<engine>/schemas/tables.ts`。
   - 若存在关系，更新 `relations.ts`。
   - 确认 `src/db/<engine>/schemas/index.ts` 已正确导出。
4. 生成迁移：
   - 优先使用 Bun + drizzle-kit 生成迁移文件。
   - 迁移落在对应迁移目录（例如当前项目使用 `drizzle/`）。
5. 审查迁移安全性：
   - 检查是否包含破坏性操作（删列、改类型、改非空）。
   - 对破坏性变更采用 expand/contract 两阶段方案。
6. 维护写入脚本与初始化逻辑：
   - 种子脚本必须幂等（`onConflictDoNothing` 或 upsert）。
   - 写入前做必要归一化（如 HTTP method 统一大写）。
7. 交付验证：
   - 说明改动文件、迁移文件、潜在风险与回滚路径。
   - 若缺少必要验证脚本，明确指出并给出补充建议。

## Output
- 一组可直接合并的代码变更：
  - schema 变更文件
  - migration 文件
  - 必要的 seed/脚本调整
- 一份简短变更说明：
  - 做了什么
  - 为什么这样做
  - 风险与验证状态

## Guardrails
- 只使用 Bun 作为运行时与脚本入口。
- 禁止手改自动生成快照/元数据文件（如 `drizzle/meta/*`）。
- 生产/测试环境不使用 `db:push` 作为正式迁移手段。
- 不在日志输出敏感字段（密码、token、连接串、PII）。
- 若需求存在高风险或明显不合理，先给推荐方案并请求二次确认。

## Fallback
- 用户输入不完整时，按最小安全默认值实现并在结果里声明假设。
- 若引擎未明确，默认采用项目当前主引擎并提示可切换点。
- 若仓库缺失迁移命令或配置，先补最小可执行脚本再继续建表流程。

## Examples
- 示例 1：新增 `users` 表（`pg`）
  - 在 `src/db/pg/schemas/tables.ts` 定义表、唯一键、检查约束。
  - 生成迁移并校验 SQL 无破坏性改动。
- 示例 2：给 `permissions` 增加复合唯一约束
  - 目标为 `(path, method)` 唯一，避免仅 `path` 造成冲突。
  - 同步更新初始化脚本，确保 `method` 归一化后写入。

