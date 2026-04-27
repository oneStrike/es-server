# App 连续签到详情接口实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 app 新增 `GET app/check-in/streak/detail`，返回当前用户的最小连续签到进度和当前生效的完整连续奖励列表。

**架构：** 在 app controller 增加一个独立详情路由，门面服务透传到 `CheckInRuntimeService`。运行时服务复用已有连续签到规则读取与有效进度计算能力，只新增 DTO 组装，不改数据库与发奖逻辑。

**技术栈：** NestJS、TypeScript、Jest、Drizzle、Swagger DTO decorators

---

## 文件结构

- 修改：`libs/growth/src/check-in/dto/check-in-runtime.dto.ts`
  责任：定义 app 侧连续签到详情响应 DTO，复用现有规则 DTO 与进度字段语义。
- 修改：`libs/growth/src/check-in/check-in-runtime.service.ts`
  责任：新增 `getStreakDetail(userId)` 读模型组装逻辑。
- 修改：`libs/growth/src/check-in/check-in.service.ts`
  责任：新增对 app controller 暴露的门面方法。
- 修改：`apps/app-api/src/modules/check-in/check-in.controller.ts`
  责任：新增 `GET app/check-in/streak/detail` 路由与 Swagger 注解。
- 修改：`libs/growth/src/check-in/check-in-runtime.service.spec.ts`
  责任：先写失败测试，再验证新接口返回结构。

### 任务 1：为连续签到详情写失败测试

**文件：**
- 修改：`libs/growth/src/check-in/check-in-runtime.service.spec.ts`
- 测试：`libs/growth/src/check-in/check-in-runtime.service.spec.ts`

- [ ] **步骤 1：添加新用例，表达期望返回 `progress + rewardRules`**

```ts
it('returns streak detail with effective progress and active reward rules', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-04-24T10:00:00.000Z'))
  const { service, streakService } = createService()

  streakService.toStreakRewardRuleViews = jest.fn().mockReturnValue([
    {
      ruleCode: 'streak-day-3',
      streakDays: 3,
      rewardItems: [{ assetType: 1, assetKey: '', amount: 30 }],
      rewardOverviewIconUrl: 'https://cdn.example.com/streak-day-3.png',
      repeatable: false,
      status: 2,
    },
  ])

  await expect(service.getStreakDetail(9)).resolves.toMatchObject({
    progress: {
      currentStreak: 3,
      streakStartedAt: '2026-04-19',
      lastSignedDate: '2026-04-21',
    },
    rewardRules: [
      {
        ruleCode: 'streak-day-3',
        streakDays: 3,
      },
    ],
  })

  jest.useRealTimers()
})
```

- [ ] **步骤 2：运行单测，确认因缺少 `getStreakDetail` 而失败**

运行：`pnpm test -- --runInBand --runTestsByPath libs/growth/src/check-in/check-in-runtime.service.spec.ts`

预期：FAIL，报错包含 `service.getStreakDetail is not a function` 或等价的缺失实现错误。

### 任务 2：补 DTO 与运行时服务最小实现

**文件：**
- 修改：`libs/growth/src/check-in/dto/check-in-runtime.dto.ts`
- 修改：`libs/growth/src/check-in/check-in-runtime.service.ts`

- [ ] **步骤 1：新增连续签到详情响应 DTO**

```ts
export class CheckInStreakDetailProgressDto extends PickType(
  CheckInStreakSummaryDto,
  ['currentStreak', 'streakStartedAt', 'lastSignedDate'] as const,
) {}

export class CheckInStreakDetailResponseDto {
  @NestedProperty({
    description: '当前连续签到进度。',
    type: CheckInStreakDetailProgressDto,
    validation: false,
  })
  progress!: CheckInStreakDetailProgressDto

  @ArrayProperty({
    description: '当前生效的连续签到奖励规则列表。',
    itemClass: BaseCheckInStreakRewardRuleDto,
    validation: false,
  })
  rewardRules!: BaseCheckInStreakRewardRuleDto[]
}
```

- [ ] **步骤 2：在运行时服务中新增 `getStreakDetail(userId)`**

