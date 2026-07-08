# AGENTS

适用范围：本仓库内的所有人类贡献者与 AI agent。

本文件只定义项目级最小约束、验证基线与交付要求。规范事实源已统一收敛至 `.trae/rules/PROJECT_RULES.md`。

## AI 快速入口

- 第一次进入仓库、或暂时判断不清本次改动归属时，先读 `.trae/rules/AI_RULE_ROUTER.md`
- 遇到 `owner 文件`、`稳定 contract`、`闭集字段` 这类术语时，读 `.trae/rules/AI_TERMS.md`
- 看到仓库现实与理想规则不完全一致时，先读 `.trae/rules/AI_EXCEPTIONS.md`
- 上述 3 份文档只作导航、释义与例外汇总，不替代 `.trae/rules/PROJECT_RULES.md` 和各专项规则

## 1. 决策顺序

1. 当前可运行的共享抽象、真实脚本与现有对外契约。
2. 本文件。
3. `.trae/rules/PROJECT_RULES.md`。
4. 同一业务域相邻模块的稳定实现。

若规范与当前稳定运行的客户端契约、错误语义、迁移窗口或部署现实冲突，以兼容性优先，并在交付说明中明确记录冲突点与暂行决策。

## 2. 项目级最小约束

- 不要假设 README、脚本名、钩子或历史文档一定准确；发现文档与仓库现状冲突时，必须同步修正文档或代码，而不是沿用失真描述。
- `apps/*` 是入口层；可复用的业务契约与领域逻辑默认落在 `libs/*`，数据库能力落在 `db/*`。
- 影响路由、DTO、分页、错误语义、数据库字段、计数器或迁移策略的改动，必须先对齐 `.trae/rules/PROJECT_RULES.md` 对应规则。
- 仓库不保留任何测试文件；开发中临时新增的 `*.spec.ts`、`*.test.ts`、`*.e2e.spec.ts`、探针脚本或测试目录必须在交付前删除，禁止提交或长期保留。
- 导入路径遵循 `PROJECT_RULES.md`：业务域代码默认直连 owner 文件，不新增仅做转发的 barrel；`libs/platform` 可保留受控目录级 public API。

## 3. 验证基线

- 仅文档改动：至少运行与改动文件直接相关的检查。Markdown 文档默认使用 `pnpm exec prettier --check <files...>`。
- 规则、规范或仓库级文档改动：除文档检查外，再运行一次 `pnpm type-check`，确认仓库基线未被破坏。
- 代码改动：`pnpm type-check` 是底线；行为、契约、错误语义或事务语义发生变化时，再补充对应范围的 lint、build、静态检查或临时测试验证。若临时创建测试文件，验证完成后必须删除。
- `pnpm test`、`pnpm test:cov`、`pnpm test:e2e` 不作为默认交付验证命令；不得以这些命令为理由保留测试文件。

## 4. 提交与交付

- 提交信息遵循 Conventional Commits。
- 仓库当前没有 `pnpm run commit` 脚本；使用普通 `git commit` 即可。
- 仓库通过 `simple-git-hooks` 配置 `pre-commit`（lint-staged）与 `commit-msg`（commitlint）钩子，但本地是否生效取决于 hooks 是否已安装；不要把“钩子会自动兜底”当作跳过手工验证的理由。
- 声称“已修复”“已完成”“验证通过”之前，必须先运行对应验证命令，并以最新输出作为证据。
