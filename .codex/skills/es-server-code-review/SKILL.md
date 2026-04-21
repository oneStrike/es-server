---
name: es-server-code-review
description: Use when reviewing code, diffs, PRs, or modules in the `es-server` monorepo and you must produce a strict Chinese normative review that re-reads every applicable `AGENTS.md` plus every document under `.trae/rules/`, expands each rule point into an explicit checklist, checks every applicable rule point against the real owner files and related DTO/type/schema/migration/test surfaces, and does not finish until every rule point is closed with evidence, a justified not-applicable decision, or an explicit blocker.
---

# ES Server Code Review

## Core Contract

- 始终先读规范，再读代码，再下结论。
- 始终使用简体中文输出；仅在文件路径、符号名、命令、错误码等必须保留原文时使用英文。
- 始终只做规范审查；不要额外扩展成独立的非规范检查。只有当某个问题本身明确违反 `AGENTS.md` 或 `.trae/rules/*` 的约束时，才把它作为 finding 报告。
- 始终建立显式“规则点矩阵”，最小单位是“单条规范点”，不是“单份规范文件”。
- 始终把 `.trae/rules/` 当前全部规范文件中的全部规范点纳入矩阵；若目录新增文档或某份文档新增规则点，先补矩阵，再开始审查。
- 始终为每个规则点留下闭合状态：`已完成`、`不适用`、`阻塞`；`不适用` 必须写原因，`阻塞` 必须写缺失信息与下一步。
- 始终给每条规范问题补齐证据：`file:line`、违反的规则点、影响 / 一致性风险、修复方向。
- 始终把“已发现高优规范问题”“数量已经够多”“看起来差不多”视为继续审查信号，而不是结束信号。
- 若某一处链路暂时卡住，先记录阻塞，再继续推进其余规则点与代码面；不要因为单点阻塞提前收尾。
- 若矩阵中仍有未闭合条目，就明确说明“审查未完成”；不要伪装成已完成结论。

## Mandatory Reading Order

1. 重读当前作用域内全部适用的 `AGENTS.md`，至少包括仓库根的 `../../../AGENTS.md`。
2. 不按任务大小裁剪，完整重读 `../../../.trae/rules/` 下当前存在的全部规范文档；当前基线包括：
   - `../../../.trae/rules/PROJECT_RULES.md`
   - `../../../.trae/rules/01-import-boundaries.md`
   - `../../../.trae/rules/02-controller.md`
   - `../../../.trae/rules/03-dto.md`
   - `../../../.trae/rules/04-typescript-types.md`
   - `../../../.trae/rules/05-comments.md`
   - `../../../.trae/rules/06-error-handling.md`
   - `../../../.trae/rules/07-drizzle.md`
   - `../../../.trae/rules/08-testing.md`
   - 若目录中新出现其他规范文档，必须一并纳入本次审查。
3. 重读 `./references/review-matrix.md`，把它当成“规则点展开与闭合协议”，而不是可选参考。
4. 只有在上述材料读完，并把工作矩阵展开到“规则点”粒度后，才开始读取目标代码、上下游调用点、DTO、类型、schema、migration 与测试。

## Rule-Point Matrix Protocol

- 先建立矩阵，再启动代码审查。
- 使用 `./references/review-matrix.md` 作为底稿：先按其中的“规则点展开清单”把每份规范文档的全部规范性 bullet 展开成独立条目，再开始检查代码。
- 允许的工作状态为：`未开始`、`进行中`、`已完成`、`不适用`、`阻塞`；宣布审查完成前，只允许剩下 `已完成` 与 `不适用`。
- 每条规则点至少记录：
  - 来源文档与小节
  - 规则点原文或等义转述
  - 适用文件 / 符号 / 链路
  - 证据或不适用理由
- 每份规范文档只有在其全部规则点都闭合后，才允许标记为完成；禁止文件级空泛勾选。
- `正反例`、`示例` 只可用于解释和取证，不能替代规则点本身。
- 若审查过程中发现 `.trae/rules/` 与参考矩阵不一致，先同步补齐工作矩阵，再继续审查。

## Scope Expansion

