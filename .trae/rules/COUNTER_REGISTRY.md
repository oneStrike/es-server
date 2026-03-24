# 项目计数器注册表

本文件记录仓库当前主要业务计数字段的归类、事实来源、owner 和修复状态。

说明：

- 这是第一版注册表，优先覆盖用户可见、对象可见和高频状态计数。
- 表中“当前 owner”反映现状，“收敛方向”反映后续应继续靠拢的实现。
- 系统监控、重试、命中统计等运维型计数放在文末单独说明，不与业务对象计数混在一起。

字段说明：

- 分类：事实计数 / 对象冗余计数 / 用户聚合计数 / 状态缓存计数
- 修复：`单条`、`批量`、`无`
- 状态：`稳定`、`部分统一`、`待收敛`、`待定义`

## 1. 用户域

| 字段 | 分类 | 事实来源 | 当前 owner | 修复 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `app_user_count.followingCount` / `followersCount` | 用户聚合计数 | `user_follow` | `AppUserCountService` | 单条 + 批量 | 稳定 | 已有 `rebuildFollowCounts` 和用户聚合批量脚本 |
| `app_user_count.commentCount` | 用户聚合计数 | `user_comment` | `AppUserCountService` | 单条 + 批量 | 稳定 | 基于事实表回填所有未删除评论 |
| `app_user_count.likeCount` | 用户聚合计数 | `user_like` | `AppUserCountService` | 单条 + 批量 | 稳定 | 发出的点赞总数已支持 rebuild |
| `app_user_count.favoriteCount` | 用户聚合计数 | `user_favorite` | `AppUserCountService` | 单条 + 批量 | 稳定 | 发出的收藏总数已支持 rebuild |
| `app_user_count.forumTopicCount` | 用户聚合计数 | `forum_topic` | `AppUserCountService`（论坛路径经 `ForumCounterService` 委托） | 单条 + 批量 | 稳定 | 非删除主题数已支持 rebuild |
| `app_user_count.commentReceivedLikeCount` | 用户聚合计数 | `user_like` on `comment` | `AppUserCountService` | 单条 + 批量 | 稳定 | 基于评论事实与点赞事实联合回填 |
| `app_user_count.forumTopicReceivedLikeCount` / `forumTopicReceivedFavoriteCount` | 用户聚合计数 | `user_like` / `user_favorite` on `forum_topic` | `AppUserCountService`（论坛路径经 `ForumCounterService` 委托） | 单条 + 批量 | 稳定 | 已支持按主题事实表联合回填 |

## 2. 论坛域

| 字段 | 分类 | 事实来源 | 当前 owner | 修复 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `forum_section.followersCount` | 对象冗余计数 | `user_follow`（section 目标） | `ForumCounterService` | 单条 + 批量 | 稳定 | 已有 rebuild service 和批量入口 |
| `forum_section.topicCount` / `replyCount` | 对象冗余计数 | `forum_topic` 及其可见回复状态 | `ForumCounterService` | 单条 + 批量 | 稳定 | 可见态由 owner service 重算并已有批量脚本 |
| `forum_topic.replyCount` / `commentCount` | 对象冗余计数 | 主题下可见回复 | `ForumCounterService` | 单条 + 批量 | 稳定 | 回复状态同步已收口到统一 owner |
| `forum_topic.likeCount` / `favoriteCount` | 对象冗余计数 | `user_like` / `user_favorite` on `forum_topic` | `ForumCounterService` | 单条 + 批量 | 稳定 | 写入口与 rebuild 已集中 |
| `forum_topic.viewCount` | 对象冗余计数 | `user_browse_log` | `ForumCounterService` | 单条 + 批量 | 稳定 | 历史 admin 手工入口已移除，只保留 browse 事实链路 |
| `forum_tag.useCount` | 对象冗余计数 | `forum_topic_tag` 关系 | `ForumTagService` | 无 | 部分统一 | 当前由 tag service 手写 delta，后续可补 helper / rebuild |

## 3. 内容域

| 字段 | 分类 | 事实来源 | 当前 owner | 修复 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `work_author.followersCount` | 对象冗余计数 | `user_follow`（author 目标） | `AuthorService` | 单条 + 批量 | 稳定 | 已有 rebuild by id / all |
| `work_author.workCount` | 对象冗余计数 | `work_author_relation` + `work` | `WorkAuthorService`（作品写路径委托） | 单条 + 批量 | 稳定 | 已有统一 owner、单条 rebuild、批量脚本 |
| `work.viewCount` / `likeCount` / `favoriteCount` / `commentCount` | 对象冗余计数 | `user_browse_log` / `user_like` / `user_favorite` / `user_comment` | `WorkCounterService` | 单条 + 批量 | 稳定 | 作品交互计数已收口并有 rebuild |
| `work.downloadCount` | 对象冗余计数 | `user_download_record` 聚合到作品下章节 | `WorkCounterService` | 单条 + 批量 | 稳定 | 口径定义为作品下所有章节下载记录总数 |
| `work_chapter.viewCount` / `likeCount` / `commentCount` / `purchaseCount` / `downloadCount` | 对象冗余计数 | `user_browse_log` / `user_like` / `user_comment` / `purchase` / `download` | `WorkCounterService` | 单条 + 批量 | 稳定 | 章节详情链路、交互 resolver 与 rebuild 已统一 |

## 4. 消息与状态域

| 字段 | 分类 | 事实来源 | 当前 owner | 修复 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `chat_conversation_member.unreadCount` | 状态缓存计数 | `chat_message` 与已读位置 | `MessageChatService` | 上下文重算 | 稳定 | 属于状态缓存，不强制抽为通用 CounterService |

## 5. 当前优先级最高的收敛项

1. `forum_tag.useCount` 仍是 forum tag 域的历史散落写法，后续可按论坛域 owner 思路继续收口。
2. `work.rating` 当前仍是作品元数据，若未来引入真实评分事实表，再单独设计 owner 与 repair。

## 6. 本轮未纳入主注册表的计数

以下字段仍然属于计数，但不作为第一优先级业务计数治理对象：

- `message_ws_metric.*`
- `message_outbox.retryCount`
- `user_notification.aggregateCount`
- `sensitive_word.hitCount`

这些字段仍应遵守：

- 原子更新
- 事务一致性
- 口径可解释

但它们的 owner 和 repair 策略可以按监控、通知聚合、内容审核等子系统单独治理。
