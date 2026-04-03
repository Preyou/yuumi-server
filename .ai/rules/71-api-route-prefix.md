# 71 API Route Prefix

Priority: P1  
Scope: `src/index.ts`, `src/services/**`, `src/config/env.ts`

## Rule
- 对外业务根前缀统一由环境变量 `API_PREFIX` 提供。
- 根前缀在 `src/index.ts` 通过父级 `.group(serverConfig.API_PREFIX, ...)` 挂载。
- 各 service 只定义相对路径（如 `/auth`、`/users`），通过父级前缀继承对外路径。
- 禁止在 service 内硬编码绝对业务路径（例如 `/api/users`）。

## Non-Goals
- 不在本规则中定义 API 版本策略。

## Exceptions
- 无。

## Checks
- 新增业务路由时，确认 service 路径为相对路径并由父级前缀继承。
- 评审时确认根前缀来源于 `API_PREFIX`，且未在 service 重复拼接。
