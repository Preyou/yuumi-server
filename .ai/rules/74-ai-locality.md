# P1-AI-LOCALITY

Priority: P1
Scope: `packages/server/.ai/**`

## Rule
- 服务端 `.ai` 规则与技能必须保持在 `packages/server/.ai/**` 内自洽。
- 不得引用 `packages/web/.ai/**`、仓库根目录 `.ai/**` 或根目录 `skills/**` 作为服务端 AI 工作流的必需依赖。
- 若服务端需要复用其他工作区已有的 AI 能力，应在 `packages/server/.ai/**` 内维护一份本地副本，再按服务端上下文独立演进。
- 允许引用服务端源码、脚本、文档与运行时路径，但 AI 规则和技能说明本身不得依赖外部工作区的 AI 文件。

## Non-Goals
- 不禁止服务端代码依赖共享运行时事实或公开接口契约。
- 不要求重复复制与 AI 工作流无关的普通项目文件。

## Exceptions
- 无。

## Checks
- 检查 `packages/server/.ai/INDEX.md`、`packages/server/.ai/rules/*.md`、`packages/server/.ai/skills/**` 中是否出现跨到 `packages/web/.ai/**`、根目录 `.ai/**` 或根目录 `skills/**` 的依赖引用。
- 若服务端与其他工作区需要同类技能，检查服务端是否拥有自己的本地技能文件。
