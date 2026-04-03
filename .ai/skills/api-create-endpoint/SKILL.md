# API Create Endpoint

## Trigger
- 用户要求“新增一个接口 / 新增一个 API endpoint”。
- 用户要求在现有 `service` 下补充 `GET/POST/PUT/PATCH/DELETE` 路由。
- 用户要求创建新的业务路由分组并接入治理插件。

## Inputs
- `project`: 服务端项目路径（默认 `packages/server`）。
- `service`: 目标 service 文件（如 `src/services/users.ts`）。
- `route_group`: service 组内相对前缀（如 `/users`、`/auth`）。
- `method`: HTTP 方法（GET/POST/PUT/PATCH/DELETE）。
- `path`: 组内子路径（如 `/me`、`/:id`）。
- `contract`: 入参与响应契约（zod schema + response code）。

## Workflow
1. 先定位接口归属：
   - 优先复用已有 service；无合适归属再新建 service 并在 `src/index.ts` 挂载。
2. 路由路径规范化：
   - 根前缀统一来自 `serverConfig.API_PREFIX`（父级 group）。
   - service 内仅写相对路径，禁止重复拼接根前缀。
3. 统一治理插件前提：
   - service 必须 `.use(globalPlugin)`。
4. 鉴权与鉴权：
   - 默认 `useAuth: true`（无需重复声明）。
   - 公开接口必须显式 `useAuth: false`。
   - 非公开写接口（POST/PUT/PATCH/DELETE）必须显式鉴权：`useAuthorize` 或 `authorize(input)`。
5. 响应与错误：
   - 业务成功/业务失败返回统一使用 `format(data, code?)`。
   - 插件/治理侧可预期错误统一抛 `ResponseCodeError(code)`。
   - 未显式处理错误保持默认 500 兜底。
6. OpenAPI 契约：
   - 每个接口都要有可用的 `response` 契约。
   - 允许局部简写，但最终 OpenAPI 必须完整可生成。
7. 时间标准：
   - API 输入、输出、持久化时间统一使用毫秒时间戳（number）。
8. 可选治理能力按需显式开启：
   - 分页：`usePagination`
   - 列表查询白名单：`useListQueryWhitelist`
   - 幂等：`useIdempotency`（默认禁用，不声明即不启用）
9. 完成后最小校验：
   - 执行 `bunx tsc -p packages/server/tsconfig.json`。

## Output
- 可编译的接口实现（含 handler、schema、response、必要宏配置）。
- 若新增 service，同步更新 `src/index.ts` 挂载。

## Guardrails
- 禁止绕过 `formatResponse` 协议手写错误响应包。
- 禁止把鉴权逻辑散落在 handler 中且无统一入口。
- 禁止引入 `Date` 作为 API/DB 时间字段类型。
- 查询/排序/过滤能力必须显式声明支持字段；未声明即不支持。

## Fallback
- 不确定接口归属时，优先放入最接近业务域的现有 service，并在提交说明中标注“待后续拆分”。
- 契约信息不足时，先按最小可用 schema 实现并在注释/说明中列出待确认字段。

## Examples
- 在 `usersService` 下新增 `GET /users/:id/profile`，默认鉴权，返回 `responseDTO(...)`。
- 新增公开登录接口：`useAuth: false` + 200/400/401 契约。
- 新增写接口 `POST /orders`：显式 `useAuthorize` + 视需求启用 `useIdempotency`。
