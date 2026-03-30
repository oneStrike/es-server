# Task 与成长奖励整改执行计划

## 1. 文档目标

本文是本轮 `task` 模块状态流转整改与成长奖励规则收口的唯一排期事实源。

本文负责回答：

1. 当前任务优先级是什么
2. 任务有哪些依赖
3. 建议按什么波次推进
4. 当前状态与变更记录是什么

## 2. 优先级定义

- `S0`：立即执行，直接影响正确性、并发安全、奖励时机或上线可用性
- `S1`：高优先，直接影响解释力与回归完整度
- `S2`：中优先，属于后续补强项，不是当前 blocker
- `S3`：后置优先，价值明确但不属于本轮必须项

## 3. 依赖说明

- `硬前置`：不完成前通常不建议开工
- `软前置`：建议先完成，但不是绝对 blocker
- `直接后置`：完成后最直接解锁的后续事项
- `可并行`：语义与写入面基本独立，可并行推进

## 4. 任务总表

| 任务 | 优先级 | 硬前置 | 软前置 | 直接后置 | 可并行 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| `P0-06` 任务状态流转与并发审计收口 | `S0` | 无 | 无 | 本轮 checklist 验收与回归收尾 | 无 | `completed` |
| `P0-07` 成长规则值语义与校验对齐 | `S0` | 无 | `P0-06` | task 奖励治理边界决策 | 无 | `completed` |

## 5. 推荐实施波次

### Wave 1：先修主链路正确性

- `P0-06`
- `P0-07`

说明：

- 先修 `MANUAL / AUTO` 完成模式分流
- 再修发布时间窗口与周期过期
- 同轮补齐并发审计一致性与自动化测试
- 同轮收口积分/经验规则的正整数语义与规则类型校验一致性

## 6. 状态定义

- `pending`：已确认范围，尚未开始实施
- `in_progress`：已进入代码整改或测试补齐
- `completed`：代码、测试、文档与清单均已完成
- `blocked`：因外部依赖或决策未完成而暂停

## 7. 状态变更记录

| 日期 | 任务 | 状态变更 | 说明 |
| --- | --- | --- | --- |
| `2026-03-30` | `P0-06` | `pending` | 基于 task 模块代码排查结果新建整改任务 |
| `2026-03-30` | `P0-06` | `completed` | 已完成代码整改、主链路测试、eslint 与 tsc 校验 |
| `2026-03-30` | `P0-07` | `in_progress` | 新增成长规则值语义与校验一致性整改任务，并进入实施 |
| `2026-03-30` | `P0-07` | `completed` | 已完成规则值/规则类型校验收口，并通过相关单测、eslint 与 tsc 校验 |

## 8. 并行原则

- 本轮已有两个 `P0` 主任务，建议继续按 `P0-06 -> P0-07` 串行推进，避免状态流转整改与规则语义整改相互干扰。
- 若实施时需要拆分代码工作，可以在代码层并行，但文档层继续保持单任务闭环。

## 9. 变更入口

- 若任务边界变化，优先修改对应任务单：
  - [06-task-state-flow-and-audit-correction.md](./p0/06-task-state-flow-and-audit-correction.md)
  - [07-growth-rule-semantics-and-validation-alignment.md](./p0/07-growth-rule-semantics-and-validation-alignment.md)
- 若优先级、依赖、波次或状态变化，只修改本文
- 若验收标准或证据位变化，只修改对应 checklist：
  - [final-acceptance-checklist.md](./checklists/final-acceptance-checklist.md)
  - [growth-rule-semantics-and-validation-checklist.md](./checklists/growth-rule-semantics-and-validation-checklist.md)
