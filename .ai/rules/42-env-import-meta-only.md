# P1-ENV-IMPORT-META-ONLY

Priority: P1
Scope: `packages/server/src/**`, `packages/server/drizzle.config.ts`, `packages/server/scripts/**`

## Rule
- 所有环境变量读取统一使用 `import.meta.env`。
- 禁止新增 `process.env`、`Bun.env`、`Deno.env` 读取路径。
- 默认认为写入的环境变量值是合法的。
- 仅做必要类型转换（例如 `string -> number`、`string -> boolean`），不做额外边界/格式校验。
- 如确需额外校验，必须由用户明确提出。

## Non-Goals
- 不限制环境变量文件命名与加载顺序（由其他规则约束）。
- 不替代敏感信息脱敏与环境隔离规则。

## Exceptions
- 无。

## Checks
- 扫描新增/改动代码，若出现 `process.env`、`Bun.env`、`Deno.env`，拦截。
- 读取环境变量时，确认来源为 `import.meta.env`。
- 环境变量用于数值/布尔语义时，确认有显式类型转换。
- 若新增环境变量，需补充类型声明。
