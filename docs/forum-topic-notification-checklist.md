# 论坛主题通知改造执行清单

## 1. 文档目标

本文用于把 [论坛主题通知收口与动态文案优化方案](./forum-topic-notification-optimization-plan.md) 进一步整理成“可执行、可勾选、可验收”的清单。

本文不是：

- 领域设计文档
- 完整技术方案全文复写
- 单文件级 diff 清单

使用方式：

1. 先以 [forum-topic-notification-optimization-plan.md](./forum-topic-notification-optimization-plan.md) 作为设计事实源
2. 开工时按本文逐项勾选
3. 联调与收尾时优先检查“回归清单”和“阻塞上线项”

## 2. 设计事实源

以下事项以 [forum-topic-notification-optimization-plan.md](./forum-topic-notification-optimization-plan.md) 为准：

- 通知类型拆分方案
- 论坛主题通知文案口径
- payload 快照字段设计
- composer 与模板缓存方案
- 分阶段实施建议
- 当前范围与后续全通知域推广原则

本文不再重复展开设计理由，避免两份文档漂移。

### 2.1 范围边界说明

- 本清单当前只覆盖论坛主题点赞、收藏、评论、评论回复四类通知。
- 本清单不要求把 `SYSTEM_ANNOUNCEMENT / TASK_REMINDER / CHAT_MESSAGE` 等非论坛通知，强行改成与论坛互动通知相同的标题 / 正文句式。
- 若后续要把这套方案推广到全通知域，应优先复用“类型语义收口、typed payload、composer、模板渲染、fallback 兜底、保存期校验”这套机制，而不是先统一所有通知 copy。

### 2.2 本轮一起交付的范围

- 本轮默认一次收口四类论坛主题通知：主题点赞、主题收藏、主题被评论、评论收到回复。
- 允许按依赖拆成多个 phase / wave 推进，但不建议把 `P1-01`、`P1-02`、`P1-03` 或 `P2-01` 延后到下一轮再做，否则论坛主题通知产品化口径仍不完整。
- `COMMENT_REPLY` 本轮继续保持跨内容域通用类型，只升级动态文案与展示兜底；若未来需要区分论坛主题 / 作品 / 章节回复，另开全通知域任务。

## 3. 实施清单

### 3.1 Phase A：先收口通知类型与契约

目标：

- 把论坛主题点赞、收藏从现有复用类型中拆出来
- 收口通知 outbox 类型来源，避免 `eventType / payload.type` 双写漂移

清单：

- [ ] 在 `MessageNotificationTypeEnum` 中新增 `TOPIC_LIKE`
- [ ] 在 `MessageNotificationTypeEnum` 中新增 `TOPIC_FAVORITE`
- [ ] 在 `MessageNotificationTypeEnum` 中新增 `TOPIC_COMMENT`
- [ ] 新增通知类型编码只允许追加，保持既有 `COMMENT_REPLY ~ TASK_REMINDER` 数值不变
- [ ] 更新通知模板定义与类型值列表
- [ ] 更新通知偏好类型列表与对应单测
- [ ] 更新通知监控 / DTO / 管理端枚举展示
- [ ] 同步 schema 注释 / Swagger 描述 / seed 示例中的通知类型口径
- [ ] 让通知 outbox 以 `payload.type` 作为唯一通知类型事实源
- [ ] 兼容期对 `eventType !== payload.type` 做显式校验
- [ ] 明确 `eventType` 字段删除属于后续全仓清理任务，本包内只完成派生与校验

关键文件：

- `libs/message/src/notification/notification.constant.ts`
- `libs/message/src/outbox/outbox.type.ts`
- `libs/message/src/outbox/outbox.service.ts`
- `db/schema/message/user-notification.ts`
- `db/seed/modules/message/domain.ts`
- `apps/app-api/src/modules/message/dto/message.dto.ts`
- `apps/admin-api/src/modules/message/dto/message-template.dto.ts`
- `apps/admin-api/src/modules/message/dto/message-monitor.dto.ts`

