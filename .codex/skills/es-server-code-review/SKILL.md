---
name: es-server-code-review
description: Use when reviewing code in this `es-server` monorepo, especially for `apps/*`, `libs/*`, `db/*`, DTOs, NestJS modules, Drizzle schema, migrations, or business flows. Before every review task, always re-read the applicable `AGENTS.md` and every document under `.trae/rules/`, even for small or single-file reviews. Build an explicit review matrix, continue reviewing after the first findings, and do not finish until every rule lane and bug-hunt lane has been checked. Prioritize surfacing concrete code-spec violations, real bugs, contract regressions, schema drift, wrong error semantics, missing tests, and unreasonable business logic.
---

# ES Server Code Review

## Core Memory

- 先读规范，再下结论；不要靠记忆复述仓库规则。
- 每次任务开启前必须完整重读 `.trae/rules` 全部规范文档；禁止因为“刚读过”或“这次范围小”而跳过。
- 每次审查都必须建立显式审查矩阵；9 份规范文档和各条 bug-hunt 车道都要有检查痕迹。
- 审查的首要目标是发现问题，不是概述代码写了什么。
- 优先发现代码规范问题和真实 bug，再补充业务逻辑、测试与兼容性风险。
- 无论多早发现高优问题，都不能提前结束审查；必须继续查完剩余规范项、链路和 bug 车道。
- 规范符合性和业务逻辑合理性要一起看，不能只看风格或只看运行路径。
- 发现问题时给出精确文件与行号，解释影响，说明为什么是问题。
- 若没有发现问题，也要明确写出“未发现问题”，并补充剩余风险与测试盲区。

## Mandatory Reading Order

1. 先读当前作用域内的 `AGENTS.md`，至少包括仓库根的 `../../../AGENTS.md`。
2. 再完整读完 `../../../.trae/rules/` 下的全部规范文档，不得按任务范围裁剪：
   - `../../../.trae/rules/PROJECT_RULES.md`
   - `../../../.trae/rules/01-import-boundaries.md`
   - `../../../.trae/rules/02-controller.md`
   - `../../../.trae/rules/03-dto.md`
   - `../../../.trae/rules/04-typescript-types.md`
   - `../../../.trae/rules/05-comments.md`
   - `../../../.trae/rules/06-error-handling.md`
   - `../../../.trae/rules/07-drizzle.md`
   - `../../../.trae/rules/08-testing.md`
3. 只有在上述规范全部读完之后，才开始读目标代码与上下游链路。
4. 紧接着读取 `./references/review-matrix.md`，按其中的规范矩阵和 bug-hunt 车道驱动后续审查。

## Review Workflow

1. 先完成 Mandatory Reading Order，不允许先看代码再补规范。
2. 先建立审查矩阵，至少覆盖：
   - 9 份规范文档逐项检查状态
   - 模块本体、上下游调用点、DTO、类型、schema、migration、测试
   - bug-hunt 车道检查状态
3. 再界定审查范围：模块本体、上下游调用点、DTO、类型、schema、migration、测试、通知/计数/权限等相邻链路。
4. 用 `rg` 或最小必要文件读取定位真实 owner 文件，不依赖 barrel 或旧文档描述。
5. 先按规范清单逐项对照，再看业务链路是否闭合，优先抓代码规范问题与 bug：
   - 契约是否稳定，入参/出参/DTO/schema 是否对齐。
   - service / controller / resolver / module 分层是否正确。
   - 错误语义是否符合双层错误模型。
   - Drizzle schema、migration、注释、枚举值域是否一致。
   - 测试是否覆盖行为变更、错误语义、事务与幂等等关键路径。
6. 再专门找真实问题，而不是泛泛建议：
   - 用户可感知 bug
   - 明确的代码规范违例
   - 错误码/异常类型错误
   - 权限、可见性、审核态、通知、计数、事务、幂等、补偿链路错误
   - schema 约束缺失、migration 漏改、历史数据风险
   - DTO / type / 注释 / query 之间的漂移
7. 若某个问题需要证明，继续读调用点、工厂、消费者、schema、spec，直到证据闭合。
8. 发现问题后继续审查，不得因为已经拿到 P1/P2 结论而提前停止；只有当矩阵中的全部规范项和 bug-hunt 车道都完成后，才允许收尾。

## Problem-Finding Checklist

- 先找代码规范硬违例和会导致错误行为、错误数据、错误通知、错误权限、错误契约的缺陷。
- 再找违反仓库规范且会带来漂移、隐藏 bug 或维护风险的问题。
- 对“可能是产品决策”的问题，明确写成问题或开放疑问的分界条件，不要含糊带过。
- 对“只是风格不同”的点保持克制；只有当它违反规范或已经制造风险时才报。

## Output Requirements

- Findings first，按严重程度排序。
- 开头先交代本次审查覆盖情况：`Rules checked: 9/9`，并说明是否存在未覆盖链路。
- 每条 finding 至少包含：
  - `file:line`
  - 违反的规范或业务前提
  - 影响面或具体风险
  - 简短修复方向
- Findings 后再写：
  - 审查矩阵完成情况
  - 假设 / 开放问题
  - 简短总结
  - 剩余风险 / 测试缺口

## Review Bar

- 发现会直接影响线上行为、契约、数据或通知的缺陷时，默认给出阻塞结论。
- 发现 schema / migration / DTO / service 任何一层不同步时，默认按高风险处理。
- 发现缺少关键测试时，不把“目前没炸”当作通过理由。
- 发现已有实现和规范冲突时，按仓库决策顺序处理：运行中的稳定契约优先，但必须在审查结论里明确指出冲突点。
- 即使已经发现足够多的阻塞问题，也不得跳过剩余规范项和 bug-hunt 车道；“继续审完”是强制要求，不是建议。
