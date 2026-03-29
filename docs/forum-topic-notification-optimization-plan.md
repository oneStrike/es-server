# 论坛主题通知收口与动态文案优化方案

## 1. 背景与目标

当前通知域已经具备 `outbox + template + preference + delivery` 的最小闭环，但论坛主题相关通知仍存在两类问题：

- 通知事件的构造分散在业务模块内，`bizKey / eventType / payload / fallback 文案` 没有统一收口。
- 论坛主题点赞、收藏、评论、评论回复的通知文案仍偏静态，无法稳定表达“谁对哪条主题做了什么”。

本次方案需要把两类诉求一起解决：

- 收口通知构造逻辑，降低重复代码和字段漂移风险。
- 支持论坛主题通知的动态文案，目标样式如下：
  - 主题被点赞：标题为“`xxx 点赞了你的主题`”，正文为“主题标题”
  - 主题被收藏：标题为“`xxx 收藏了你的主题`”，正文为“主题标题”
  - 主题被评论：标题为“`xxx 评论了你的主题`”，正文为“评论内容摘要”
  - 评论收到回复：标题为“`xxx 回复了你的评论`”，正文为“回复内容摘要”

本方案默认遵守现有通知域契约：

- 模板层只负责渲染，不负责选接收人、生成幂等键、判定偏好。
- 业务侧仍然必须提供 fallback `title / content`。
- `user_notification` 仍然是用户侧通知唯一读模型。

## 2. 当前代码锚点

- `libs/interaction/src/comment/comment.service.ts`
- `libs/interaction/src/comment/comment.type.ts`
- `libs/interaction/src/comment/interfaces/comment-target-resolver.interface.ts`
- `libs/interaction/src/comment/resolver/comment-like.resolver.ts`
- `libs/interaction/src/like/interfaces/like-target-resolver.interface.ts`
- `libs/interaction/src/favorite/interfaces/favorite-target-resolver.interface.ts`
- `libs/forum/src/topic/resolver/forum-topic-like.resolver.ts`
- `libs/forum/src/topic/resolver/forum-topic-favorite.resolver.ts`
- `libs/forum/src/topic/resolver/forum-topic-comment.resolver.ts`
- `libs/message/src/outbox/outbox.type.ts`
- `libs/message/src/outbox/outbox.service.ts`
- `libs/message/src/notification/notification.constant.ts`
- `libs/message/src/notification/notification.service.ts`
- `libs/message/src/notification/notification-template.service.ts`
- `db/seed/modules/message/domain.ts`
- `docs/notification-domain-contract.md`

## 3. 当前问题梳理

### 3.1 通知类型存在双写风险

当前通知 outbox 输入同时包含：

- `dto.eventType`
- `dto.payload.type`

这两个字段表达的是同一个通知类型，但来自两处不同输入，后续极易出现漂移。

### 3.2 通知构造分散，文案重复硬编码

评论回复、评论点赞、主题点赞、主题收藏、公告、任务提醒都各自在业务模块内手写：

- `bizKey`
- `payload`
- fallback `title / content`

这会导致：

- 同类通知的字段结构不一致
- 默认文案重复维护
- 后续改成动态文案时，需要在多处业务模块同步改动

### 3.3 模板层无法支撑主题专属文案的现状

模板层当前是“按 `MessageNotificationTypeEnum` 一对一配置”。  
但论坛主题点赞当前复用了 `COMMENT_LIKE`，论坛主题收藏当前复用了 `CONTENT_FAVORITE`。

这会直接带来 3 个问题：

- 模板文案无法同时兼顾“评论点赞”和“主题点赞”
- 偏好控制粒度会被污染，用户无法区分“评论点赞通知”和“主题点赞通知”
- delivery / 监控上的通知类型统计语义不准确

### 3.4 论坛主题“被评论”通知尚未落地

当前评论服务只处理“评论回复通知”，论坛主题的 `postCommentHook` 仅负责同步计数，没有真正发送“主题被评论”通知。

### 3.5 评论相关动态文案缺少展示快照

要支持“`xxx 回复了你的评论` / `回复内容摘要`”这类文案，当前 payload 至少还缺：

