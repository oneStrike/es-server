# P0-06 任务状态流转与并发审计收口

## 目标

修正 `task` 模块当前已确认的状态流转偏差，确保 assignment 状态、奖励触发时机、过期边界与进度审计日志保持一致。

## 范围

- 收口 `AUTO / MANUAL` 两种完成模式的真实状态迁移语义
- 补齐 `claim / progress / complete` 对发布时间窗口的统一约束
- 让重复任务 assignment 具备按周期结束的过期语义
- 修正乐观锁冲突下的进度日志与完成日志污染
- 补齐任务主链路自动化测试

## 当前代码锚点

- `libs/growth/src/task/task.service.ts`
- `libs/growth/src/task/task.service.spec.ts`
- `libs/growth/src/task/task.constant.ts`
- `libs/growth/src/task/dto/task.dto.ts`
- `apps/app-api/src/modules/task/dto/task.dto.ts`
- `db/schema/app/task-assignment.ts`

## 非目标

- 不扩展 `rewardConfig` 到 `points / experience` 之外的新奖励类型
- 不引入独立 settlement 表或新的任务事实表
- 不建设跨内容域事件自动推进能力
- 不重做通知模板、治理总线或事件中心

## 主要改动

- `reportProgress()` 只允许 `AUTO` 模式在达标时自动进入 `COMPLETED`
- `MANUAL` 模式达标后保持“已达标但未完成”，必须经 `/complete` 才能完成与发奖
- `claim / progress / complete` 统一复用发布时间窗口校验
- 重复任务 assignment 的 `expiredAt` 改为由周期边界与 `publishEndAt` 共同裁剪
- 乐观锁更新未命中时不写 `task_progress_log`
- 增加主链路测试，覆盖完成模式、并发冲突、发布时间窗口与周期过期

## 完成标准

- `MANUAL` 任务在 `progress` 达到 `target` 后不会直接进入 `COMPLETED`
- `AUTO` 任务首次达标时只完成一次，重复请求不会额外落日志或发奖
- `publishEndAt` 已过的任务在 cron 尚未执行前也无法继续 `progress / complete`
- `DAILY / WEEKLY / MONTHLY` 旧周期 assignment 能在下一周期被稳定关闭
- 乐观锁冲突请求不会留下伪造的 `task_progress_log`
- 自动化测试能覆盖本轮已确认的高风险路径

## 完成后同步文档

- [README.md](../README.md)
- [development-plan.md](../development-plan.md)
- [final-acceptance-checklist.md](../checklists/final-acceptance-checklist.md)

## 排期引用

- 本任务的优先级、依赖关系、波次与状态统一以 [execution-plan.md](../execution-plan.md) 为准
- 若本页与其他文档出现排期描述不一致，以 `execution-plan.md` 为准
