---
name: es-server-code-review
description: Use when reviewing code, diffs, PRs, or modules in the `es-server` monorepo and you must produce a strict Chinese review that re-reads every applicable `AGENTS.md` plus every document under `.trae/rules/`, audits both code-spec violations and real defects, completes the full review matrix, and keeps reviewing until every rule lane, code path, and bug-hunt lane in scope has been checked.
---

# ES Server Code Review

## Core Contract

- 始终先读规范，再读代码，再下结论。
- 始终使用简体中文输出；仅在文件路径、符号名、命令、错误码等必须保留原文时使用英文。
- 始终把“规范问题”和“缺陷 / 风险问题”当成两条并行主线；不要只找 bug，也不要只看风格。
- 始终建立显式审查矩阵，并在矩阵全部完成前继续审查。
- 始终给每条问题补齐证据：`file:line`、违反的规范或前提、影响、修复方向。
- 始终把“已发现高优问题”“已经足够阻塞”“看起来差不多”视为继续审查信号，而不是结束信号。
- 若某一处链路暂时卡住，先记录阻塞，再继续审查其余所有规则项、代码路径和 bug-hunt 车道；不要因为单点阻塞提前收尾。
- 若未完成全部规则项、范围内代码与必要上下游检查，就明确说明“审查未完成”；不要伪装成已完成结论。

## Mandatory Reading Order

1. 重读当前作用域内全部适用的 `AGENTS.md`，至少包括仓库根的 `../../../AGENTS.md`。
2. 不按任务大小裁剪，完整重读 `../../../.trae/rules/` 下的全部规范文档：
   - `../../../.trae/rules/PROJECT_RULES.md`
   - `../../../.trae/rules/01-import-boundaries.md`
   - `../../../.trae/rules/02-controller.md`
   - `../../../.trae/rules/03-dto.md`
   - `../../../.trae/rules/04-typescript-types.md`
   - `../../../.trae/rules/05-comments.md`
   - `../../../.trae/rules/06-error-handling.md`
   - `../../../.trae/rules/07-drizzle.md`
   - `../../../.trae/rules/08-testing.md`
3. 重读 `./references/review-matrix.md`，把它当成强制检查表，而不是参考提示。
4. 只有在上述材料读完后，才开始读取目标代码、上下游调用点、DTO、类型、schema、migration 与测试。

## Review Matrix Protocol

- 先建立矩阵，再启动代码审查。
- 给每个规则文档、每条 bug-hunt 车道、每个代码范围条目标记状态：`未开始`、`进行中`、`已完成`、`阻塞`。
- 对每个规则文档至少留下 1 条“已检查证据”或 1 条明确 finding；不能只报问题、不记录覆盖情况。
- 把“模块本体、上下游调用点、DTO、类型、schema、migration、测试、通知/计数/权限/审核链路”都列入矩阵。
- 直到矩阵中的规则项、代码范围和 bug-hunt 车道全部变成 `已完成`，才允许结束审查。

建议使用下列最小模板记录矩阵：

```md
## 审查矩阵

### 规则文档

- PROJECT_RULES.md：未开始 / 进行中 / 已完成 / 阻塞
- 01-import-boundaries.md：...
- 02-controller.md：...
- 03-dto.md：...
- 04-typescript-types.md：...
- 05-comments.md：...
- 06-error-handling.md：...
- 07-drizzle.md：...
- 08-testing.md：...

### 代码范围

- 模块本体：...
- 上游调用点：...
- 下游消费者：...
- DTO：...
- types：...
- schema：...
- migration：...
- tests：...

### Bug-Hunt 车道

- 规范违例：...
- 用户可感知 bug：...
- 权限与审核：...
- 通知与去重：...
- 事务与计数：...
- schema 与 migration：...
- 错误语义：...
- 测试缺口：...
```

## Scope Expansion

- 先根据用户给定范围定位 owner 文件，不依赖 barrel、README 或过期文档描述。
- 默认把审查范围扩到“变更点 + 同模块关键上下游 + 相关 DTO / type / schema / migration / spec”。
- 若用户只给一个文件，也要继续检查该文件绑定的 contract、调用链、测试和持久化层；不要只盯住单文件表面。
- 若用户给的是 diff / PR，先审 diff，再沿着真实 owner 文件把影响链路补齐。