- `actorNickname`
- `topicTitle`
- `commentExcerpt`
- `replyExcerpt`

如果不补这些快照，就只能继续用固定文案，或者在模板渲染时回查业务表，这不符合当前 outbox 设计边界。

### 3.6 回复链路存在一次可省的重复查询

`replyComment(...)` 里已经查过被回复评论及其 `userId`，但后续补偿逻辑里又再次查询了被回复者，存在一次可避免的重复读。

### 3.7 模板服务每次渲染都查表，且缺少保存期校验

当前模板渲染前会实时查询 `notification_template`，没有类型级缓存。  
同时，占位符是否合法大多要到运行时渲染时才暴露，配置错误发现偏晚。

## 4. 方案选择

| 方案 | 做法 | 优点 | 问题 |
| --- | --- | --- | --- |
| 方案 A | 保留现有 `COMMENT_LIKE / CONTENT_FAVORITE` 复用关系，只把 payload 和文案改成动态 | 代码改动相对少 | 模板、偏好、监控语义继续混用，不适合长期维护 |
| 方案 B（推荐） | 为论坛主题拆分独立通知类型，并同步收口通知构造与模板缓存 | 类型语义清晰，偏好与模板互不污染，方便后续继续扩展 | 改动文件更多，但边界更稳 |

本方案推荐 **方案 B**。

## 5. 推荐产品文案

| 场景 | 推荐通知类型 | 标题 | 正文 | 备注 |
| --- | --- | --- | --- | --- |
| 主题被点赞 | `TOPIC_LIKE` | `{{payload.actorNickname}} 点赞了你的主题` | `{{payload.topicTitle}}` | 正文使用主题标题 |
| 主题被收藏 | `TOPIC_FAVORITE` | `{{payload.actorNickname}} 收藏了你的主题` | `{{payload.topicTitle}}` | 正文使用主题标题 |
| 主题被评论 | `TOPIC_COMMENT` | `{{payload.actorNickname}} 评论了你的主题` | `{{payload.commentExcerpt}}` | 正文使用评论内容摘要 |
| 评论收到回复 | `COMMENT_REPLY` | `{{payload.actorNickname}} 回复了你的评论` | `{{payload.replyExcerpt}}` | 正文使用回复内容摘要 |

### 5.1 正文摘要规则

- `topicTitle` 直接使用主题标题，必要时做长度截断。
- `commentExcerpt`、`replyExcerpt` 对原始内容做轻量标准化：
  - 去首尾空白
  - 合并换行与连续空白
  - 截断到约 40 到 80 个可读字符
- 若评论内容或回复内容无法生成可读摘要，则回退为主题标题。
- 若主题标题也不可用，则回退为当前固定兜底文案。

## 6. 推荐技术方案

### 6.1 拆分论坛主题专用通知类型

建议在 `MessageNotificationTypeEnum` 中新增以下类型，并保留旧类型不变：

- `TOPIC_LIKE`
- `TOPIC_FAVORITE`
- `TOPIC_COMMENT`

保留关系建议如下：

- `COMMENT_LIKE` 只用于“评论被点赞”
- `CONTENT_FAVORITE` 只用于真正的通用内容收藏场景
- `COMMENT_REPLY` 继续用于“评论收到回复”
- 论坛主题相关动作不再复用 `COMMENT_LIKE / CONTENT_FAVORITE`

命名建议直接沿用 repo 内既有 `topic` 领域语义，避免同时出现 `FORUM_TOPIC_*` 与 `TOPIC_*` 两套口径。

### 6.2 通知 outbox 契约收口为单一事实源

建议把通知 outbox 输入收口为以 `payload.type` 为唯一通知类型来源。

建议目标接口：

```ts
export interface CreateNotificationOutboxEventInput {
  bizKey: string
  payload: NotificationOutboxPayload
}
```

`message_outbox.eventType` 在 `MessageOutboxService` 写库时由 `payload.type` 派生。

兼容过渡策略：

- 第一阶段把 `eventType` 改为可选
- 若调用方仍传 `eventType`，则在 service 内校验它必须等于 `payload.type`
- 第二阶段迁完全部调用方后，再彻底删除 `eventType`

### 6.3 新增通知 composer，统一构造 fallback 文案与 payload

