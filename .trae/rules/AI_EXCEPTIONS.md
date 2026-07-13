# AI 已知例外

本文件只记录当前仍有效的现实差距。

- 它不是放宽规则的许可，也不得用于新增同类债务。
- 下列差距应按既定计划关闭，不得把“仓库目前如此”解释成目标状态。
- 仓库现状变化时，与相关规则或配置同轮更新本文件。

## TypeScript / ESLint 基线差距

- 当前状态：canonical strict/完整范围/`skipLibCheck: true` 合同已由 `pnpm type-check` 与 scope gate 激活，当前 854 个第一方使用点错误因此显式阻断；`no-unsafe-*` lint 严重级别仍待 Phase 1 收口。纪元起点源码按目标 strict 选项回放为 843 个第一方错误，两份会掩盖错误的 Fastify `.d.ts` shim 已删除。
- 关联规则：[04-typescript-types.md](./04-typescript-types.md)、[08-testing.md](./08-testing.md)。
- 处理：新增/修改代码遵循严格目标；Phase 1 扩大 canonical `pnpm type-check` 并把第一方错误归零。canonical 配置固定 `skipLibCheck: true`，第三方 `.d.ts` 文件体内诊断非阻断；不得新增路径/文件/错误码 skip、永久 suppress 或窄 `include`。
- 禁止以关闭第三方声明诊断为由 patch 依赖、增加 shim、维护 fork、引入 compatibility 层或建立逐错误白名单；Drizzle RC4 + RQBv2 保持唯一 ORM 主路径。第一方使用点暴露的类型错误仍必须修复。
- 关闭条件：第一方 `apps/libs/db/scripts/test/config/root-config` 的 strict tsc 为 0 error，canonical `skipLibCheck: true` 与 unsafe lint 全部生效；第三方包自身 `.d.ts` 诊断不属于关闭条件。

## 测试工具链过渡差距

- 当前状态：仓库级硬约束不保留测试文件；因此不以 `test:*`、Jest 聚合或 `pnpm check`
  作为交付入口。可长期保留的是 operation/static gate 与脱敏 `.omx` evidence。
- 关联规则：[08-testing.md](./08-testing.md)、[AGENTS.md](../../AGENTS.md)。
- 处理：临时测试只在系统临时目录或显式 ephemeral location 运行并删除；将可重复的
  contract/DB/performance proof 收敛为受控脚本和 evidence，不得伪造不存在的聚合命令。
- 关闭条件：所有 required gate 均有真实、无隐式写入的 command/evidence，且仓库中没有
  遗留测试文件或临时 probe。

## NestJS 架构基线差距

- 当前状态：纪元起点存在 10 个自定义 global、`ModuleRef strict:false`、provider 重复注册、package SCC、HTTP global 与 WS transport 隐式耦合。
- 关联规则：[09-nestjs-architecture.md](./09-nestjs-architecture.md)、[01-import-boundaries.md](./01-import-boundaries.md)。
- 处理：只允许按唯一 DAG 删除边和显式装配；不得新增 `forwardRef()`、service locator、中央万能 port 或新的 business global 作为过渡方案。
- 关闭条件：architecture gate 证明 0 business global、0 strict:false、0 duplicate provider、0 runtime SCC，HTTP/WS composition e2e 通过。

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
- 处理：不要机械补 `@HttpCode(200)`；状态变化必须同步 canonical contract 与可重复 HTTP 验证，临时代码按 `AGENTS.md` 删除。

## Markdown 文档检查路径

- 当前状态：`eslint.config.mjs` 忽略 `docs/**`；Markdown 默认使用 `pnpm exec prettier --check <files...>`。
- 关联规则：[AGENTS.md](../../AGENTS.md)、[08-testing.md](./08-testing.md)。
- 处理：不要把 ESLint 当 Markdown 默认检查；规则文档除 Markdown 检查外，仍按 AGENTS 补仓库级基线验证。
