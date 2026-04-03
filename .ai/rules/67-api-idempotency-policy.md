# 67 API Idempotency Policy

Priority: P1  
Scope: `src/plugins/idempotency/**`, `src/services/**`

## Rule
- 幂等默认禁用；仅在路由显式声明 `useIdempotency` 时启用。
- `useIdempotency` 未声明或为 `false` 时，请求按普通请求处理，不做任何幂等相关特殊逻辑。
- 启用幂等后，行为由插件配置与路由选项共同决定。

## Non-Goals
- 不在本规则中定义业务何时必须启用幂等（由具体接口策略决定）。

## Exceptions
- 无。

## Checks
- 新增写接口时，明确是否启用 `useIdempotency`。
- 评审时确认“未启用幂等”的路由没有额外幂等分支逻辑。
