# P1 本地改进方案任务清单

## 1. 文档目标

P1 重点解决“任务奖励可审计”和“账本展示解释力不足”的问题。

P1 不追求抽象出完整事件中心，也不做多渠道通知编排；本阶段目标是把“任务完成 -> 发奖 -> 账本展示”这条线补全，让运营、开发、用户都能解释清楚一笔成长变更是怎么来的。

## 2. 范围边界

### 2.1 本阶段纳入范围

- 任务奖励结算结果可追踪
- 任务侧补齐奖励状态展示
- `rewardConfig` 契约收敛
- App / 管理端账本 DTO 增强
- 统一混合账本接口

### 2.2 本阶段不纳入范围

- 统一事件中心
- 多渠道通知模板/偏好
- 评论审核后台
- Growth 规则表彻底合并
- 徽章来源追溯大改

## 3. 当前问题与代码证据

### 3.1 任务已发奖，但任务侧看不到结算状态

当前任务完成后已经会发奖：

- `libs/growth/src/task/task.service.ts`
- `libs/growth/src/growth-reward/growth-reward.service.ts`

但 `task_assignment` 里没有这些信息：

- `rewardStatus`
- `rewardSettledAt`
- `rewardLedgerIds`
- `lastRewardError`

对应表：

- `db/schema/app/task-assignment.ts`

因此现在能解释“账本有没有落”，但不能从任务记录侧解释“这个任务为什么没发奖”。

### 3.2 `rewardConfig` 契约和真实能力不一致

当前数据库字段是 `jsonb`，DTO 示例里包含：

- `points`
- `experience`
- `badgeCodes`

对应文件：

- `db/schema/app/task.ts`
- `libs/growth/src/task/dto/task.dto.ts`

但当前真正结算时只读取：

- `points`
- `experience`

对应文件：

- `libs/growth/src/growth-reward/growth-reward.service.ts`

这会带来一个严重误导：

- 运营以为任务已经支持发徽章
- 实际上当前配置了 `badgeCodes` 也不会生效

### 3.3 底层账本字段丰富，但上层 DTO 丢失了解释力

底层账本表有这些字段：

- `assetType`
- `delta`
- `beforeValue`
- `afterValue`
- `bizKey`
- `ruleType`
- `ruleId`
- `targetType`
- `targetId`
- `remark`
- `context`

对应文件：

- `db/schema/app/growth-ledger-record.ts`
- `libs/growth/src/point/dto/point-record.dto.ts`
- `libs/growth/src/experience/dto/experience-record.dto.ts`

但 App 和管理端展示 DTO 把 `ruleType/bizKey/context` 等关键信息裁掉了：

- `apps/app-api/src/modules/user/dto/user-point.dto.ts`
- `apps/app-api/src/modules/user/dto/user.dto.ts`
- `apps/admin-api/src/modules/app-user/dto/app-user.dto.ts`

直接后果：

- 用户看到“+10 积分”，但不知道是哪一个任务/规则
- 运营只能靠 remark 猜来源
- 开发排查重复发奖时，上层 API 帮不上忙

## 4. P1 目标状态

P1 完成后，系统要达到以下状态：

1. 从任务详情能直接看出奖励是否已结算、何时结算、对应哪些账本
2. `rewardConfig` 的可配置项与真实结算能力一致
3. App 和管理端都能直接看到账本来源、业务键和上下文摘要
4. 用户侧和运营侧都能查询统一“混合成长账本”

## 5. 推荐方案选型

### 5.1 任务奖励审计推荐使用独立表

推荐新增独立表，而不是只在 `task_assignment` 上硬塞多个字段。

推荐原因：

- 一个任务完成可能会产生多条账本
- 后续如果支持徽章或补偿重试，单字段不够表达
- 独立表更适合记录“尝试次数/失败信息/结果快照”

### 5.2 推荐新增 `task_reward_settlement`

建议字段：

- `id`
- `assignmentId`
- `taskId`
- `userId`
- `status`
- `rewardSnapshot`
- `bizKeyBase`
- `ledgerRecordIds`
- `settledAt`
- `lastAttemptAt`
- `retryCount`
- `lastError`
- `createdAt`
- `updatedAt`

字段建议：

