# AI 已知例外

本文件只记录当前仍有效的现实例外与配置差距。

- 它不是放宽规则的许可。
- 除非任务明确要求，否则不要在普通任务里顺手修这些差距。
- 仓库现状变化时，与相关规则或配置同轮更新本文件。

## TypeScript / ESLint 基线差距

- 当前状态：
  - `tsconfig.json` 中 `noImplicitAny` 目前为 `false`
  - `tsconfig.json` 中 `forceConsistentCasingInFileNames` 目前为 `false`
  - `eslint.config.mjs` 中 `@typescript-eslint/no-unsafe-*` 目前为 `warn`
- 关联规则：
  - [04-typescript-types.md](./04-typescript-types.md)
- 默认处理：
  - 新增 / 修改代码仍按规则意图收紧；不要把这些差距当作放宽类型安全的理由。
  - 普通业务任务里不要顺手做整仓基线改造。
- 升级条件：
  - 任务本身就在收紧类型基线
  - 或既有配置差距已经直接阻碍当前改动的正确性

## 测试依赖与测试文件策略

- 当前状态：
  - 仓库安装了 `jest`、`ts-jest`、`supertest` 等测试依赖，也存在 `jest.config.cjs`
  - 但仓库不保留任何长期测试文件，也没有默认的 `pnpm test` 脚本作为交付入口
- 关联规则：
  - [08-testing.md](./08-testing.md)
  - [AGENTS.md](../../AGENTS.md)
- 默认处理：
  - 需要时可以临时创建测试文件或探针，验证后删除。
  - 不要因为存在 Jest 依赖和配置，就推断仓库允许保留长期测试文件。
  - 不要把 `pnpm test` 当默认交付命令。
- 升级条件：
  - 当前问题无法通过 `type-check`、静态检查、真实调用链或人工步骤证明
  - 或任务明确要求改进测试工作流

## Git hooks 存在但不保证已安装

- 当前状态：
  - 仓库配置了 `simple-git-hooks`、`lint-staged` 和 `commitlint`
  - 但 hooks 是否在本地实际生效，取决于开发环境是否已安装
- 关联规则：
  - [AGENTS.md](../../AGENTS.md)
- 默认处理：
  - 不要把“提交时 hook 会兜底”当作跳过手工验证的理由。
  - 交付前仍要主动运行需要的验证命令。
- 升级条件：
  - 任务明确涉及 commit 规范、hook 安装或本地质量门禁

## POST 200 / 201 约定

- 当前状态：
  - 平台层会把未显式声明状态码的 `POST` 成功响应归一为 `200`
  - 只有创建 / 上传等需要保留 `201` 的接口，才显式使用 `@HttpCode(201)`，并同步 Swagger
- 关联规则：
  - [02-controller.md](./02-controller.md)
  - [06-error-handling.md](./06-error-handling.md)
- 默认处理：
  - 不要出于“REST 习惯”机械补 `@HttpCode(200)`。
  - 改动 `POST` 成功状态时，把 Controller 规则和错误处理规则一起看。
- 升级条件：
  - 既有客户端 contract 明确依赖 `201`
  - 或任务本身就是调整成功响应状态语义

## migration、seed 与 bootstrap 边界

- 当前状态：
  - 结构变更必须落为 migration，不走 `drizzle-kit push`
  - demo seed 是显式、破坏性的本地数据脚本
  - 生产 / 准生产初始化走独立 bootstrap 命令，不复用 demo seed
- 关联规则：
  - [07-drizzle.md](./07-drizzle.md)
- 默认处理：
  - 不要把 seed 当成 migration，也不要把 bootstrap 当成 demo seed 的别名。
  - 遇到 migration 生成交互时，停止并让用户亲自决定。
- 升级条件：
  - schema 变更需要手写数据迁移
  - 或工具生成流程进入交互式分支

## Markdown 文档检查路径

- 当前状态：
  - `eslint.config.mjs` 忽略了 `docs/**`
  - 仓库级规则已明确：Markdown 文档默认使用 `pnpm exec prettier --check <files...>` 检查
- 关联规则：
  - [AGENTS.md](../../AGENTS.md)
  - [08-testing.md](./08-testing.md)
- 默认处理：
  - 不要把 ESLint 当作 Markdown 文档的默认检查路径。
  - 改动规则文档时，除了 Markdown 检查，仍按 `AGENTS.md` 补仓库级基线验证。
- 升级条件：
  - 文档与代码现状冲突，需要同轮修正文档与实现