- 先根据用户给定范围定位真实 owner 文件，不依赖 barrel、README 或过期文档描述。
- 默认把审查范围扩到“变更点 + 同模块关键上下游 + 相关 DTO / type / schema / migration / spec”，以便把适用规则点真正闭合。
- 若用户只给一个文件，也要继续检查该文件绑定的 contract、调用链、测试与持久化层；不要只盯住单文件表面。
- 若用户给的是 diff / PR，先审 diff，再沿着真实 owner 文件把影响链路补齐。
- 不为做泛化排查而无限扩范围；只在闭合具体规则点所必需的代码面上扩展。

## Review Execution Order

1. 用 `rg`、最小必要文件读取和真实 owner 文件定位，画出本次审查范围。
2. 逐份重读适用 `AGENTS.md` 与 `.trae/rules/*`；若规则文件新增、删减或改写，先把工作矩阵同步到最新规则点。
3. 复制 `./references/review-matrix.md` 的工作模板，把每份规范文档中的每条规范性 bullet 展开成独立规则点条目。
4. 逐条执行规范审查：
   - 明确该规则点在本次范围内对应哪些文件、符号、链路。
   - 检查真实 owner 文件与直接相关代码面。
   - 记录 `已完成`、`不适用` 或 `阻塞`，并补充证据 / 理由。
5. 若某个规则点命中了规范问题，继续沿该规则点覆盖到直接相关的同模块 / 同链路实现，避免同类点位遗留未查。
6. 规则点全部闭合后，再回看代码范围矩阵，确认模块本体、上下游、DTO、types、schema、migration、tests 都已按适用规则点检查到位。
7. 最后输出 findings、覆盖情况、开放问题与剩余风险；若仍有未闭合条目，明确标注审查未完成。

## What Counts As A Normative Finding

- 明确违反 `AGENTS.md` 或 `.trae/rules/*` 的实现，即使它暂时还没有触发线上故障。
- 会制造契约漂移、错误语义漂移、分层失真、schema 脱节、测试缺口或维护风险的规范硬违例。
- 不要把“只是风格不同”包装成问题；只有违反规范、破坏一致性、或已经形成规则层风险时才报告。
- 若某个现象同时表现为行为异常与规范违例，仍然只按“违反了哪条规范”来归档和论证；不要额外创建第二条问题分类。

## Output Contract

- 始终先给 findings，再给总结。
- 始终使用中文标题与中文结论。
- 始终先交代覆盖情况，例如：`Rules checked: 9/9`、`Rule points closed: 73/73`、`Scope completion: complete`。
- findings 区域固定为：
  - `一、规范问题`
- 若没有问题，明确写出 `未发现规范问题`；不要省略该区域。
- 每条 finding 至少包含：
  - 严重程度，例如 `P1` / `P2` / `P3`
  - `file:line`
  - 违反的规则点
  - 影响 / 一致性风险
  - 简短修复方向
- findings 之后再输出：
  - `二、规则点覆盖完成情况`
  - `三、开放问题 / 假设`
  - `四、剩余风险 / 未闭合项`
- 若运行在支持 inline review comment 的环境里，对每条有效 finding 同步输出中文 inline comment。

## Stop Conditions

- 不要因为已经发现阻塞问题、问题数量足够多、或某个文件明显有错就提前结束。
- 不要因为某条规则已经命中问题，就跳过其余规则点。
- 不要因为某个模块已有明显违例，就跳过其余上下游、DTO、type、schema、migration 或测试代码面。
- 只有当以下条件同时满足时，才允许宣布审查完成：
  - `.trae/rules/` 当前全部规范文档都已对照完成；
  - 每份规范文档中的规则点都已闭合；
  - 审查范围内的必要代码面都已检查完成；
  - 输出中已说明覆盖情况、开放问题与剩余风险；
  - 矩阵中不再存在 `未开始`、`进行中`、`阻塞` 条目。

## Review Bar

- 发现明确规范违例时，直接报“规范问题”，不要等它演化成业务故障才提。
- 发现规范与当前稳定契约冲突时，按仓库决策顺序处理：兼容性优先，但必须在结论里明确写出冲突点与暂行判断。
- 若最终未发现问题，也要明确写出：
  - `未发现规范问题`
  - 仍然存在的剩余风险、未验证点或不适用条目的理由
