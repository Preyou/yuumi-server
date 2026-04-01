# Server

## 环境变量文件约定

仅使用以下文件名：

- `env`
- `env.development` / `env.test` / `env.production`
- `env.development.local` / `env.test.local` / `env.production.local`

加载顺序（后者覆盖前者）：

1. `env`
2. `env.[环境]`
3. `env.[环境].local`

可参考 [`.env.example`](/Users/ouyangwenhu/代码/yuumi/packages/server/.env.example)。

## 一键启动命令

```bash
# 开发环境（watch）
bun run dev

# 开发环境（非 watch）
bun run start:dev

# 测试环境
bun run start:test

# 生产环境
bun run start:prod
```