建议在 `libs/message/src/notification/` 下新增 `message-notification-composer.service.ts`，职责如下：

- 统一构造通知 outbox event
- 统一补 fallback `title / content`
- 统一填充 `subjectType / subjectId / payload`
- 不负责选择接收人、不负责生成业务幂等键

建议提供如下接口：

- `buildTopicLikeEvent(...)`
- `buildTopicFavoriteEvent(...)`
- `buildTopicCommentEvent(...)`
- `buildCommentReplyEvent(...)`
- `buildEvent(...)`

业务模块只负责传入已确认的业务事实：

- `receiverUserId`
- `actorUserId`
- `bizKey`
- `targetId / subjectId`
- 展示快照字段，如 `actorNickname / topicTitle / commentExcerpt / replyExcerpt`

### 6.4 展示快照统一放进 `payload.payload`

建议继续复用 `NotificationOutboxPayload.payload?: unknown`，但在通知域内补一组明确的 typed payload：

- `TopicLikeNotificationPayload`
- `TopicFavoriteNotificationPayload`
- `TopicCommentNotificationPayload`
- `CommentReplyNotificationPayload`

建议字段如下：

| 通知类型 | 建议快照字段 |
| --- | --- |
| `TOPIC_LIKE` | `actorNickname`、`topicTitle` |
| `TOPIC_FAVORITE` | `actorNickname`、`topicTitle` |
| `TOPIC_COMMENT` | `actorNickname`、`topicTitle`、`commentExcerpt` |
| `COMMENT_REPLY` | `actorNickname`、`replyExcerpt`、`targetDisplayTitle?` |

这里的设计原则是：

- 模板和 fallback 文案只消费快照，不在 worker 渲染期回查业务表
- 已存量的 `title / content` 继续作为最终兜底
- `payload.payload` 只承载展示快照和轻量上下文，不把完整业务对象塞进 outbox

### 6.5 论坛主题元数据向上游透传，减少重复查询

为了让主题点赞、收藏、评论都能直接拿到主题标题和属主信息，建议扩展 3 组解析器接口：

#### 6.5.1 点赞解析器

扩展 `LikeTargetMeta`，新增可选字段：

- `ownerUserId?: number`
- `targetTitle?: string`

论坛主题点赞 resolver 在 `resolveMeta(...)` 阶段直接返回：

- `ownerUserId`
- `targetTitle`
- 现有 `sceneType / sceneId`

这样 `postLikeHook(...)` 就不需要再单独查一次主题。

#### 6.5.2 收藏解析器

扩展 `IFavoriteTargetResolver.ensureExists(...)` 返回值与 `postFavoriteHook(...)` 选项：

- `ownerUserId?: number`
- `targetTitle?: string`

这样主题收藏主链路可以把主题标题一并透传到通知构造层。

#### 6.5.3 评论目标解析器

扩展 `CommentTargetMeta`，新增：

- `targetTitle?: string`

论坛主题评论 resolver 的 `resolveMeta(...)` 直接补回：

- `ownerUserId`
- `sectionId`
- `targetTitle`

这样后续评论通知和回复通知都能拿到主题标题兜底。

### 6.6 评论主链路补齐内容摘要与回复目标快照

为了支持“主题被评论”和“评论收到回复”的动态正文，建议扩展评论可见副作用载荷：

- `content`
- `replyTargetUserId?`

涉及的具体调整：

- `VisibleCommentEffectPayload` 增加 `content`
- `CommentModerationState` 增加 `content`
- `replyComment(...)` 已查到被回复者时，直接把 `replyTargetUserId` 透传给补偿逻辑
- 审核补偿、取消隐藏等路径若没有 `replyTargetUserId`，仍保留现有兜底查询

### 6.7 评论 resolver 的 post hook 签名需要升级

当前 `postCommentHook(...)` 只有：

- `targetId`
- `actorUserId`
- `meta`

这不足以支撑“主题被评论”通知，因为该通知需要知道：

- 当前可见评论是不是一级评论
- 当前评论的正文内容
- 当前评论自身 `id`

建议把评论 hook 升级为接收完整的可见评论载荷，例如：