### 3.2 Phase B：引入通知 composer，统一构造 fallback 文案

目标：

- 不再让论坛、评论、关注等业务模块各自拼通知 payload
- 统一动态文案的 fallback 生成逻辑

清单：

- [ ] 新增 `MessageNotificationComposerService`
- [ ] 提供 `buildTopicLikeEvent(...)`
- [ ] 提供 `buildTopicFavoriteEvent(...)`
- [ ] 提供 `buildTopicCommentEvent(...)`
- [ ] 提供 `buildCommentReplyEvent(...)`
- [ ] 在 composer 层统一构造 fallback `title / content`
- [ ] 在 composer 层统一写入 typed `payload.payload`
- [ ] 保持 composer 接口风格可扩展，后续可平滑承接非论坛通知类型
- [ ] 将 composer 注册到 `MessageNotificationModule` 的 `providers / exports`，并从 notification 公共导出暴露
- [ ] 为 composer 补基础单测

关键文件：

- `libs/message/src/notification/` 下新增 composer 文件
- `libs/message/src/notification/notification.type.ts`
- `libs/message/src/notification/notification.service.spec.ts`

### 3.3 Phase C：补齐论坛主题元数据与展示快照

目标：

- 为动态文案提供稳定的业务快照
- 尽量把主题标题、属主、操作者昵称在业务侧一次查齐，避免模板层二次回查

清单：

- [ ] 扩展 `LikeTargetMeta`，支持 `ownerUserId / targetTitle`
- [ ] 扩展收藏 resolver 返回值，支持 `ownerUserId / targetTitle`
- [ ] 扩展 `CommentTargetMeta`，支持 `targetDisplayTitle`
- [ ] 统一定义论坛主题通知的快照字段结构
- [ ] 为 `TOPIC_LIKE` 补 `actorNickname / topicTitle`
- [ ] 为 `TOPIC_FAVORITE` 补 `actorNickname / topicTitle`
- [ ] 为 `TOPIC_COMMENT` 补 `actorNickname / topicTitle / commentExcerpt`
- [ ] 为 `COMMENT_REPLY` 补 `actorNickname / replyExcerpt / targetDisplayTitle?`
- [ ] 评论与回复摘要统一走标准化与截断逻辑
- [ ] 收藏链路补 `targetTitle` 透传时同步更新 `favorite.service` 转发逻辑

关键文件：

- `libs/interaction/src/like/interfaces/like-target-resolver.interface.ts`
- `libs/interaction/src/favorite/interfaces/favorite-target-resolver.interface.ts`
- `libs/interaction/src/comment/interfaces/comment-target-resolver.interface.ts`
- `libs/interaction/src/favorite/favorite.service.ts`
- `libs/message/src/notification/` 下 typed payload 文件

### 3.4 Phase D：迁移论坛主题点赞与收藏通知

目标：

- 让主题点赞、收藏使用独立通知类型和动态文案

清单：

- [ ] 论坛主题点赞改用 `TOPIC_LIKE`
- [ ] 论坛主题收藏改用 `TOPIC_FAVORITE`
- [ ] 主题点赞通知接入 composer
- [ ] 主题收藏通知接入 composer
- [ ] 点赞通知正文显示主题标题
- [ ] 收藏通知正文显示主题标题
- [ ] 自通知场景继续跳过
- [ ] 主题不存在或不可见时维持现有保护逻辑

关键文件：

- `libs/forum/src/topic/resolver/forum-topic-like.resolver.ts`
- `libs/forum/src/topic/resolver/forum-topic-favorite.resolver.ts`

### 3.5 Phase E：升级评论回复通知为动态文案

目标：

- 把现有固定“收到新的评论回复”升级为“谁回复了你的评论 + 回复摘要”

清单：

