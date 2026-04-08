# P1-ENV-EXPLICIT-OVERRIDE

Priority: P1
Scope: `packages/server/.env*`, `packages/server/README.md`, 启动脚本与部署环境变量配置

## Rule
- `.env` 作为默认基线配置文件，所有必需且非敏感配置应在 `.env` 提供默认值。
- 若某环境不使用 `.env` 默认值，必须在 `.env.local`、`.env.[环境]` 或 `.env.[环境].local` 中显式覆盖。
- 禁止依赖“隐式默认值”或“外部注入但仓库无覆盖声明”的方式改变运行配置。
- 敏感配置可不在 `.env` 提供真实默认值，但必须在 `.env.local` / `.env.[环境].local` 或平台密钥管理中显式配置。

## Non-Goals
- 不限制具体密钥托管平台与注入方式。
- 不要求将敏感真实值写入版本库。

## Exceptions
- 无。

## Checks
- 当代码行为依赖某个非默认配置时，检查是否在 `.env.local` / `.env.[环境]` / `.env.[环境].local` 有显式覆盖。
- 新增必需环境变量时，若为非敏感项，检查 `.env` 是否提供默认值。
- 新增敏感项时，检查是否提供占位说明与目标环境显式配置说明。
