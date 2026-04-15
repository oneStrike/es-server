# 用户通知模块审查清单（2026-04-15）

## 审查范围

- `apps/app-api/src/modules/message/message.controller.ts`
- `apps/admin-api/src/modules/message/message.controller.ts`
- `apps/admin-api/src/modules/message/message-template.controller.ts`
- `apps/admin-api/src/modules/message/message-template.service.ts`
- `apps/admin-api/src/modules/message/message-monitor.service.ts`
- `libs/message/src/notification/*`
- `libs/message/src/eventing/notification-*`
- `libs/message/src/eventing/message-domain-event-dispatch.worker.ts`
- `libs/message/src/eventing/message-event.constant.ts`
- `libs/message/src/eventing/message-domain-event.factory.ts`
- `libs/message/src/inbox/inbox.service.ts`
- `db/schema/message/user-notification.ts`
- `db/schema/message/notification-preference.ts`
- `db/schema/message/notification-template.ts`
- `db/schema/message/notification-delivery.ts`
- 已存在相关测试：`notification.service.spec.ts`、`notification-delivery.service.spec.ts`、`notification-projection.service.spec.ts`、`notification-event-consumer.spec.ts`、`message-monitor.service.spec.ts`

## 总体结论

通知模块的分层基本清楚：事件生产、投影、偏好、模板、实时推送、管理端监控已经拆开；但当前仍有几处会直接影响线上正确性和安全性的缺口，其中有 2 项建议按“必须修复”处理。

## 发现的问题

### 1. [必须修复] 用户通知分页缺少稳定默认排序，翻页结果可能重复、漏项或顺序漂移

- 位置：
  - `libs/message/src/notification/notification.service.ts:38-59`
  - `db/extensions/findPagination.ts:117-124`
- 问题：
  - `queryUserNotificationList()` 直接把分页参数传给 `findPagination()`，但没有指定 `orderBy`。
  - `findPagination()` 在未传入排序时不会补默认排序，最终 SQL 只有 `limit/offset`，没有 `order by`。
- 影响：
  - PostgreSQL 不保证无排序分页的结果稳定。
  - 对通知这种时间序列数据，用户会看到“最新消息不在前面”、跨页重复、漏读等问题。
- 建议：
  - 固定补上 `createdAt desc, id desc`。
  - 不要依赖客户端传 `orderBy` 才得到稳定结果，用户侧列表接口应有服务端默认排序。

### 2. [必须修复] 通知投影幂等是“先查再写”，并发或重试时会把成功场景误判成失败

- 位置：
  - `libs/message/src/eventing/notification-projection.service.ts:68-127`
  - `libs/message/src/eventing/notification-projection.service.ts:140-184`
  - `libs/message/src/eventing/message-domain-event-dispatch.worker.ts:52-70`
  - `db/schema/message/user-notification.ts:51-54`
- 问题：
  - `append` / `upsert` 都是先 `findFirst()`，再 `insert()` / `update()`。
  - `user_notification` 上又有 `(receiver_user_id, projection_key)` 唯一约束。
  - 一旦发生 worker 重试、并发消费或同一事件重复投递，两个执行流都可能先读到“不存在”，随后其中一个在 `insert` 时触发唯一冲突。
- 影响：
  - 本应被视为幂等成功的场景，会落入 worker 的异常分支，被记录成 `FAILED` / `RETRYING`。
  - 管理端监控会出现误报，且重复重试会继续放大噪音。
- 建议：
  - 把 `append` / `upsert` 改成数据库原子幂等写法，例如 `insert ... on conflict do nothing/do update`。
  - 对唯一冲突显式收敛为“幂等成功”结果，而不是让异常冒泡到 dispatch worker。
  - 补一条并发/唯一冲突场景测试，当前测试只覆盖“先查到已有数据”的串行情形，没有覆盖 race condition。

### 3. [建议修改] 原生 WebSocket 允许通过 URL query 传 access token，存在凭证泄露面

- 位置：
  - `libs/message/src/notification/notification-websocket.service.ts:475-504`
  - `libs/message/src/notification/notification-native-websocket.server.ts:82-93`
  - `libs/message/src/notification/notification-native-websocket.server.ts:157-176`
