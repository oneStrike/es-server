# AGENTS

适用范围：本仓库内的所有人类贡献者与 AI agent。

本文件只定义项目级最小约束、验证基线与交付要求。规范事实源已统一收敛至 `.trae/rules/PROJECT_RULES.md`。

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
- 仓库内正式 `*.spec.ts` 是长期资产，不因任务完成而删除；只删除临时探针、一次性脚本或明确标记为临时的验证文件。
- 导入路径遵循 `PROJECT_RULES.md`：业务域代码默认直连 owner 文件，不新增仅做转发的 barrel；`libs/platform` 可保留受控目录级 public API。

## 3. 验证基线

- 仅文档改动：至少运行与改动文件直接相关的检查。Markdown 文档默认使用 `pnpm exec prettier --check <files...>`。
- 规则、规范或仓库级文档改动：除文档检查外，再运行一次 `pnpm type-check`，确认仓库基线未被破坏。
- 代码改动：`pnpm type-check` 是底线；行为、契约、错误语义或事务语义发生变化时，再补充对应范围的 `pnpm test -- --runInBand --runTestsByPath ...` 或 `pnpm test`。
- `pnpm test:e2e` 当前不作为默认验证命令；在配置恢复前，不得把它写成“默认可用”。

## 4. 提交与交付

- 提交信息遵循 Conventional Commits。
- 仓库当前没有 `pnpm run commit` 脚本；使用普通 `git commit` 即可。
- 仓库内存在 `.husky/pre-commit` 与 `.husky/commit-msg` 文件，但是否在本地生效取决于 Git hooks 配置；不要把“钩子会自动兜底”当作跳过手工验证的理由。
- 声称“已修复”“已完成”“测试通过”之前，必须先运行对应验证命令，并以最新输出作为证据。
