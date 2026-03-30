# Task 模块状态流转整改文档集

本目录只承载“`task` 模块状态流转整改”的可执行文档，不替代其他历史方案、总览或长期规划文档。

使用原则：

1. 本目录只覆盖本轮已确认的 `task` 主链路问题。
2. 排期、依赖、波次、状态只在 `execution-plan.md` 维护。
3. `development-plan.md` 只补充执行信息，不重复维护第二套优先级。
4. `checklists/final-acceptance-checklist.md` 只承接验收，不反向定义新范围。
5. 单任务文档必须包含固定章节：`目标 / 范围 / 当前代码锚点 / 非目标 / 主要改动 / 完成标准 / 完成后同步文档 / 排期引用`。

## 文档分工

| 文档 | 角色 | 负责 | 不负责 |
| --- | --- | --- | --- |
| `execution-plan.md` | 唯一排期事实源 | 优先级、依赖、波次、状态、变更记录 | 具体代码改法 |
| `development-plan.md` | 开发执行补充 | 开工条件、改动模块、关键文件、测试点 | 重新定义排期 |
| `p0/*` | 单任务说明 | 目标、范围、非目标、完成标准 | 跨任务验收 |
| `checklists/final-acceptance-checklist.md` | 跨任务验收 | 验收项、证据位、阻塞上线项、签收结论 | 单任务方案定义 |

## 推荐阅读顺序

1. 先看 [execution-plan.md](./execution-plan.md)
2. 再看 [development-plan.md](./development-plan.md)
3. 开工前阅读具体任务单 [06-task-state-flow-and-audit-correction.md](./p0/06-task-state-flow-and-audit-correction.md)
4. 联调与收尾时使用 [final-acceptance-checklist.md](./checklists/final-acceptance-checklist.md)

## 当前任务

### P0

- `p0/06-task-state-flow-and-audit-correction.md`

## 当前问题范围

本轮文档集只覆盖以下已确认问题：

- `MANUAL` 任务在 `progress` 达标时会直接完成并触发奖励
- `reportProgress()` 与 `completeTask()` 在乐观锁冲突时仍会写入进度日志
- 重复任务 assignment 未按周期过期
- `progress / complete` 对发布时间窗口约束不足
- `task_assignment` 状态枚举与真实代码路径存在漂移
- task 主链路自动化测试覆盖不足

## 注意

- 本目录不恢复历史 `task-growth-reward` 全量规划，只重建本轮整改所需的最小合规文档集。
- 若后续追加新的 task 整改项，应先修改 [execution-plan.md](./execution-plan.md)，再新增对应任务单。