```ts
postCommentHook?: (
  tx: Db,
  comment: VisibleCommentEffectPayload,
  meta: CommentTargetMeta,
) => Promise<void>
```

这样论坛主题评论 resolver 就可以：

- 仅在 `replyToId` 为空时发送 `TOPIC_COMMENT`
- 使用 `comment.content` 生成 `commentExcerpt`
- 使用 `meta.targetTitle` 作为正文兜底
- 保持回复通知继续由 `CommentService.compensateVisibleCommentEffects(...)` 处理

### 6.8 模板层改成“动态模板 + 业务 fallback”

建议对通知模板定义做两件事：

- 为新增通知类型补模板定义与默认 seed
- 将相关默认模板改成消费展示快照的动态模板

推荐默认模板：

| 类型 | 默认标题模板 | 默认正文模板 |
| --- | --- | --- |
| `TOPIC_LIKE` | `{{payload.actorNickname}} 点赞了你的主题` | `{{payload.topicTitle}}` |
| `TOPIC_FAVORITE` | `{{payload.actorNickname}} 收藏了你的主题` | `{{payload.topicTitle}}` |
| `TOPIC_COMMENT` | `{{payload.actorNickname}} 评论了你的主题` | `{{payload.commentExcerpt}}` |
| `COMMENT_REPLY` | `{{payload.actorNickname}} 回复了你的评论` | `{{payload.replyExcerpt}}` |

同时保留业务 fallback：

- `TOPIC_LIKE` fallback 标题为“`{actorNickname} 点赞了你的主题`”，正文为“主题标题”
- `TOPIC_FAVORITE` fallback 标题为“`{actorNickname} 收藏了你的主题`”，正文为“主题标题”
- `TOPIC_COMMENT` fallback 标题为“`{actorNickname} 评论了你的主题`”，正文为“评论摘要”
- `COMMENT_REPLY` fallback 标题为“`{actorNickname} 回复了你的评论`”，正文为“回复摘要”

### 6.9 模板服务增加缓存与保存期校验

建议对 `MessageNotificationTemplateService` 做两类增强：

#### 6.9.1 类型级缓存

- 以 `notificationType` 为 key 做本地内存缓存
- 缓存启用模板和“不存在模板”的结果
- TTL 建议 30 到 60 秒
- 在 `create / update / delete / enabled switch` 成功后本地失效

#### 6.9.2 占位符白名单校验

在保存模板时预先校验 `{{...}}` 路径是否合法，至少允许：

- `notificationType`
- `templateKey`
- `receiverUserId`
- `actorUserId`
- `targetType`
- `targetId`
- `subjectType`
- `subjectId`
- `aggregateKey`
- `aggregateCount`
- `expiredAt`
- `payload.*`

这样可把一部分模板错误前移到保存期，而不是等到 worker 消费时才 fallback。

## 7. 预计改动文件

### 7.1 消息域

- `libs/message/src/notification/notification.constant.ts`
- `libs/message/src/notification/notification.type.ts`
- `libs/message/src/notification/notification-template.service.ts`
- `libs/message/src/notification/notification.service.ts`
- `libs/message/src/notification/` 下新增 composer 与 typed payload 文件
- `libs/message/src/outbox/outbox.type.ts`
- `libs/message/src/outbox/outbox.service.ts`
- `db/seed/modules/message/domain.ts`

### 7.2 互动域

- `libs/interaction/src/comment/comment.service.ts`
- `libs/interaction/src/comment/comment.type.ts`
- `libs/interaction/src/comment/interfaces/comment-target-resolver.interface.ts`
- `libs/interaction/src/like/interfaces/like-target-resolver.interface.ts`
- `libs/interaction/src/favorite/interfaces/favorite-target-resolver.interface.ts`

### 7.3 论坛域

- `libs/forum/src/topic/resolver/forum-topic-like.resolver.ts`
- `libs/forum/src/topic/resolver/forum-topic-favorite.resolver.ts`
- `libs/forum/src/topic/resolver/forum-topic-comment.resolver.ts`

### 7.4 DTO / 管理端 / 文档

- `apps/app-api/src/modules/message/dto/message.dto.ts`
- `apps/admin-api/src/modules/message/dto/message-template.dto.ts`
- `apps/admin-api/src/modules/message/dto/message-monitor.dto.ts`
- `docs/notification-domain-contract.md`

