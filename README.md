# Server

## 环境变量文件约定

仅使用以下文件名：

- `.env`
- `.env.development` / `.env.test` / `.env.production`
- `.env.local`
- `.env.development.local` / `.env.test.local` / `.env.production.local`

加载顺序（后者覆盖前者）：

1. `.env`
2. `.env.[环境]`
3. `.env.local`
4. `.env.[环境].local`

可参考 [`.env.example`](/Users/ouyangwenhu/代码/yuumi/packages/server/.env.example)。

其中 `API_PREFIX` 为对外业务根路由前缀（例如 `/api`）。

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

## 契约文档与错误码文档

```bash
# 生成响应码文档（docs/response-codes.md）
bun run docs:response-codes
```

## 开发手册

- [`docs/response-code-error.md`](/Users/ouyangwenhu/代码/yuumi/packages/server/docs/response-code-error.md)：`ResponseCodeError` 使用规范与示例
