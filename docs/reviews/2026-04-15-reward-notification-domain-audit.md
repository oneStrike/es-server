# 奖励发放 / 消息通知全链路审查报告（2026-04-15）

## 审查范围

本次按**当前工作区现状**做全链路域审查，覆盖：

- 奖励发放主链路：
  - `libs/growth/src/growth-reward/*`
  - `libs/growth/src/point/*`
  - `libs/growth/src/experience/*`
  - `libs/growth/src/check-in/*`
  - `libs/growth/src/task/*`
- 消息通知主链路：
  - `libs/message/src/notification/*`
  - `libs/message/src/eventing/*`
  - `apps/app-api/src/modules/message/*`
  - `apps/admin-api/src/modules/message/*`
- 只读消费方：
  - `apps/app-api/src/modules/user/user.service.ts`
  - `apps/admin-api/src/modules/app-user/app-user-growth.service.ts`
  - `libs/forum/src/profile/profile.service.ts`
- 共享基础设施（仅限主题相关链路）：
  - `db/extensions/findPagination.ts`
  - `db/core/drizzle.service.ts`
  - `db/core/error/error-handler.ts`
  - `libs/platform/src/decorators/validate/contract.ts`
  - `libs/platform/modules/eventing/*`
  - `libs/platform/modules/auth/*`

本报告已整合并复核 `docs/reviews/2026-04-15-user-notification-module-audit.md` 的通知专项结论；其中“通知列表泄露 `projectionKey` / `payload` 类型漂移”在当前工作区已修复，因此不再作为现存问题重复列出。

## 总体结论

奖励与通知主链路的分层已经基本成型，但当前仍有 6 项需要重点处理的风险：

- 2 项会直接影响线上正确性或幂等语义，建议按“必须修复”处理
- 2 项会造成安全暴露或运行时 500
- 2 项属于跨模块交叉风险，会把上游并发或配置问题放大成错误监控噪音

## 发现的问题

### 1. [必须修复] 规则奖励聚合允许“部分成功后整体返回失败”，会把奖励发放语义打成不一致

- 位置：
  - `libs/growth/src/growth-reward/growth-reward.service.ts:61-125`
  - `libs/growth/src/growth-reward/growth-reward.service.ts:301-324`
  - `libs/growth/src/growth-ledger/growth-ledger.service.ts:90-258`
  - `libs/growth/src/growth-event-bridge.service.ts:82-104`
- 问题：
  - `tryRewardByRule()` 在一个事务里分别调用积分和经验账本；
  - `growthLedgerService.applyByRule()` 对规则不存在、禁用、命中限额等情况返回 `success: false`，而不是抛异常；
  - `tryRewardByRule()` 没有在单资产返回失败时主动回滚，事务会正常提交已经成功的那一半落账；
  - 之后 `buildRuleRewardSettlementResult()` 又会因为任一结果失败把整体 `success` 置为 `false`。
- 影响：
  - 上层看到的是“整次奖励失败”，但底层可能已经真实发了一半资产；
  - 若上游据此重试，会反复命中一边幂等、一边继续失败，形成难以解释的部分到账；
  - 这和任务奖励 `tryRewardTaskComplete()` 的“任一资产失败就整体失败”语义不一致。
- 建议：
  - 明确聚合语义：要么两种资产原子成功/失败，要么把返回结构升级为显式“部分成功”并让调用方按该语义处理；
  - 若业务期望整次奖励一致，`tryRewardByRule()` 应在任一资产 `success=false` 时抛异常回滚；
  - 补一组回归测试：积分规则存在、经验规则缺失 / 达限时，不允许留下半笔落账。

### 2. [必须修复] 通知投影仍是“先查再写”，重复 dispatch 或并发消费会把幂等成功误判成失败

- 位置：
  - `libs/message/src/eventing/notification-projection.service.ts:68-137`
  - `libs/message/src/eventing/notification-projection.service.ts:140-194`
  - `libs/message/src/eventing/message-domain-event-dispatch.worker.ts:39-70`
  - `db/schema/message/user-notification.ts:50-68`
- 问题：
  - `append` / `upsert` 都先 `findFirst()` 再 `insert()` / `update()`；
  - `user_notification` 上同时存在 `(receiver_user_id, projection_key)` 唯一约束；
  - 两个并发执行流都读到“不存在”时，其中一个 `insert` 会触发唯一冲突；
  - worker 会把这个本应视为幂等成功的场景记成 `FAILED` / `RETRYING`。
- 影响：
  - 用户侧通知读模型虽然通常只会保留一条，但后台 dispatch 会被错误记为失败；
  - 失败监控、补偿重试、运维排查都会被放大噪音污染；
  - 后面和任务提醒链路叠加时，这个问题会被更频繁触发。
- 建议：
  - 改成数据库原子幂等写法，如 `on conflict do nothing / do update`；
  - 对唯一冲突显式收敛为“幂等成功”，不要让异常冒泡到 worker；
  - 增加并发 / 重复投递场景测试，当前仅覆盖串行命中已有投影的路径。

### 3. [建议修改] 任务提醒发布前的幂等判重同样是“先查再发”，并发时会制造重复 dispatch

- 位置：
  - `libs/growth/src/task/task.service.support.ts:1693-1713`
  - `libs/growth/src/task/task.service.support.ts:1720-1755`
  - `libs/platform/src/modules/eventing/domain-event-publisher.service.ts:30-84`
  - `db/schema/system/domain-event.ts:15-60`
  - `libs/growth/src/task/test/task-reminder-dedupe.spec.ts:22-47`
