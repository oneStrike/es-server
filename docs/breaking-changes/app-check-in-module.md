# App Check-in Module Breaking Change

## Scope

- API:
  - `GET app/check-in/summary`
  - `GET app/check-in/calendar`
  - `GET app/check-in/my/page`
  - `GET app/check-in/leaderboard/page`
  - `GET app/check-in/activity/page`
  - `GET app/check-in/activity/detail`
  - `POST app/check-in/sign`
  - `POST app/check-in/makeup`
- Domain: app 侧签到摘要、连续签到、活动连续签到、签到奖励展示
- Change type: 破坏性更新，无兼容层

## Preconditions

- 本次改造按破坏性更新处理。
- 上线前默认清理连续签到相关数据，不围绕历史连续签到数据做迁移或重建。
- 基础签到记录与补签能力继续保留，但不作为旧 round 兼容层。

## Daily Streak Contract Changes

### Removed runtime fields

以下日常连续签到运行时字段已从 app 合同下线：

- `roundConfigId`
- `roundCode`
- `version`
- `roundIteration`
- `roundStartedAt`
- `round`

### New summary shape

`summary.streak` 现在统一表达为：

```ts
{
  currentStreak: number
  streakStartedAt?: string
  lastSignedDate?: string
  nextReward?: RewardRule | null
}
```

说明：

- app 侧不再感知“用户绑定哪一轮”。
- app 侧只关心“当前连续签到天数”和“下一档奖励”。

## Activity Streak Contract Changes

活动连续签到不再混入日常 `summary`。

新增独立读模型：

- `GET app/check-in/activity/page`
- `GET app/check-in/activity/detail`

说明：

- 日常连续签到与活动连续签到在 app 侧分开读取。
- 活动连续签到拥有独立的活动标识、时间窗口、当前进度和下一档奖励。
- `GET app/check-in/activity/page` / `detail` 仅返回当前对 app 用户可见的活动：
  - 状态必须为 `PUBLISHED`
  - 当前时间必须落在活动有效时间窗内

## Grant Payload Changes

连续奖励 `grant` 不再返回旧 round 归因字段：

- `roundConfigId`
- `roundIteration`

现在统一为：

- `scopeType`
- `configVersionId`
- `activityId`

语义：

- `scopeType=1`：日常连续签到
- `scopeType=2`：活动连续签到

## Action Response Changes

`POST app/check-in/sign` / `POST app/check-in/makeup` 响应中：

- 保留 `currentStreak`
- 保留 `triggeredGrantIds`
- 下线 `roundConfigId`

## Calendar / Record Behavior

- 基础签到奖励仍冻结到 `resolvedRewardItems`
- 连续签到奖励仍通过 `grants[]` 展示
- 但 `grants[]` 已切换为新的 daily/activity 统一归因模型

## Notes

- 本次不提供旧字段 fallback。
- 客户端不得再依赖 round 运行时字段解释连续签到状态。
- 活动连续签到需要改走独立 activity 读模型。
- app 不再读取草稿、下线、归档或已失效的活动详情。
