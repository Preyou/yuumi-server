# 68 API List Query Policy

Priority: P1  
Scope: `src/plugins/listQueryWhitelist.ts`, `src/services/**`

## Rule
- 列表接口中的查询、排序、过滤能力均采用“显式声明才支持”的策略。
- 对某字段未显式声明支持时，禁止对该字段执行对应操作（查询/排序/过滤）。
- 查询与过滤语义必须区分：
  - 查询（search/query）：面向关键词检索，通常是模糊或多字段匹配。
  - 过滤（filter）：面向结构化条件，按字段精确或范围约束。

## Non-Goals
- 不在本规则中限定具体 SQL 实现（`ILIKE`、全文索引、表达式索引等）。

## Exceptions
- 无。

## Checks
- 新增列表接口时，检查是否声明 `useListQueryWhitelist` 规则。
- 新增字段支持查询/过滤/排序时，检查白名单配置是否同步更新。
