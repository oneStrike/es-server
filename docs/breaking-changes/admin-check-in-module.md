# Admin Check-in Module Breaking Change

## Scope

- API:
  - `GET admin/check-in/config/detail`
  - `POST admin/check-in/config/update`
  - `POST admin/check-in/config/update-enabled`
  - `GET admin/check-in/daily-streak/detail`
  - `GET admin/check-in/daily-streak/history/page`
  - `GET admin/check-in/daily-streak/history/detail`
  - `POST admin/check-in/daily-streak/publish`
  - `POST admin/check-in/daily-streak/terminate`
  - `GET admin/check-in/activity-streak/page`
  - `GET admin/check-in/activity-streak/detail`
  - `POST admin/check-in/activity-streak/create`
  - `POST admin/check-in/activity-streak/update`
  - `POST admin/check-in/activity-streak/update-status`
  - `POST admin/check-in/activity-streak/delete`
  - `GET admin/check-in/reconciliation/page`
  - `POST admin/check-in/reconciliation/repair`
- Domain: admin 侧签到配置、日常连续签到配置版本、活动连续签到定义、签到对账
- Change type: 破坏性更新，无兼容层

## Preconditions

- 本次不处理历史连续签到数据迁移。
- 默认以上线前清理连续签到相关数据为前提。
- 不提供旧 round 接口兼容层。

## Removed Routes

以下旧 round 路由全部下线：

- `GET admin/check-in/streak-round/detail`
- `GET admin/check-in/streak-round/history/page`
- `GET admin/check-in/streak-round/history/detail`
- `POST admin/check-in/streak-round/update`

## New Daily Streak Management Routes

新增日常连续签到配置版本管理接口：

- `GET admin/check-in/daily-streak/detail`
- `GET admin/check-in/daily-streak/history/page`
- `GET admin/check-in/daily-streak/history/detail`
- `POST admin/check-in/daily-streak/publish`
- `POST admin/check-in/daily-streak/terminate`

语义变化：

- 后台不再编辑“当前轮次”。
- 后台改为发布“日常连续签到配置版本”。
- 生效策略由配置发布表达，不再靠“旧轮走完”解释。
- 日常连续签到奖励规则改为关系型结构：
  - 头表
  - 按天规则表
  - 奖励项明细表
- 后台配置语义变成：**一天一条规则记录**
- 当前仅支持三种发布策略：
  - `1=立即生效`
  - `2=次日生效`
  - `3=指定时间生效`
- `terminate` 仅允许终止尚未生效的日常连续签到配置；已经生效的当前配置不能通过该接口直接终止。

## New Activity Streak Management Routes

活动连续签到改为独立管理模型：

- `GET admin/check-in/activity-streak/page`
- `GET admin/check-in/activity-streak/detail`
- `POST admin/check-in/activity-streak/create`
- `POST admin/check-in/activity-streak/update`
- `POST admin/check-in/activity-streak/update-status`
- `POST admin/check-in/activity-streak/delete`

说明：

- 活动连续签到与日常连续签到不再复用同一管理对象。
- 活动连续签到以活动定义、时间窗口和独立规则集为核心。
- `delete` 不再作为“强制清理历史事实”的入口使用；已产生用户进度或奖励发放事实的活动不能删除，应改走状态下线/归档。

## Daily Streak DTO Changes

旧 round DTO 下线：

- `UpdateCheckInStreakRoundDto`
- `CheckInStreakRoundDetailResponseDto`
- `CheckInStreakRoundHistoryPageItemDto`
- `CheckInStreakRoundHistoryDetailResponseDto`

现在改为：

- `PublishCheckInDailyStreakConfigDto`
- `CheckInDailyStreakConfigDetailResponseDto`
- `CheckInDailyStreakConfigHistoryPageItemDto`
- `CheckInDailyStreakConfigHistoryDetailResponseDto`

说明：

- `rewardRules[]` 仍作为接口数组返回
- 但底层已不再持久化为 `jsonb`
- 每个 rule 对应数据库里的一条“第 N 天”规则记录

## Reconciliation Changes

对账查询不再按旧 round 过滤：

- `roundConfigId`

现在统一按新的连续奖励归因字段过滤：

- `scopeType`
- `configVersionId`
- `activityId`
- `grantId`

## Grant Contract Changes

连续奖励发放事实不再使用旧字段：

- `roundConfigId`
- `roundIteration`

现在统一使用：

- `scopeType`
- `configVersionId`
- `activityId`

同时：

- grant 奖励快照不再走 `rewardItems json`
- 奖励项改为独立 grant reward item 明细

## Notes

- 本次为破坏性更新，admin 不得再依赖 `streak-round/*` 路由。
- 不做历史补差、旧事实回滚或旧 round 迁移。
- app/admin 侧都必须同步切到新的 daily/activity 模型。
- `publishStrategy` 不再暴露未实现的“新阶段生效”语义。
- 连续签到奖励采用关系型按天规则模型，不再保留 streak JSON 规则存储。
