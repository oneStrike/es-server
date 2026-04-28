# Forum Tag -> Hashtag Contract Cutover

## Scope

- API filters:
  - `GET app/forum/search/page`
  - `GET admin/forum/search/page`
- Topic payloads:
  - `GET app/forum/topic/detail`
  - `GET admin/forum/topic/detail`
- Forum management routes:
  - `admin/forum/tags/*`
  - `admin/forum/hashtags/*`
  - `app/forum/hashtag/*`

## Change Summary

- forum 域的“标签”正式收敛为全局 `hashtag` 资源。
- 搜索筛选主字段从 `tagId` 切到 `hashtagId`。
- topic detail 的关联字段从 `tags` / `topicTags` 收敛为 `hashtags`。
- 管理端话题管理入口从 `admin/forum/tags/*` 收敛为 `admin/forum/hashtags/*`。

## Compatibility Plan

### Phase 1: server-side compatibility

- 搜索接口当前同时接受：
  - `hashtagId`：新主字段
  - `tagId`：兼容旧调用方的过渡别名
- 若两者同时传入，服务端优先使用 `hashtagId`。
- 评论搜索在兼容期内继续保留旧口径：只要“主题命中该 hashtag”或“评论自身命中该 hashtag”，该评论都可命中过滤结果。

### Phase 2: client cutover

- 所有 forum client / admin client 统一迁移到：
  - 搜索请求使用 `hashtagId`
  - topic detail 读取 `hashtags`
  - 管理端话题管理改走 `admin/forum/hashtags/*`
  - app 侧话题详情/搜索/关联列表改走 `app/forum/hashtag/*`

### Phase 3: alias removal

- 仅在确认全部调用方完成迁移后，才允许移除 `tagId` 兼容别名。
- 本轮不再保留 `admin/forum/tags/*` 的运行时兼容路由；若仍有外部调用，必须在部署前完成切换。

## Notes

- `hashtags` 表达的是正式 hashtag 资源，不再等价于旧 `forum_tag` 的关系行。
- 管理端旧 `topicTags` 关系型返回体不保留 runtime alias；若调用方仍依赖旧结构，需要在切换阶段先完成消费端重构。
