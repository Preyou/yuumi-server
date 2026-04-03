# Domain Create From DB

## Trigger
- 用户要求创建或补全 `src/constants/realtimeDomains.ts`。
- 用户要求“根据数据库定义自动推导数据域”。
- 用户新增/调整数据表后，要求同步产出候选数据域。

## Inputs
- `project`: 服务端项目路径（默认 `packages/server`）。
- `schema_source`: Drizzle schema 源（优先 `src/db/*/schemas/tables.ts`，回退 `drizzle/schema.ts`）。
- `target`: 目标数据域常量文件（默认 `src/constants/realtimeDomains.ts`）。

## Workflow
1. 运行候选生成脚本：
   - `bun packages/server/.ai/skills/domain-create-from-db/scripts/suggest-domains.ts --project packages/server --format markdown`
2. 以每张表评分最高的候选域作为初稿。
3. 对候选做一次语义收敛：
   - 合并同义域，避免同一业务含义出现多个域名。
   - 避免过细粒度拆分，优先稳定业务聚合域。
4. 产出 `REALTIME_DOMAINS` 常量草案并用于统一引用。
5. 回查接口 `domains` 声明，确保仅使用常量，不写裸字符串。

## Output
- 按表分组的数据域候选报告（含评分与理由）。
- 可直接粘贴的 `REALTIME_DOMAINS` 常量草案。

## Guardrails
- 候选域是建议，不直接覆盖业务文件，除非用户明确要求写入。
- 仅把“有副作用的业务聚合”定义为数据域，不按字段一比一拆域。
- 禁止在路由中直接书写字符串数据域，必须来自统一常量。

## Fallback
- 若未找到 `src/db/*/schemas/tables.ts`，回退扫描 `drizzle/schema.ts`。
- 若 schema 信息不足，仅输出 `*.list` / `*.detail` 的低置信度候选并标注原因。

## Examples
- 新增 `orders` 表后，生成 `order.*` 候选域并给出推荐项。
- 调整 `permissions` 表字段后，重新推导 `permission.*` 域并与现有常量比对。