- [ ] `COMMENT_REPLY` 标题改为 `actorNickname + 回复了你的评论`
- [ ] `COMMENT_REPLY` 正文改为回复内容摘要
- [ ] 同步将 `COMMENT_REPLY` 默认模板升级为动态快照版，保证启用模板环境与 fallback 一致
- [ ] `VisibleCommentEffectPayload` 增加回复摘要所需正文内容
- [ ] `CommentModerationState` 保留正文内容，供审核补偿 / 取消隐藏复用
- [ ] `replyComment(...)` 已查到的 `replyTargetUserId` 直接透传给补偿逻辑
- [ ] 审核补偿场景保留现有兜底查询
- [ ] 回复摘要为空时回退为 `targetDisplayTitle` 或固定兜底文案
- [ ] 现有回复通知幂等键保持稳定
- [ ] 评论回复通知接入 composer
- [ ] `COMMENT_REPLY` 继续保持跨内容域通用表达，不引入论坛专属模板口径

关键文件：

- `libs/interaction/src/comment/comment.service.ts`
- `libs/interaction/src/comment/comment.type.ts`
- `libs/message/src/notification/` 下 composer / type 文件

### 3.6 Phase F：补齐论坛主题“被评论”通知

目标：

- 让论坛主题一级评论首次可见时，主题作者收到“主题被评论”通知

清单：

- [ ] 升级评论 `postCommentHook(...)` 签名，使其能拿到完整可见评论载荷
- [ ] 复用 Phase E 已补的评论副作用共享字段，不再重复改一套评论补偿底座
- [ ] 论坛主题评论 resolver 仅在一级评论场景发送 `TOPIC_COMMENT`
- [ ] 论坛主题评论通知接入 composer
- [ ] `TOPIC_COMMENT` 正文优先显示评论摘要
- [ ] 评论摘要为空时回退为主题标题
- [ ] 回复评论不会误发 `TOPIC_COMMENT`
- [ ] `forum-topic-comment.resolver` 继续保留 `syncTopicCommentState / syncSectionVisibleState` 现有副作用
- [ ] 审核通过补偿与取消隐藏补偿路径都能正确复用该逻辑

关键文件：

- `libs/interaction/src/comment/comment.type.ts`
- `libs/interaction/src/comment/comment.service.ts`
- `libs/interaction/src/comment/interfaces/comment-target-resolver.interface.ts`
- `libs/forum/src/topic/resolver/forum-topic-comment.resolver.ts`

### 3.7 Phase G：升级模板默认文案与 seed

目标：

- 让模板层支持论坛主题动态文案，同时保留业务 fallback

清单：

- [ ] 为 `TOPIC_LIKE` 增加默认模板定义
- [ ] 为 `TOPIC_FAVORITE` 增加默认模板定义
- [ ] 为 `TOPIC_COMMENT` 增加默认模板定义
- [ ] 更新通知模板 seed
- [ ] 明确哪些类型要求业务必须提供 fallback
- [ ] 保证模板缺失 / 禁用 / 渲染失败时仍可发送 fallback 文案

关键文件：

- `libs/message/src/notification/notification.constant.ts`
- `db/seed/modules/message/domain.ts`
- `libs/message/src/notification/notification-template.service.ts`

### 3.8 Phase H：增强模板服务可用性

目标：

- 减少模板渲染主链路查库
- 尽量把模板错误提前到保存期

清单：

- [ ] 为模板服务增加按 `notificationType` 的本地缓存
- [ ] 支持缓存“无模板”结果
- [ ] 在创建模板后失效缓存
- [ ] 在更新模板后失效缓存
- [ ] 在模板启停切换后失效缓存
- [ ] 在删除模板后失效缓存
- [ ] 按 `notificationType` 增加模板占位符白名单校验
- [ ] 对固定根字段与 typed payload 字段分别校验
- [ ] 保存包含非法路径或未注册 payload 字段的模板时直接报错
- [ ] 保留运行时 fallback 兜底

关键文件：

- `libs/message/src/notification/notification-template.service.ts`

## 4. 文案验收清单

以下展示口径全部满足，才能认为论坛主题通知文案改造完成：