## Review Execution Order

1. 用 `rg`、最小必要文件读取和真实 owner 文件定位，画出本次审查范围。
2. 逐份规范文档执行规范审查：
   - 明确该规则在本次范围内对应哪些文件和符号。
   - 逐项判断是否符合规范。
   - 记录规范问题，或记录“已检查但未发现规范问题”的证据。
3. 单独执行缺陷审查，不得拿规范审查代替缺陷审查：
   - 找用户可感知 bug、契约回归、错误语义错误、权限 / 审核问题、通知问题、事务 / 计数问题、schema / migration 漏洞、测试缺口。
   - 对需要闭合证据的问题，继续追调用点、消费者、factory、query、schema、spec，直到证据链闭合。
4. 对每条发现的问题，补齐行号、影响和修复方向。
5. 对尚未完成的矩阵项继续推进，直到全部完成；发现 P0 / P1 / P2 都不是停止条件。

## What Counts As A Normative Finding

- 报告明确违反 `.trae/rules/*` 或 `AGENTS.md` 的实现，即使它暂时还没有触发线上故障。
- 报告会制造契约漂移、错误语义漂移、分层失真、schema 脱节、测试缺口或维护风险的规范硬违例。
- 不要把“只是风格不同”包装成问题；只有违反规范、破坏一致性、或已经造成风险时才报告。
- 若同一处同时属于规范问题和缺陷问题，优先按主要性质归类，并在描述里注明另一侧影响。

## Bug-Hunt Focus

- 优先检查用户可感知行为、对外 contract、DTO / type / schema 对齐、错误码与异常类型、权限和审核态、通知去重、事务原子性、计数一致性、migration 历史数据风险。
- 对读接口里的附带写入、降级逻辑、幂等与补偿链路保持高度敏感。
- 对“规范没错但业务不闭合”的实现照样报告，不要被规则清单束缚住。

## Output Contract

- 始终先给 findings，再给总结。
- 始终使用中文标题与中文结论。
- 始终先交代覆盖情况，例如：`Rules checked: 9/9`、`Bug-hunt lanes checked: 8/8`、`Scope completion: complete`。
- 始终把输出拆成两个 finding 区域：
  - `一、规范问题`
  - `二、缺陷 / 风险问题`
- 若某个区域没有问题，明确写出 `未发现规范问题` 或 `未发现缺陷 / 风险问题`；不要省略该区域。
- 每条 finding 至少包含：
  - 严重程度，例如 `P1` / `P2` / `P3`
  - `file:line`
  - 违反的规范或业务前提
  - 影响 / 风险
  - 简短修复方向
- findings 之后再输出：
  - `三、审查矩阵完成情况`
  - `四、开放问题 / 假设`
  - `五、剩余风险 / 测试缺口`
- 若运行在支持 inline review comment 的环境里，对每条有效 finding 同步输出中文 inline comment。

## Stop Conditions

- 不要因为已经发现阻塞问题、问题数量足够多、或某个文件明显有错就提前结束。
- 不要因为某一条规则已经命中问题，就跳过其余规则文档。
- 不要因为某个模块已有严重缺陷，就跳过其余上下游、DTO、type、schema、migration 或测试。
- 只有当以下条件同时满足时，才允许宣布审查完成：
  - 9 份规范文档全部对照完成；
  - 审查范围内的代码与必要上下游全部检查完成；
  - bug-hunt 车道全部检查完成；
  - 输出中已经说明开放问题、剩余风险与测试缺口。

## Review Bar

- 发现明确规范违例时，直接报“规范问题”，不要等它演化成 bug 才提。
- 发现对线上行为、对外 contract、数据一致性、权限可见性、通知正确性有影响的问题时，默认按高风险处理。
- 发现规范与当前稳定契约冲突时，按仓库决策顺序处理：兼容性优先，但必须在结论里明确写出冲突点和暂行判断。
- 若最终未发现问题，也要明确写出：
  - `未发现规范问题`
  - `未发现缺陷 / 风险问题`
  - 仍然存在的剩余风险或未验证点
