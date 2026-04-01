# Backend Logging

## Trigger
- 用户要求新增或重构后端日志能力。
- 用户要求接入统一请求日志、错误日志、链路追踪日志。
- 用户要求支持日志级别控制（如 debug/info/warn/error/silent）。

## Inputs
- `scope`: 接入范围（全局、指定服务、指定路由）。
- `level`: 日志级别（`debug`、`info`、`warn`、`error`、`silent`）。
- `redaction`: 脱敏字段策略（默认脱敏密码、token、cookie、secret、连接串）。
- `format`: 输出格式（默认结构化 JSON）。
- `request_id`: 请求 ID 透传 header（默认 `x-request-id`）。

## Workflow
1. 先确定接入位置：
   - 优先通过统一插件挂载到应用入口，避免在业务路由散落日志实现。
2. 设计日志最小字段集：
   - `ts`、`level`、`event`、`service`、`requestId`、`method`、`path`、`status`、`durationMs`。
3. 实现日志级别控制：
   - 支持 `debug/info/warn/error/silent`。
   - 默认从环境变量读取（如 `LOG_LEVEL`），无配置时使用 `info`。
4. 实现脱敏策略：
   - 对敏感键统一替换为 `[REDACTED]`，禁止明文输出。
5. 接入插件：
   - 在应用入口 `.use(loggerPlugin())`。
   - 删除路由中的临时 `console.log` 请求日志。
6. 校验行为：
   - 成功请求记录开始和完成日志。
   - 异常请求记录错误日志。
   - 不同级别配置下日志输出数量符合预期。

## Output
- 统一日志插件代码（`src/plugins/*`）。
- 入口接入改动（`src/index.ts`）。
- 若存在散落日志，给出清理结果与风险说明。

## Guardrails
- 日志能力必须通过插件统一管理，禁止在路由中复制粘贴日志逻辑。
- 必须支持日志级别控制，禁止硬编码仅输出一种级别。
- 默认开启敏感字段脱敏。
- 生产环境避免使用 `debug` 级别作为默认值。

## Fallback
- 若当前框架钩子能力受限，至少保证“请求完成 + 请求异常”两类日志可用。
- 若无法稳定注入 requestId，先生成本地 requestId 并写入日志，再补齐透传。

## Examples
- 示例 1：新增全局请求日志插件
  - 新建 `src/plugins/logger.ts`，支持 `LOG_LEVEL` 读取。
  - 在 `src/index.ts` 中挂载 `loggerPlugin()`。
- 示例 2：收敛散落日志
  - 删除路由里 `console.log(req/res)`。
  - 统一在插件层输出结构化日志。