- 问题：
  - 当前原生 WS 支持从 `?token=` 读取 access token。
  - 同一套链路已经支持 `Authorization` 头和连接后的 `auth` 事件鉴权，因此 query token 不是唯一方案。
- 影响：
  - token 会出现在代理日志、接入层监控、历史 URL、崩溃采样等位置，属于典型凭证泄露面。
  - 一旦外围设施记录完整 URL，access token 就会被被动扩散。
- 建议：
  - 禁止 query token，保留 `Authorization` 头或连接后的 `auth` 消息。
  - 如果确实要支持 URL 参数，应改成短时效、一次性、仅 WS 可用的临时票据，而不是主 access token。

### 4. [建议修改] 用户通知列表的实际响应与 DTO 契约不一致，存在隐藏字段泄露和类型漂移

- 位置：
  - `libs/message/src/notification/dto/notification.dto.ts:47-53`
  - `libs/message/src/notification/dto/notification.dto.ts:76-81`
  - `libs/message/src/notification/notification.service.ts:83-94`
  - `libs/platform/src/decorators/validate/contract.ts:7-18`
- 问题：
  - DTO 把 `projectionKey` 标成了 `contract: false`，按设计它不应属于对外 HTTP 契约。
  - DTO 又把 `payload` 定义成 JSON 字符串。
  - 但 service 直接返回数据库行 `...item`，因此真实响应里会带出 `projectionKey`，且 `payload` 实际是对象而不是字符串。
- 影响：
  - 文档、SDK 类型和真实返回值不一致，前端或生成客户端容易出现解析错误。
  - 内部幂等键被直接暴露给客户端，和 `contract: false` 的设计意图相违背。
- 建议：
  - 在 service 层显式映射返回 DTO，不要直接透传表记录。
  - 二选一统一契约：
    - 要么把 `payload` 明确定义成对象 DTO；
    - 要么在响应层统一序列化为字符串。
  - `projectionKey` 若确实不对外，就不要进入响应对象。

### 5. [建议修改] 通知分类常量存在双份事实源，配置漂移时会把管理端接口打成 500

- 位置：
  - `libs/message/src/notification/notification.constant.ts:13-67`
  - `libs/message/src/eventing/message-event.constant.ts:19-29`
  - `libs/message/src/eventing/message-event.constant.ts:194-226`
  - `apps/admin-api/src/modules/message/message-template.service.ts:102-106`
- 问题：
  - `categoryKey` 与 `label` 在 `notification.constant.ts` 和 `message-event.constant.ts` 各维护了一套。
  - 管理端模板服务遇到未知分类时直接 `throw new Error(...)`。
- 影响：
  - 以后新增通知分类时，只要漏改其中一份常量，部分链路就会出现“编译通过、运行时 500”。
  - 管理端列表/详情页对脏数据或配置漂移没有降级处理。
- 建议：
  - 收敛到单一事实源，只保留一份 `categoryKey/label` 定义。
  - 管理端映射层对异常分类改成业务异常或降级显示，不要直接抛裸 `Error`。

## 测试与覆盖面结论

### 已有测试覆盖到的内容

- 通知列表基础映射与 `categoryKeys` 入参转换
- 投递结果回填 `categoryKey`
- `comment.replied` 事件的基础 handler 映射
- `append` 命中已存在投影时的串行幂等路径
- 管理端 dispatch 分页的基础序列化

### 目前缺失的关键测试

- `NotificationProjectionService` 的并发唯一冲突/重试幂等测试
- `MessageNotificationPreferenceService` 的显式覆盖、删除回默认值、重复分类校验测试
- `MessageNotificationTemplateService` 的占位符校验、缓存失效、渲染失败回退测试
- `MessageWebSocketService` / `MessageGateway` / `MessageNativeWebSocketServer` 的鉴权、ack、非法消息、断链清理测试
- 用户通知列表默认排序与跨页稳定性测试
- 响应 DTO 与实际序列化结果一致性的契约测试

## 建议整改顺序

1. 先修复通知分页默认排序。
2. 再把投影写入改成数据库原子幂等，并补并发/重试回归测试。
3. 下线原生 WS 的 query token 鉴权入口。
4. 收敛通知列表响应映射，修正 `payload` 与 `projectionKey` 的契约。
5. 最后清理分类常量双份定义，并补模板/偏好/WebSocket 侧测试。
