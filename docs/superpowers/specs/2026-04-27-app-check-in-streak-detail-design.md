# App 连续签到详情接口设计

## 1. 背景

当前 app 侧连续签到信息分散在已有接口中：

- `GET app/check-in/summary` 只返回连续签到摘要：`currentStreak`、`streakStartedAt`、`lastSignedDate`、`nextReward`
- `GET app/check-in/my/page` 只能按签到记录回看某日触发的 `grants[]`
- `POST app/check-in/sign` / `POST app/check-in/makeup` 只返回 `currentStreak` 与 `triggeredGrantIds`

这意味着 app 无法直接读取“当前完整连续签到奖励阶梯 + 当前用户进度”这一组最小但完整的详情数据。

## 2. 目标

1. 为 app 新增独立的连续签到详情接口。
2. 接口返回当前用户的最小连续签到进度。
3. 接口返回当前时刻生效的完整连续签到奖励列表。
4. 不改变现有 `summary`、`sign`、`makeup`、`my/page` 的返回合同。

## 3. 非目标

- 不在本次接口中返回逐档状态，例如 `achieved`、`granted`、`remainingDays`
- 不新增分页、筛选或历史规则读取能力
- 不改动连续签到发奖逻辑、进度聚合逻辑或数据库结构
- 不把完整连续签到奖励列表塞回 `GET app/check-in/summary`

## 4. 接口设计

### 4.1 路由

- `GET app/check-in/streak/detail`

### 4.2 返回结构

```ts
{
  progress: {
    currentStreak: number
    streakStartedAt?: string
    lastSignedDate?: string
  }
  rewardRules: BaseCheckInStreakRewardRuleDto[]
}
```

### 4.3 字段语义

- `progress.currentStreak`：当前仍然有效的连续签到天数；若连续已断，则返回 `0`
- `progress.streakStartedAt`：当前有效连续区间的起始日期；仅当 `currentStreak > 0` 时返回
- `progress.lastSignedDate`：最近一次仍属于当前连续区间的有效签到日期；若连续已断则不返回
- `rewardRules`：当前时刻所有生效中的连续签到奖励规则，按 `streakDays` 升序返回

## 5. 业务语义

- 接口只读取“当前时刻生效”的连续签到规则，不暴露草稿、已终止或已过期版本
- 连续进度继续复用 `check_in_streak_progress` 的当前聚合值，并沿用现有“今天 / 昨天有效，其他情况视为已断签”的判定规则
- 返回的规则项继续复用现有连续签到规则 DTO，保留 `rewardItems`、`rewardOverviewIconUrl`、`repeatable`、`status`
- 当当前没有任何生效规则时，`rewardRules` 返回空数组，`progress` 仍按用户真实连续进度返回

## 6. 实现范围

### 6.1 app 入口层

- 在 `apps/app-api/src/modules/check-in/check-in.controller.ts` 新增 `GET streak/detail`

### 6.2 libs/growth DTO

- 在 `libs/growth/src/check-in/dto/check-in-runtime.dto.ts` 新增 app 侧连续签到详情响应 DTO

### 6.3 门面与运行时服务

- 在 `libs/growth/src/check-in/check-in.service.ts` 新增 `getStreakDetail(userId)`
- 在 `libs/growth/src/check-in/check-in-runtime.service.ts` 新增只读组装逻辑

### 6.4 复用能力

优先复用现有能力，不新增重复聚合：

- `checkInStreakService.listActiveStreakRulesAt(now)`
- `checkInStreakService.toStreakRewardRuleViews(...)`
- `checkInStreakService.resolveEffectiveCurrentStreak(...)`
- `checkInStreakService.resolveEffectiveLastSignedDate(...)`

## 7. 验证

- 为 `check-in-runtime.service.spec.ts` 增加新接口用例，先写失败测试再补实现
- 运行相关单测，确认返回 `progress + rewardRules`
- 运行 `pnpm type-check`，确认 app/controller、DTO、service 签名一致

## 8. 兼容与风险

- 这是新增 app 侧读取接口，不影响旧客户端现有调用
- 由于连续进度继续沿用现有有效性判定，断签后的 `streakStartedAt` / `lastSignedDate` 仍会按既有语义被隐藏
- 若未来前端需要逐档状态，应在本接口上增量扩展，而不是修改现有最小合同