## 8. 分阶段实施建议

### 阶段 1：先收口类型与契约

- 为论坛主题新增 `TOPIC_LIKE / TOPIC_FAVORITE / TOPIC_COMMENT`
- 更新模板定义、偏好类型列表、监控与 DTO 枚举
- 让通知 outbox 类型以 `payload.type` 为单一事实源

完成后收益：

- 论坛主题通知不再污染评论点赞与通用收藏语义
- 偏好、模板、delivery 的统计语义开始准确

### 阶段 2：引入 composer 与快照字段

- 新增 `MessageNotificationComposerService`
- 收口 topic like / favorite / comment reply 的 fallback 文案构造
- 补 `actorNickname / topicTitle / commentExcerpt / replyExcerpt`

完成后收益：

- 通知文案不再分散在各业务模块硬编码
- 后续继续迭代文案时只动一层

### 阶段 3：补齐论坛主题“被评论”通知

- 升级 `postCommentHook(...)` 签名
- 让论坛主题评论 resolver 在一级评论首次可见时发送 `TOPIC_COMMENT`
- 回复评论继续沿用 `COMMENT_REPLY`

完成后收益：

- 论坛主题四类核心通知能力完整闭环

### 阶段 4：模板服务增强

- 增加模板缓存
- 增加保存期占位符校验
- 补齐对应单测

完成后收益：

- 降低通知主链路的重复查库
- 减少模板错误上线后才被发现的概率

## 9. 测试与验证建议

至少补以下测试：

- `outbox.service` 单测
  - `payload.type` 能正确派生 `eventType`
  - 兼容期传错 `eventType` 会报错
- `notification-template.service` 单测
  - 模板缓存命中与失效
  - 占位符白名单校验
  - 缺模板、禁用模板、渲染失败时 fallback 生效
- `comment.service` 单测
  - 评论回复通知改为动态文案后仍正确入队
  - `replyTargetUserId` 透传时不再重复查询
- 论坛主题 resolver 单测
  - 点赞通知写入 `TOPIC_LIKE`
  - 收藏通知写入 `TOPIC_FAVORITE`
  - 一级评论首次可见时写入 `TOPIC_COMMENT`
  - 回复评论不会误发 `TOPIC_COMMENT`
- `notification.service` 单测
  - 新类型能正常创建 `user_notification`
  - 标题/正文采用渲染结果或 fallback 结果

建议执行的校验命令：

- `pnpm type-check`
- 对触达模块执行针对性单测
- 对触达文件执行 `eslint`

## 10. 数据与兼容性说明

- 本方案默认 **不新增表结构**，因为通知类型使用 `smallint` 存储，不依赖数据库原生 enum。
- 需要补新的模板定义与 seed 数据；如果环境不是依赖全量 seed 初始化，还需要一次性补录新类型模板。
- 历史 `user_notification` 数据不做回写，旧通知保持旧类型与旧文案。
- 前端若按通知类型做筛选或文案映射，需要同步识别新增的 `TOPIC_*` 类型。

## 11. 风险与注意点

- 若只改文案、不拆类型，会继续把主题点赞混进评论点赞、把主题收藏混进通用内容收藏，长期维护风险较高。
- `COMMENT_REPLY` 仍是跨内容域的通用通知类型，因此其默认模板应保持“回复你的评论”这种通用表达，不要写成“回复了你的主题评论”。
- `TOPIC_COMMENT` 只应在一级评论首次可见时发送，回复评论不能重复触发这类通知。
- 评论与回复摘要必须做截断和空值兜底，避免通知列表过长或出现空正文。

## 12. 完成标准

- 论坛主题点赞、收藏、评论、评论回复四类通知都能展示为动态文案
- 论坛主题点赞、收藏、评论拥有独立通知类型，不再复用 `COMMENT_LIKE / CONTENT_FAVORITE`
- 回复通知继续保持独立链路，但正文从固定文案升级为回复摘要
- 通知 outbox 类型来源完成收口，业务侧不再需要双写 `eventType / payload.type`
- 模板层仍然只负责渲染，业务 fallback 仍然完整保留
