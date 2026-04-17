# App Reward Module Breaking Change

## Scope

- API:
  - `GET app/task/page`
  - `GET app/task/my/page`
  - `GET app/check-in/summary`
  - `GET app/check-in/calendar`
  - `GET app/check-in/my/page`
- Domain: 任务奖励、签到奖励、奖励到账视图
- Change type: 破坏性更新，无兼容层

## Task Payload Changes

### Removed field

任务相关响应不再返回旧奖励对象：

```ts
rewardConfig
```

旧结构：

```ts
{
  points?: number
  experience?: number
}
```

新结构：

```ts
rewardItems: Array<{
  assetType: 1 | 2
  assetKey?: ''
  amount: number
}>
```

### Settlement fields

任务完成后的奖励状态不再通过旧 assignment 字段表达。

已删除：

- `rewardStatus`
- `rewardResultType`
- `rewardSettledAt`
- `rewardLedgerIds`
- `lastRewardError`

现在统一读取：

- `rewardSettlementId`
- `rewardSettlement`

## Check-in Payload Changes

### Plan / summary / calendar

以下旧字段已下线：

- `baseRewardConfig`
- `planRewardConfig`

现在统一为：

- `baseRewardItems`
- `planRewardItems`

### Record / grant

以下旧字段已下线：

- `resolvedRewardConfig`
- `rewardConfig`

现在统一为：

- `resolvedRewardItems`
- `rewardItems`

### Settlement fields

签到基础奖励和连续奖励不再通过旧状态字段表达。

已删除：

- `rewardStatus`
- `rewardResultType`
- `baseRewardLedgerIds`
- `lastRewardError`
- `rewardSettledAt`
- `grantStatus`
- `grantResultType`
- `ledgerIds`
- `lastGrantError`
- `grantSettledAt`

现在统一读取：

- `rewardSettlementId`
- `rewardSettlement`

## Canonical Reward Item

客户端后续应统一按下面的奖励项结构解析任务和签到奖励：

```ts
type RewardItem = {
  assetType: 1 | 2
  assetKey?: ''
  amount: number
}
```

当前业务含义：

- `assetType=1`：积分
- `assetType=2`：经验

## Migration Guidance

### Task reward

旧：

```json
{ "points": 10, "experience": 5 }
```

新：

```json
[
  { "assetType": 1, "assetKey": "", "amount": 10 },
  { "assetType": 2, "assetKey": "", "amount": 5 }
]
```

### Check-in reward

旧：

```json
baseRewardConfig
resolvedRewardConfig
rewardConfig
```

新：

```json
baseRewardItems
resolvedRewardItems
rewardItems
```

## Unchanged user-facing fields

以下用户成长摘要字段仍然保留原语义：

- `points`
- `experience`

说明：

- 它们的事实源已经从 `app_user` 切到统一余额表，但 app 侧字段名没有再做破坏性重命名。

## Notes

- 本次为破坏性更新，不提供旧字段兼容层。
- 客户端不得再同时兼容 `rewardConfig` 与 `rewardItems`。