- 问题：
  - `publishTaskReminderIfNeeded()` 先查 `domain_event.context.projectionKey`，再调用 `publish()`；
  - `domain_event` 表本身没有针对 reminder `projectionKey` 的唯一约束，发布器也没有 `onConflict` 幂等；
  - 因此并发请求会一起通过前置查询，然后各自写入一条重复事件；
  - 现有测试只覆盖“串行查询命中已有 projectionKey 不再发布”，没有覆盖并发竞争。
- 影响：
  - 重复 dispatch 会继续触发上面的通知投影唯一冲突问题；
  - 最终表现为“提醒重复入队 + 投影失败重试”，让任务奖励提醒链路充满误报；
  - 这会同时影响自动分配提醒、即将过期提醒、奖励到账提醒三条链路。
- 建议：
  - 不要依赖“先查 domain_event 再发布”实现幂等；
  - 把 reminder 事件引入稳定幂等键并落到数据库唯一约束，或直接让 publisher 支持主题内幂等；
  - 至少补一条并发发布测试，验证重复 publish 不会制造重复 dispatch。

### 4. [建议修改] 原生 WebSocket 仍允许通过 URL query 传 access token，存在明显凭证泄露面

- 位置：
  - `libs/message/src/notification/notification-websocket.service.ts:475-504`
  - `libs/message/src/notification/notification-native-websocket.server.ts:158-160`
  - `libs/message/src/notification/notification-native-websocket.server.ts:228-240`
- 问题：
  - 原生 WS 握手仍然优先读取 `?token=`；
  - 同一套链路已经支持 `Authorization` 头和连接后的显式鉴权消息，因此 query token 不是唯一方案。
- 影响：
  - token 会进入代理层 URL 日志、历史地址、监控采样、异常回放等被动暴露面；
  - 一旦外围链路记录完整 URL，就会放大 access token 泄露风险。
- 建议：
  - 下线 query token，保留 `Authorization` 头或连接后的 `auth` 消息；
  - 如果必须保留 URL 方案，应改成短时效、一次性、仅 WS 使用的临时票据，而不是主 access token。

### 5. [建议修改] 通知分类在两个文件里各维护一份事实源，管理端遇到漂移会直接抛 500

- 位置：
  - `libs/message/src/notification/notification.constant.ts:13-68`
  - `libs/message/src/eventing/message-event.constant.ts:19-226`
  - `apps/admin-api/src/modules/message/message-template.service.ts:102-106`
- 问题：
  - `categoryKey` 与中文 label 在 `notification.constant.ts` 和 `message-event.constant.ts` 各维护一份；
  - 管理端模板服务遇到未知分类时直接 `throw new Error(...)`。
- 影响：
  - 未来新增分类只要漏改其中一份，代码可能编译通过但管理端运行时直接 500；
  - 对脏数据、历史数据、半迁移状态没有任何降级能力。
- 建议：
  - 收敛到单一事实源，只保留一份分类键与标签定义；
  - 管理端映射层对未知分类改成业务异常或降级显示，不要抛裸 `Error`。

### 6. [建议修改] 用户通知分页没有服务端稳定默认排序，翻页结果仍可能重复、漏项或漂移

- 位置：
  - `libs/message/src/notification/notification.service.ts:37-63`
  - `db/extensions/findPagination.ts:117-125`
- 问题：
  - `queryUserNotificationList()` 直接把分页参数传给 `findPagination()`，没有补默认 `orderBy`；
  - `findPagination()` 在未传入排序时只做 `limit/offset`，不会自动补稳定排序。
- 影响：
  - PostgreSQL 不保证无排序分页的结果稳定；
  - 对通知这种时间序列列表，用户会碰到“最新不在前面”、跨页重复、漏读等问题。
- 建议：
  - 服务端固定补上 `createdAt desc, id desc`；
  - 不要把稳定排序责任留给客户端。

## 已复核但当前已修复的点

- 通知列表 DTO 契约泄露 `projectionKey`、`payload` 类型漂移：
  - 当前已通过 `mapUserNotificationToPublicView()` 收口为公开视图；
  - 对应文件：
    - `libs/message/src/notification/notification-public.mapper.ts`
    - `libs/message/src/notification/dto/notification.dto.ts`
    - `libs/message/src/notification/notification.service.spec.ts`

## 测试覆盖结论

### 已有覆盖

- 通知列表公开视图映射
- 串行场景下的通知投影幂等
- 任务提醒“命中已发布 projectionKey 不重复发布”的串行判重
- 通知事件消费者的基础命令映射

### 关键缺失

- `UserGrowthRewardService.tryRewardByRule()` 的部分成功 / 回滚语义测试
- `NotificationProjectionService` 的并发唯一冲突测试
- `TaskServiceSupport.publishTaskReminderIfNeeded()` 的并发判重测试
- 原生 WS 鉴权入口的安全回归测试

## 建议处理顺序

1. 先修 `tryRewardByRule()` 的部分成功语义，避免奖励链路留下半笔落账。
2. 再修通知投影的数据库原子幂等，消掉错误失败噪音。
3. 然后处理任务提醒发布幂等，避免继续制造重复 dispatch。
4. 同步下线 WS query token 鉴权入口。
5. 最后收敛通知分类事实源，并给通知列表补稳定默认排序。

## 剩余风险

- 本次明确没有继续外扩到 chat、comment 等非主题业务域；若这些域未来同样使用同一基础设施模式，仍可能存在同类问题。
- 通知专项旧报告中的个别结论已经和当前工作区脱节，后续不应直接把旧报告当作当前事实源。
