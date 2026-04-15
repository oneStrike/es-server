# 用户成长模块审查结果清单

审查日期：2026-04-15

## 1. 审查范围

本次按“奖励发放 + 等级成长 + 任务/签到补偿 + 对外查询口径”完整串联审查，重点覆盖：

- 成长主链路：`libs/growth/src/growth-reward`、`libs/growth/src/growth-ledger`
- 成长资产与等级：`libs/growth/src/point`、`libs/growth/src/experience`、`libs/growth/src/level-rule`
- 成长业务场景：`libs/growth/src/task`、`libs/growth/src/check-in`
- 事件生产与桥接：`libs/growth/src/event-definition`、`libs/interaction/src/*-growth.service.ts`、`libs/forum/src/topic/forum-topic.service.ts`
- 用户读模型：`apps/app-api/src/modules/user/user.service.ts`、`apps/admin-api/src/modules/app-user/app-user-growth.service.ts`、`libs/user/src/user.service.ts`
- 数据模型：`db/schema/app/app-user.ts`、`growth-ledger-record.ts`、`growth-audit-log.ts`、`growth-rule-usage-slot.ts`、`user-point-rule.ts`、`user-experience-rule.ts`、`user-level-rule.ts`、`task*.ts`、`check-in*.ts`

## 2. 审查维度

- 业务正确性：奖励是否重复、漏发、误发，等级是否能正确同步
- 事务一致性：事件、账本、任务推进、签到补偿是否原子或至少可补偿
- 幂等与补偿：`bizKey`、唯一约束、重试路径是否与产品语义一致
- 数据模型：表约束、状态流转、软删除口径、查询过滤是否一致
- 接口与运营语义：管理端手工发放、删除规则、对账接口是否符合预期
- 测试覆盖：高风险链路是否有针对性测试

## 3. 总体结论

整体设计方向是对的，尤其是：

- 用 `growth_ledger_record` 统一沉淀积分/经验流水
- 用 `bizKey` + 唯一约束收口幂等
- 任务、签到都已经开始显式建模“奖励待补偿/已补偿/失败”

但当前仍有几处高风险实现缺口，主要集中在**事务边界**和**运营端语义一致性**。其中前 3 项属于建议优先修复的问题，否则会出现“部分奖励落账、部分消费者已提交、后台以为成功但实际上未真正发放”的情况。

## 4. 核心问题

### [必须修复] 1. 评论奖励链路把根 `db` 当作事务传递，导致积分/经验发放不再原子

位置：

- `libs/interaction/src/comment/comment.service.ts:1102`
- `libs/interaction/src/comment/comment.service.ts:1282`
- `libs/interaction/src/comment/comment.service.ts:1992`
- `libs/interaction/src/comment/comment.service.ts:2067`
- `libs/interaction/src/comment/comment-growth.service.ts:16-18`
- `libs/growth/src/growth-reward/growth-reward.service.ts:461-468`

问题说明：

- `CommentGrowthService.rewardCommentCreated()` 的参数名叫 `tx: Db`，但调用方传入的是 `this.db` 根连接，不是真正的事务对象。
- `UserGrowthRewardService.runWithOptionalTransaction()` 只要收到 `tx` 就直接 `callback(tx)`，不会再包一层 `withTransaction()`。
- 结果是评论奖励里的“积分规则结算 + 经验规则结算”会在**非事务上下文**下顺序执行。

影响：

- 评论奖励可能出现积分已发、经验失败的部分成功状态。
- `GrowthLedgerService.applyByRule()` 里的“建 gate、占槽、改余额、写审计”原本依赖事务成立；现在落到根 `db` 上，会把内部多语句流程暴露为半提交风险。
- 这类问题最难排查，因为接口看起来成功，账本和用户余额却可能不一致。

建议：

- 把 `CommentGrowthService` 的入参显式区分为“可选事务 `tx?`”和“无事务自动包裹”两种模式。
- 如果调用方传的是根 `db`，则不要把它当作事务继续下传；应让 `UserGrowthRewardService` 自己开启事务。
- 最稳妥的做法是：只有真正的 `tx` 才透传，否则传 `undefined`。

### [必须修复] 2. 成长账本在“每日限额已占位、总限额拒绝”时会泄漏每日槽位

位置：

- `libs/growth/src/growth-ledger/growth-ledger.service.ts:189-247`

问题说明：

- `applyByRule()` 先占每日槽位，再占总槽位。
- 如果每日槽位占用成功，但总槽位占用失败，当前实现只删除 ledger gate 并写审计日志，**没有回收刚刚占到的 daily slot**。

影响：

- 同一用户在“总限额已满”的情况下继续触发事件，会持续消耗当天的 daily slot。
- 这会把“总限额拒绝”错误污染成“每日限额也被提前吃满”，后续对账和排障会出现错判。
- 一旦运营同时配置 `dailyLimit` 和 `totalLimit`，这条路径就有真实命中概率。

建议：

