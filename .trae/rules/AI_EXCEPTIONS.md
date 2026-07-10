# AI 已知例外

本文件只记录当前仍有效的现实差距。

- 它不是放宽规则的许可，也不得用于新增同类债务。
- 当前零债务 development epoch 已把下列差距纳入闭集；执行者应按阶段关闭，不得把“仓库目前如此”解释成目标状态。
- 仓库现状变化时，与相关规则或配置同轮更新本文件。

## TypeScript / ESLint 基线差距

- 当前状态：canonical strict/完整范围/`skipLibCheck: true` 合同已由 `pnpm type-check` 与 scope gate 激活，当前 854 个第一方使用点错误因此显式阻断；`no-unsafe-*` lint 严重级别仍待 Phase 1 收口。纪元起点源码按目标 strict 选项回放为 843 个第一方错误，两份会掩盖错误的 Fastify `.d.ts` shim 已删除。
- 关联规则：[04-typescript-types.md](./04-typescript-types.md)、[08-testing.md](./08-testing.md)。
- 处理：新增/修改代码遵循严格目标；Phase 1 扩大 canonical `pnpm type-check` 并把第一方错误归零。canonical 配置固定 `skipLibCheck: true`，第三方 `.d.ts` 文件体内诊断非阻断；不得新增路径/文件/错误码 skip、永久 suppress 或窄 `include`。
- 禁止以关闭第三方声明诊断为由 patch 依赖、增加 shim、维护 fork、引入 compatibility 层或建立逐错误白名单；Drizzle RC4 + RQBv2 保持唯一 ORM 主路径。第一方使用点暴露的类型错误仍必须修复。
- 关闭条件：第一方 `apps/libs/db/scripts/test/config/root-config` 的 strict tsc 为 0 error，canonical `skipLibCheck: true` 与 unsafe lint 全部生效；第三方包自身 `.d.ts` 诊断不属于关闭条件。

## 测试工具链过渡差距

- 当前状态：纪元起点的长期测试为 0；仓库已有 Jest、ts-jest、Supertest 和 `jest.config.cjs`，但分层长期测试、Jest 30 + SWC 与 `test:*`/`pnpm check` 聚合入口尚未完成。
- 关联规则：[08-testing.md](./08-testing.md)、[AGENTS.md](../../AGENTS.md)。
- 处理：从当前 epoch 起允许且要求提交有回归价值的长期测试；不得继续删除它们。Phase 1 统一 Jest 30 + SWC，脚本就绪前使用当前可执行的定点 Jest/tsc/build 入口并记录命令。
- 关闭条件：unit/integration/e2e/architecture/performance 入口、覆盖率与 CI 门禁全部可运行，ts-jest 删除。

## NestJS 架构基线差距

- 当前状态：纪元起点存在 10 个自定义 global、`ModuleRef strict:false`、provider 重复注册、package SCC、HTTP global 与 WS transport 隐式耦合。
- 关联规则：[09-nestjs-architecture.md](./09-nestjs-architecture.md)、[01-import-boundaries.md](./01-import-boundaries.md)。
- 处理：只允许按唯一 DAG 删除边和显式装配；不得新增 `forwardRef()`、service locator、中央万能 port 或新的 business global 作为过渡方案。
- 关闭条件：architecture gate 证明 0 business global、0 strict:false、0 duplicate provider、0 runtime SCC，HTTP/WS composition e2e 通过。

## Development epoch migration 例外

- 当前状态：仓库有 127 条 migration 历史；常规 append-only 规则与当前一次性 baseline reset 授权同时存在。
- 关联规则：[07-drizzle.md](./07-drizzle.md)、[07-drizzle-operations.md](./07-drizzle-operations.md)、[零债务开发纪元 ADR](../../docs/architecture/zero-debt-development-epoch.md)。
- 处理：只有本 epoch 在 schema/index/comments 冻结、三重 guard 与 Gate A/B/C 全部通过后才能删除旧链并重建已授权 dev/test 数据库。普通任务继续 append-only。
- 关闭条件：唯一 baseline 固化、目标开发库重建、完成 tag 与证据记录后，删除本节并恢复无例外 append-only。

## Drizzle RC 风险

- 当前状态：目标主路径按 npm 正式 `rc` dist-tag 精确锁定 Drizzle ORM RC4 / Kit RC3 与 RQBv2；两个包的 RC 序号不要求相同，RC 的上游变化属于外部风险，不计入实现 debt 清零。
- 关联规则：[07-drizzle.md](./07-drizzle.md)。
- 处理：冻结 lockfile，`db/core` owner 每 30 天复核；GA 或安全/正确性修复发布后 14 天内建立升级计划，不跟随浮动 tag。
- 关闭条件：升级到经验证的稳定版本，或以新证据形成有到期日的后续 ADR。

## Git hooks 存在但不保证已安装

- 当前状态：仓库配置了 `simple-git-hooks`、`lint-staged` 与 `commitlint`，本地是否生效取决于安装状态。
- 处理：不得把 hook 当作跳过手工验证的理由；交付前主动运行规则要求的命令。

## POST 200 / 201 约定

- 当前状态：平台层把未显式声明状态码的 `POST` 成功响应归一为 `200`；创建/上传等明确需要 `201` 的接口才使用 `@HttpCode(201)` 并同步 Swagger。
- 关联规则：[02-controller.md](./02-controller.md)、[06-error-handling.md](./06-error-handling.md)。
- 处理：不要机械补 `@HttpCode(200)`；状态变化必须同步 canonical contract 与永久 HTTP e2e。

## Markdown 文档检查路径

- 当前状态：`eslint.config.mjs` 忽略 `docs/**`；Markdown 默认使用 `pnpm exec prettier --check <files...>`。
- 关联规则：[AGENTS.md](../../AGENTS.md)、[08-testing.md](./08-testing.md)。
- 处理：不要把 ESLint 当 Markdown 默认检查；规则文档除 Markdown 检查外，仍按 AGENTS 补仓库级基线验证。
