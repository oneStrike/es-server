# P1-03 App/Admin 任务读模型与运营视图收口

## 1. 目标

让 App 端、Admin 端、站内通知和用户中心看到的是同一套任务语义，不再出现“接口名叫可领取任务，实际上只是可见目录”或“任务被删了但我的任务里还挂着”等读模型偏差。

## 2. 范围

本任务覆盖以下内容：

- App 端任务接口：
  - `apps/app-api/src/modules/task/task.controller.ts`
  - `apps/app-api/src/modules/task/dto/task.dto.ts`
- Admin 端任务接口：
  - `apps/admin-api/src/modules/task/task.controller.ts`
- 任务服务读模型与列表逻辑：
  - `libs/growth/src/task/task.service.ts`
- 用户中心成长摘要与任务展示关联：
  - `apps/app-api/src/modules/user/user.service.ts`
- 任务提醒、奖励通知与任务列表的一致性输出。

## 3. 当前代码锚点

- `getAvailableTasks()` 与真实“可领取”语义不完全一致；
- `getMyTasks()` 会触发 auto assignment 建立，但历史到期 assignment 的即时收口不足；
- 任务删除或下线后，旧 assignment 仍可能出现在“我的任务”；
- Admin 端目前更像配置入口，缺少“任务目标、奖励、投递、assignment 健康度”的运营视图。

## 4. 非目标

- 本任务不重新设计整个前端页面；
- 不做全新的运营 BI 平台；
- 不在本任务中拆表；
- 不处理消息中心所有通知类型，只处理任务相关读模型的一致性；
- 不做复杂权限系统重构。

## 5. 主要改动

### 5.1 收口 App 端两个列表语义

明确：

- `available tasks`
  - 只表示“当前用户现在还能领取的手动任务”；
  - 必须过滤已领取、已完成、已过期、已下线、已删除记录；
- `my tasks`
  - 完全围绕 assignment；
  - 在读之前先做当前用户级别的即时过期收口；
  - 再补建 auto assignment。

### 5.2 明确任务卡片状态枚举

统一用户可见状态：

- `claimable`
- `claimed`
- `in_progress`
- `completed`
- `reward_pending`
- `reward_granted`
- `expired`
- `unavailable`

要求任务列表、通知、用户中心摘要中的状态解释一致。

### 5.3 清理悬挂 assignment

读模型层必须保证以下场景不会继续暴露脏状态：

- 任务已删除但 assignment 仍活跃；
- 周期切换后旧 assignment 尚未被 cron 收口；
- 任务规则修改导致旧 assignment 不再可匹配；
- 奖励补偿中 assignment 状态与任务列表状态不一致。

### 5.4 提升 Admin 运营视图

Admin 端在不做 BI 平台的前提下，应至少补齐：

- 任务场景类型
- 目标类型与事件码
- 周期规则
- 领取方式 / 完成方式
- 奖励摘要
- 活跃 assignment 数
- 待补偿奖励数
- 最近提醒投递状态摘要

### 5.5 统一用户中心与通知摘要

确保以下面板对任务奖励的解释一致：

- 任务列表
- 任务奖励到账通知
- 用户中心成长资产摘要
- 积分/经验明细

重点要求：

- 同一条任务 bonus 能在通知与账本明细中互相定位；
- 基础奖励与任务 bonus 都到账时，用户能看懂是两笔不同奖励。

## 6. 完成标准

- App 端“可领取任务 / 我的任务”语义清晰且无重复歧义；
- 悬挂 assignment、旧新周期并存等读模型问题被收口；
- Admin 端能看到任务目标、奖励与运行健康度的最小视图；
- 用户通知、任务列表、成长明细之间的状态和奖励说明一致；
- 至少覆盖以下测试：
  - 可领取列表过滤逻辑；
  - 我的任务即时过期收口；
  - 删除/下线任务后的 assignment 展示；
  - 奖励补偿中的状态展示。

## 7. 完成后同步文档

- `docs/task-growth-notification-rearchitecture-work-items/README.md`
- `docs/task-growth-notification-rearchitecture-work-items/development-plan.md`
- App 任务接口文档
- Admin 任务管理接口文档

## 8. 排期引用

- 优先级与依赖以 `docs/task-growth-notification-rearchitecture-work-items/execution-plan.md` 为准；
- 本任务对应排期项：`P1-03`；
- 直接前置：`P0-02`；
- 软前置：`P0-04`、`P1-02`；
- 完成后主要解锁：`P2-02`、`P2-01`。