- [ ] 主题被点赞：标题为“`xxx 点赞了你的主题`”，正文为主题标题
- [ ] 主题被收藏：标题为“`xxx 收藏了你的主题`”，正文为主题标题
- [ ] 主题被评论：标题为“`xxx 评论了你的主题`”，正文为评论摘要
- [ ] 评论收到回复：标题为“`xxx 回复了你的评论`”，正文为回复摘要
- [ ] 点赞、收藏不会再展示“有人点赞了你的内容”这类旧文案
- [ ] 回复通知不会再只显示“收到新的评论回复”这类固定兜底文案

## 5. 测试与回归清单

### 5.1 单元与模块测试

- [ ] `outbox.service` 覆盖通知类型收口逻辑
- [ ] `notification-template.service` 覆盖缓存命中与失效
- [ ] `notification-template.service` 覆盖占位符校验
- [ ] `comment.service` 覆盖评论回复动态文案
- [ ] `forum-topic-like.resolver` 覆盖 `TOPIC_LIKE`
- [ ] `forum-topic-favorite.resolver` 覆盖 `TOPIC_FAVORITE`
- [ ] `forum-topic-comment.resolver` 覆盖 `TOPIC_COMMENT`
- [ ] `notification.service` 覆盖 fallback 与模板渲染结果

### 5.2 业务回归

- [ ] 论坛主题点赞主链路未回归
- [ ] 论坛主题收藏主链路未回归
- [ ] 论坛主题评论主链路未回归
- [ ] 论坛主题评论计数与板块可见状态同步未回归
- [ ] 评论回复主链路未回归
- [ ] App 通知分页展示未回归
- [ ] App 通知未读数与已读逻辑未回归
- [ ] 管理端模板管理与 delivery 监控未回归

### 5.3 命令验收

- [ ] `pnpm type-check` 通过
- [ ] 相关单测命令通过
- [ ] 触达文件的 `eslint` 通过

## 6. 文档同步清单

- [ ] [forum-topic-notification-optimization-plan.md](./forum-topic-notification-optimization-plan.md) 与落地代码保持一致
- [ ] [notification-domain-contract.md](./notification-domain-contract.md) 已同步新增 `TOPIC_*` 类型边界
- [ ] 若调整偏好或模板说明，相关接口 / DTO 文档已同步
- [ ] 新同事只看文档，也能区分“主题被评论”和“评论被回复”两类通知
- [ ] 文档已明确“可推广的是治理机制，不是统一所有通知句式”

## 7. 阻塞上线项

以下任一项未通过，都建议视为阻塞上线：

- [ ] 论坛主题点赞仍复用 `COMMENT_LIKE`
- [ ] 论坛主题收藏仍复用 `CONTENT_FAVORITE`
- [ ] 论坛主题一级评论仍不会触发“主题被评论”通知
- [ ] 评论回复通知仍然只有固定文案，没有动态正文
- [ ] 当前轮次只完成部分论坛主题通知产品化，却按“论坛主题通知改造完成”口径上线
- [ ] 模板缺失或异常时会导致通知无法落库
- [ ] 新增通知类型没有基础测试覆盖
- [ ] App 或管理端仍无法正确识别新增 `TOPIC_*` 类型

## 8. 最终签收标准

当以下问题都能回答“是”时，可以认为这轮论坛主题通知改造完成：

- [ ] 我们能否准确区分主题点赞、主题收藏、主题评论、评论回复四类通知？
- [ ] 我们能否从通知类型、模板、偏好、delivery 四个维度解释论坛主题通知？
- [ ] 我们能否保证模板异常时仍然看到正确 fallback 文案？
- [ ] 我们能否保证一级评论与回复评论不会互相误发通知？
- [ ] 我们能否让用户一眼看出“是谁对哪条主题做了什么”？
- [ ] 我们能否让新同事只看文档就不把主题点赞和评论点赞混为一类？

只要以上问题全部回答“是”，这轮任务才算真正收口。