- `status`：`PENDING / SUCCESS / FAILED`
- `rewardSnapshot`：保存当次奖励配置快照
- `ledgerRecordIds`：建议 `jsonb` 数组，先保存 points/experience 账本 ID

### 5.3 如果时间不够的降级方案

如果本轮时间不足，也可以先在 `task_assignment` 上补：

- `rewardStatus`
- `rewardSettledAt`
- `rewardLedgerIds`
- `lastRewardError`

但这只是临时方案，不建议作为长期模型。

## 6. 详细任务清单

### 6.1 `rewardConfig` 契约收敛

#### 6.1.1 先消除当前误导

- [ ] 明确 P1 之前任务奖励只支持 `points`、`experience`
- [ ] 把 DTO 示例中误导性的 `badgeCodes` 去掉，或者标记为“暂不生效”
- [ ] 为管理端创建/更新任务 DTO 增加结构校验
- [ ] 非法字段进入 `rewardConfig` 时给出明确错误

#### 6.1.2 管理端录入约束

- [ ] 任务创建接口校验奖励字段类型
- [ ] 任务更新接口校验奖励字段类型
- [ ] 禁止负数奖励或浮点数奖励
- [ ] 明确 0 值的处理规则

涉及文件：

- `db/schema/app/task.ts`
- `libs/growth/src/task/dto/task.dto.ts`
- `apps/admin-api/src/modules/task/dto/task.dto.ts`
- `libs/growth/src/task/task.service.ts`
- `libs/growth/src/growth-reward/growth-reward.service.ts`

### 6.2 新增任务奖励结算审计表

#### 6.2.1 Schema 任务

- [ ] 新增 `db/schema/app/task-reward-settlement.ts`
- [ ] 补索引：
  - `assignmentId`
  - `userId + createdAt`
  - `status + createdAt`
- [ ] 如仓内有 relations，同步补 relation

#### 6.2.2 状态设计

- [ ] `PENDING`：任务刚完成，等待结算
- [ ] `SUCCESS`：结算成功
- [ ] `FAILED`：结算失败

#### 6.2.3 数据保存原则

- [ ] 任务完成时先写一条 settlement 记录
- [ ] 发奖成功后回写账本 ID、成功时间、状态
- [ ] 发奖失败后回写错误信息和失败时间
- [ ] 账本层仍然用 `bizKey` 做最终幂等

### 6.3 `GrowthRewardService` 返回结构化结果

当前 `tryRewardTaskComplete()` 返回 `void`，不利于任务侧记录结果。

需要改成返回结构化结果，例如：

- `success`
- `duplicated`
- `pointRecordId`
- `experienceRecordId`
- `errorMessage`

详细任务：

- [ ] 为任务奖励结算定义返回类型
- [ ] 将 points/experience 两条落账结果汇总返回
- [ ] 区分“已幂等跳过”和“真实失败”
- [ ] 保留 warning log，但不要只写日志不回传结果

涉及文件：

- `libs/growth/src/growth-reward/growth-reward.service.ts`

### 6.4 任务服务接入 settlement 记录

#### 6.4.1 完成路径

- [ ] 在 `reportProgress` 自动完成路径写 settlement 记录
- [ ] 在 `completeTask` 手动完成路径写 settlement 记录
- [ ] 两条路径都调用同一个内部方法，避免逻辑分叉

#### 6.4.2 幂等与并发

- [ ] 同一 `assignmentId` 只能有一条有效 settlement 主记录
- [ ] 重试时优先更新原记录，而不是创建多条
- [ ] 如果账本层返回 duplicated，settlement 应标记为 `SUCCESS`，但注明“幂等命中”

#### 6.4.3 查询展示

- [ ] 管理端任务领取记录分页增加 `rewardStatus`
- [ ] 管理端任务领取记录详情增加 `rewardSettledAt`、`rewardLedgerIds`
- [ ] App 端“我的任务”增加最小必要的奖励状态字段

涉及文件：

- `libs/growth/src/task/task.service.ts`
- `apps/admin-api/src/modules/task/task.controller.ts`
- `apps/admin-api/src/modules/task/dto/task.dto.ts`
- `apps/app-api/src/modules/task/task.controller.ts`
- `apps/app-api/src/modules/task/dto/task.dto.ts`

### 6.5 账本 DTO 增强

