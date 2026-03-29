# 论坛主题通知改造开发排期版

## 1. 文档目标

本文只补开发执行所需的信息，不涉及人员配置。

每个任务补充 4 类内容：

1. 开工条件
2. 预计改动模块
3. 预计影响文件
4. 核心测试点

说明：

- 文件清单只列关键路径，不追求穷举
- 波次顺序以 [execution-plan.md](./execution-plan.md) 为准
- 本文不是优先级事实源，不重复维护“最适合直接开工”的排序
- 本轮虽然只落论坛主题通知，但 `P0 / P2` 的契约、composer、模板治理方式应保持对全通知域的后续扩展能力
- `P1-01 / P1-02 / P1-03 / P2-01` 共同构成本轮论坛主题通知产品化交付面，允许分波次推进，但不建议拆到下一轮分别收尾
- `COMMENT_REPLY` 本轮仅做动态文案与展示兜底，不在本排期里继续拆成论坛主题 / 作品 / 章节回复等域级通知类型

## 2. Wave 1

### [P0-01 通知类型拆分与 outbox 契约收口](./p0/01-notification-type-and-outbox-contract.md)

- 开工条件：无
- 预计改动模块：`libs/message`、`apps/app-api/message`、`apps/admin-api/message`、`db/schema/message`、`db/seed/modules/message`
- 预计影响文件：
  - `libs/message/src/notification/notification.constant.ts`
  - `libs/message/src/outbox/outbox.type.ts`
  - `libs/message/src/outbox/outbox.service.ts`
  - `db/schema/message/user-notification.ts`
  - `db/seed/modules/message/domain.ts`
  - `apps/app-api/src/modules/message/dto/message.dto.ts`
  - `apps/admin-api/src/modules/message/dto/message-template.dto.ts`
  - `apps/admin-api/src/modules/message/dto/message-monitor.dto.ts`
- 核心测试点：
  - `TOPIC_*` 类型进入通知类型列表
  - `payload.type` 可正确派生 outbox `eventType`
  - 兼容期 `eventType !== payload.type` 会被拒绝
  - schema 注释 / seed 示例 / 管理端筛选说明同步更新
  - 本波不要求删除所有非论坛通知调用方上的 `eventType`

## 3. Wave 2

### [P0-02 通知 composer 与快照契约收口](./p0/02-notification-composer-and-snapshot-contract.md)

- 开工条件：建议先完成 `P0-01`
- 预计改动模块：`libs/message`、`libs/interaction`
- 预计影响文件：
  - `libs/message/src/notification/` 下新增 composer / payload type 文件
  - `libs/message/src/notification/notification.type.ts`
  - `libs/interaction/src/like/interfaces/like-target-resolver.interface.ts`
  - `libs/interaction/src/favorite/interfaces/favorite-target-resolver.interface.ts`
  - `libs/interaction/src/favorite/favorite.service.ts`
  - `libs/interaction/src/comment/interfaces/comment-target-resolver.interface.ts`
- 核心测试点：
  - composer 能稳定构造 fallback `title / content`
  - typed payload 字段口径稳定
  - 论坛主题元数据与展示快照结构明确
  - composer / payload 设计不绑定论坛专属句式，后续可扩展到其他通知类型

## 4. Wave 3

### [P1-01 主题点赞与收藏通知独立化](./p1/01-topic-like-and-favorite-notification.md)

- 开工条件：`P0-01`
- 预计改动模块：`libs/forum/topic`、`libs/message`
- 预计影响文件：
  - `libs/forum/src/topic/resolver/forum-topic-like.resolver.ts`
  - `libs/forum/src/topic/resolver/forum-topic-favorite.resolver.ts`
  - `libs/message/src/notification/` 下 composer / type 文件
- 核心测试点：
  - 主题点赞改为 `TOPIC_LIKE`
  - 主题收藏改为 `TOPIC_FAVORITE`
  - 正文展示主题标题
  - 自通知场景继续跳过

### [P1-02 评论回复动态文案](./p1/02-comment-reply-dynamic-copy.md)

- 开工条件：`P0-01`
- 预计改动模块：`libs/interaction/comment`、`libs/message`
- 预计影响文件：
  - `libs/interaction/src/comment/comment.service.ts`
  - `libs/interaction/src/comment/comment.type.ts`
  - `libs/message/src/notification/` 下 composer / type 文件
- 核心测试点：
  - 回复通知标题改为动态昵称文案
  - 正文改为回复摘要
  - `VisibleCommentEffectPayload / CommentModerationState` 能为审核补偿路径复用回复正文
  - `replyTargetUserId` 透传后不重复查询
  - 回复摘要为空时优先回退 `targetDisplayTitle`，缺失时回退固定兜底文案
  - 审核补偿路径仍可正常兜底

## 5. Wave 4

### [P1-03 主题被评论通知](./p1/03-topic-comment-notification.md)

- 开工条件：`P0-01`
- 预计改动模块：`libs/interaction/comment`、`libs/forum/topic`、`libs/message`
- 预计影响文件：
  - `libs/interaction/src/comment/comment.service.ts`
  - `libs/interaction/src/comment/comment.type.ts`
  - `libs/interaction/src/comment/interfaces/comment-target-resolver.interface.ts`
  - `libs/forum/src/topic/resolver/forum-topic-comment.resolver.ts`
  - `libs/message/src/notification/` 下 composer / type 文件
- 核心测试点：
  - 一级评论首次可见时写入 `TOPIC_COMMENT`
  - 回复评论不会误发 `TOPIC_COMMENT`
  - 正文优先显示评论摘要，兜底为主题标题
  - 审核通过补偿与取消隐藏补偿路径都可复用
  - 复用 `P1-02` 已补的评论副作用载荷，不重复改评论补偿底座

## 6. Wave 5

### [P2-01 模板默认文案与 seed 升级](./p2/01-template-default-copy-and-seed.md)

- 开工条件：`P0-01`
- 预计改动模块：`libs/message/notification`、`db/seed/modules/message`
- 预计影响文件：
  - `libs/message/src/notification/notification.constant.ts`
  - `libs/message/src/notification/notification-template.service.ts`
  - `db/seed/modules/message/domain.ts`
- 核心测试点：
  - `TOPIC_*` 模板定义完整
  - `COMMENT_REPLY` 默认模板升级为动态快照版
  - 联调 seed 示例文案与默认模板口径一致
  - 模板缺失 / 禁用 / 渲染失败时仍 fallback

### [P2-02 模板缓存与占位符校验](./p2/02-template-cache-and-placeholder-validation.md)

- 开工条件：建议先完成 `P2-01`
- 预计改动模块：`libs/message/notification`
- 预计影响文件：
  - `libs/message/src/notification/notification-template.service.ts`
  - `libs/message/src/notification/notification-template.service.spec.ts`
- 核心测试点：
  - 模板缓存命中与失效生效
  - 非法固定根字段 / 非法 payload 字段保存时直接报错
  - 运行时 fallback 兜底逻辑不受影响