- 要么把 daily/total 槽位占用改成统一成功后再提交；
- 要么在 `reservedTotal === false` 时补删本次已占用的 daily slot；
- 最好补一组“daily + total 组合限额”的单测，覆盖 `total reject after daily reserved`。

### [必须修复] 3. 事件桥接里的任务消费者不参与调用方事务，存在跨消费者部分提交

位置：

- `libs/growth/src/growth-reward/growth-event-bridge.service.ts:49-67`

问题说明：

- `dispatchDefinedEvent()` 会先执行 `taskService.consumeEventProgress()`，然后再执行成长奖励。
- 成长奖励会透传 `input.tx`，但任务链路没有接收 `tx`，也没有参与同一事务。

影响：

- 当调用方已经显式开启事务并把 `tx` 传给桥接层时，成长奖励和任务推进并不在同一事务里。
- 一旦后续成长链路报错或调用方事务回滚，任务 assignment / progress 仍可能已经提交，出现“任务已推进，但奖励侧没成功”的幽灵状态。
- 这类问题会直接污染任务补偿和对账页。

建议：

- 如果桥接层允许多 consumer 同时消费同一事件，就要统一事务策略。
- 方案一：`TaskService.consumeEventProgress()` 支持传入 `tx`，并在桥接层统一透传。
- 方案二：明确声明 bridge 是“最终一致性分发器”，那就不该再在同一个方法里混用“有事务”和“无事务”的 consumer。

### [建议修改] 4. 管理端经验发放接口缺少稳定操作键，重复同参发放会被静默去重

位置：

- `apps/admin-api/src/modules/growth/experience/experience.controller.ts:75-84`
- `libs/growth/src/experience/dto/experience-record.dto.ts:144-165`
- `libs/growth/src/experience/experience.service.ts:203-212`

问题说明：

- 管理端 `grant` 接口入参只有 `userId + ruleType + remark`，没有 `operationKey`。
- `addExperience()` 又会基于这些字段构建稳定 `bizKey`。
- 这意味着管理员连续两次发起相同参数的补发请求，第二次会命中幂等并直接返回成功，但不会新增任何经验流水。

影响：

- 运营以为“又补发了一次”，实际上系统只是复用了第一次的幂等键。
- 接口返回 `true`，但没有任何显式提示“本次是幂等复用而非真实发放”，很容易造成后台误操作。
- 同仓库的 `AdminAppUserManualOperationDto` 已经引入 `operationKey`，这里的语义明显不一致。

建议：

- 要么给该接口补 `operationKey`，沿用 `app-user` 手工操作口径；
- 要么删除这个泛化接口，只保留带人工操作键的后台发放入口；
- 至少要让接口返回“本次真实发放 / 幂等复用”的结果类型，而不是统一 `true`。

### [建议修改] 5. 删除等级规则时没有排除软删除用户，可能导致历史脏数据永久阻塞清理

位置：

- `libs/growth/src/level-rule/level-rule.service.ts:170-178`
- `db/schema/app/app-user.ts`（存在 `deletedAt` 软删除字段）

问题说明：

- `deleteLevelRule()` 用 `eq(this.appUser.levelId, id)` 直接统计引用用户数，没有排除 `deletedAt is null`。
- 只要历史上有软删除用户仍挂着这个 `levelId`，等级规则就永远删不掉。

影响：

- 后台清理失效等级或错误配置等级时，会被历史软删除数据卡死。
- 这会让“用户域已逻辑删除，但成长规则无法回收”的口径不一致持续扩大。

建议：

- 删除前的引用检查应与用户域基础存在性口径一致，至少补 `deletedAt is null`。
- 如果业务要求“历史软删除用户也保留等级引用”，那就不要做物理删除，应改成停用而不是删除。

## 5. 测试覆盖缺口

当前 `libs/growth/src` 保留的测试主要集中在：

- `check-in/test/*`
- `task/test/*`

缺口明显的高风险区域：

- `growth-ledger.service.ts`
- `growth-reward.service.ts`
- `growth-event-bridge.service.ts`
- `point.service.ts`
- `experience.service.ts`
- `level-rule.service.ts`

建议优先补的测试：

1. `applyByRule()` 在 `dailyLimit + totalLimit` 组合下的槽位回收
2. 评论奖励在“积分成功、经验失败”时是否会发生部分提交
3. bridge 在传入 `tx` 时，task/growth 是否保持同一事务语义
4. 管理端经验重复补发时，接口是否能明确区分“幂等复用”和“真实发放”
5. 删除等级规则时是否忽略软删除用户

## 6. 建议修复顺序

1. 先修事务边界：评论奖励链路、bridge 事务口径
2. 再修账本限额：daily slot 泄漏
3. 再修管理端运营语义：经验补发 `operationKey`
4. 最后收口数据清理口径：等级规则删除与软删除用户

## 7. 结论

当前用户成长模块的建模已经具备较好的扩展基础，但“奖励发放”和“等级成长”真正的稳定性还卡在几个底层一致性细节上。只要把上述 3 个必须修复问题补齐，再补一轮账本/桥接层测试，整个模块的可信度会明显提升。
