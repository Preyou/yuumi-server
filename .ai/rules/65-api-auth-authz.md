# 65 API Auth Authz

Priority: P1  
Scope: `src/plugins/jwt.ts`, `src/plugins/authorize.ts`, `src/services/**`

## Rule
- 所有路由默认鉴权（`useAuth: true`）。
- 公开路由必须显式声明 `useAuth: false`。
- `useAuth` 仅负责认证（身份校验）。
- 资源级鉴权统一走 `authorize` 插件（`useAuthorize` 或 `authorize(input)`）。
- `useAuthorize` 未显式声明时，视为不启用鉴权；显式启用后按 deny-by-default 执行。
- `useAuthorize` 显式启用时，即使未配置策略，也必须默认拒绝（`403`）。
- `onDeny` 审计钩子属于旁路能力，失败时只允许记录日志，不得改变主鉴权结果。
- 非公开写接口（`POST/PUT/PATCH/DELETE`）必须显式做鉴权检查（声明式或命令式）。

## Non-Goals
- 不在本规则中限定具体 RBAC/ABAC/策略引擎实现细节。

## Exceptions
- 无。

## Checks
- 新增公开接口时必须显式声明 `useAuth: false`。
- 评审时非公开写接口必须可见到显式鉴权路径（`useAuthorize` 或 `authorize(input)`）。