```ts
async getStreakDetail(userId: number) {
  const now = new Date()
  const today = this.formatDateOnly(now)
  const activeRules = await this.checkInStreakService.listActiveStreakRulesAt(now)
  const rewardRules = this.checkInStreakService.toStreakRewardRuleViews(
    activeRules,
    now,
  )
  const progress = await this.db.query.checkInStreakProgress.findFirst({
    where: { userId },
  })
  const currentStreak = this.checkInStreakService.resolveEffectiveCurrentStreak(
    progress?.currentStreak ?? 0,
    progress?.lastSignedDate,
    today,
  )

  return {
    progress: {
      currentStreak,
      streakStartedAt:
        currentStreak > 0 && progress?.streakStartedAt
          ? this.toDateOnlyValue(progress.streakStartedAt)
          : undefined,
      lastSignedDate: this.checkInStreakService.resolveEffectiveLastSignedDate(
        progress?.lastSignedDate,
        today,
      ),
    },
    rewardRules,
  }
}
```

- [ ] **步骤 3：运行单测，确认新用例转绿**

运行：`pnpm test -- --runInBand --runTestsByPath libs/growth/src/check-in/check-in-runtime.service.spec.ts`

预期：PASS，新增 `returns streak detail with effective progress and active reward rules` 用例通过。

### 任务 3：接入门面与 app controller

**文件：**
- 修改：`libs/growth/src/check-in/check-in.service.ts`
- 修改：`apps/app-api/src/modules/check-in/check-in.controller.ts`

- [ ] **步骤 1：在门面服务暴露新方法**

```ts
async getStreakDetail(userId: number) {
  return this.checkInRuntimeService.getStreakDetail(userId)
}
```

- [ ] **步骤 2：在 app controller 新增详情路由**

```ts
@Get('streak/detail')
@ApiDoc({
  summary: '获取连续签到详情',
  model: CheckInStreakDetailResponseDto,
})
async getStreakDetail(@CurrentUser('sub') userId: number) {
  return this.checkInService.getStreakDetail(userId)
}
```

- [ ] **步骤 3：补齐 controller import**

```ts
import {
  CheckInCalendarResponseDto,
  CheckInLeaderboardItemDto,
  CheckInRecordItemDto,
  CheckInStreakDetailResponseDto,
  CheckInSummaryResponseDto,
  QueryCheckInLeaderboardDto,
} from '@libs/growth/check-in/dto/check-in-runtime.dto'
```

- [ ] **步骤 4：再次运行单测，确认门面接入未破坏既有测试**

运行：`pnpm test -- --runInBand --runTestsByPath libs/growth/src/check-in/check-in-runtime.service.spec.ts`

预期：PASS，无新增失败。

### 任务 4：完整验证与收尾

**文件：**
- 修改：`libs/growth/src/check-in/check-in-runtime.service.spec.ts`
- 修改：`libs/growth/src/check-in/dto/check-in-runtime.dto.ts`
- 修改：`libs/growth/src/check-in/check-in-runtime.service.ts`
- 修改：`libs/growth/src/check-in/check-in.service.ts`
- 修改：`apps/app-api/src/modules/check-in/check-in.controller.ts`

- [ ] **步骤 1：运行签到模块相关单测**

运行：`pnpm test -- --runInBand --runTestsByPath libs/growth/src/check-in/check-in-runtime.service.spec.ts`

预期：PASS。

- [ ] **步骤 2：运行类型检查**

运行：`pnpm type-check`

预期：PASS，controller、service、DTO 引用一致，无新增类型错误。

- [ ] **步骤 3：检查改动范围与最终合同**

运行：`git diff -- apps/app-api/src/modules/check-in/check-in.controller.ts libs/growth/src/check-in/check-in.service.ts libs/growth/src/check-in/check-in-runtime.service.ts libs/growth/src/check-in/dto/check-in-runtime.dto.ts libs/growth/src/check-in/check-in-runtime.service.spec.ts`

预期：只包含新详情接口、对应 DTO、门面方法、运行时读模型和测试；不含 schema/migration 变更。