#### 6.5.1 App 端

- [ ] `UserPointRecordDto` 增加：
  - `ruleType`
  - `bizKey`
  - `context`
- [ ] `UserExperienceRecordDto` 增加：
  - `ruleType`
  - `targetType`
  - `targetId`
  - `bizKey`
  - `context`
- [ ] 如有安全考虑，`context` 可先做白名单裁剪

#### 6.5.2 管理端

- [ ] `AdminAppUserPointRecordDto` 增加 `ruleType/bizKey/context`
- [ ] `AdminAppUserExperienceRecordDto` 增加 `ruleType/targetType/targetId/bizKey/context`
- [ ] 保留旧字段，避免影响现有使用方

#### 6.5.3 展示友好化

- [ ] 后端补一个 `sourceLabel` / `sourceType` 派生字段
- [ ] 让前端不必只靠 `remark` 文案猜来源
- [ ] 常见来源至少覆盖：
  - 任务完成
  - 规则奖励
  - 人工补发
  - 举报裁决
  - 发帖奖励

### 6.6 统一混合账本接口

#### 6.6.1 App 端接口

推荐新增：

- `GET /app/user/growth/ledger/page`

返回统一时间线：

- `assetType`
- `delta`
- `beforeValue`
- `afterValue`
- `ruleType`
- `ruleId`
- `targetType`
- `targetId`
- `bizKey`
- `remark`
- `context`
- `createdAt`

#### 6.6.2 管理端接口

推荐新增：

- `GET /admin/app-user/growth/ledger/page`

用途：

- 运营排查用户成长变更
- 一次性看积分和经验，不需要切两页

#### 6.6.3 兼容策略

- [ ] 保留现有 points/experience 分页接口
- [ ] 新接口作为增强能力，不立即替换旧接口

### 6.7 测试任务

#### 6.7.1 任务奖励结算测试

- [ ] 任务完成后创建 settlement 记录
- [ ] 发奖成功后 settlement 变为 `SUCCESS`
- [ ] 发奖失败后 settlement 变为 `FAILED`
- [ ] 幂等重试不会创建重复账本

#### 6.7.2 DTO / API 测试

- [ ] App 端积分记录接口返回 `ruleType/bizKey/context`
- [ ] App 端经验记录接口返回 `ruleType/bizKey/context`
- [ ] 管理端用户账本接口返回增强字段
- [ ] 混合账本接口按时间排序正确

#### 6.7.3 契约测试

- [ ] `rewardConfig` 仅允许当前支持字段
- [ ] 非法字段被拒绝
- [ ] `badgeCodes` 在未支持前不会静默吞掉

## 7. 验收标准

### 7.1 任务侧验收

- 任务列表或详情能直接看到奖励结算状态
- 运维能查到任务完成后对应的账本记录 ID
- 能解释任务没发奖的原因

### 7.2 账本侧验收

- 用户可看到每条账本的来源类型和业务键
- 运营可在单接口里查看用户混合成长账本
- 常见排障不再只能靠 remark 模糊判断

### 7.3 契约验收

- `rewardConfig` 文档、DTO、实际结算能力一致
- 不再存在“配置了字段但实际上不生效”的误导

## 8. 风险与注意事项

### 8.1 历史数据兼容

- 老任务没有 settlement 记录，需要展示时考虑空值兼容
- 不建议 P1 直接回填全部历史 settlement，先保证增量正确

### 8.2 `context` 暴露边界

- 不建议把原始 `context` 不加筛选直接开放给 App
- 管理端可放宽，App 端建议白名单裁剪

### 8.3 表设计取舍

- 如果后续确定任务奖励会扩展到徽章/道具，独立 settlement 表比 assignment 扩展字段更稳
- 如果本轮只做最小改动，可先上 assignment 字段，但要在文档里标明这是过渡方案

## 9. 推荐拆分为本地开发任务

### 任务 A：任务奖励审计表与结算回写

- 新表
- `GrowthRewardService` 返回结构化结果
- `TaskService` 回写 settlement
- 测试

### 任务 B：`rewardConfig` 契约收敛

- DTO 校验
- service 校验
- 文档修正

### 任务 C：账本 DTO 增强与统一混合账本

- App 端 DTO
- 管理端 DTO
- 新增混合账本接口
- 测试

