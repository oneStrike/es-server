# 论坛首页四个 tab 的 app 接口盘点

## task statement

评估截图中的四个页面（广场、综合、热门、关注）在当前 `app-api` 中需要新增或调整多少接口。

## desired outcome

给出最小可行的接口改动数、保守拆分数，以及每个页面对现有接口的复用/缺口判断。

## known facts/evidence

- `GET app/forum/section-groups/list` 已返回分组下的板块树形结构，且每个板块包含 `isFollowed`、`canAccess`、`followersCount` 等字段，可直接支撑“广场”页。
- `POST app/follow/follow` 与 `POST app/follow/cancel` 已可复用为板块关注/取消关注动作。
- `GET app/forum/topic/page` 当前只能按 `sectionId` 查询单个板块下的公开主题，默认排序为 `isPinned desc -> lastCommentAt desc -> createdAt desc`。
- `QueryPublicForumTopicDto` 目前没有“全站 feed / 热门 / 关注流”相关筛选字段。
- `GET app/forum/search/page` 已支持 `sort=hot|latest|relevance`，说明仓库内已经存在“热门排序”的服务层实现思路，但该接口要求 `keyword`，不能直接代替首页 feed。

## constraints

- 这次任务是盘点与规划，不直接改代码。
- 结论优先基于当前 `apps/app-api` 路由、DTO 与 service 能力，不假设前端会接受多次拼装请求。
- 若同一接口通过扩展 query 参数可覆盖多个 tab，应优先记为“调整 1 个接口”而不是“新增多个接口”。

## unknowns/open questions

- “关注”tab 的产品语义是否只看“关注用户发的帖子”，还是“关注用户 + 关注板块”的混合 feed。
- “综合”tab 的排序是否接受当前“置顶优先 + 最近活跃”，还是需要额外推荐/权重策略。
- 是否要求首页列表项展示板块名、作者关注状态等额外字段。

## likely codebase touchpoints

- `apps/app-api/src/modules/forum/forum-topic.controller.ts`
- `libs/forum/src/topic/dto/forum-topic.dto.ts`
- `libs/forum/src/topic/forum-topic.service.ts`
- `apps/app-api/src/modules/forum/forum-section-group.controller.ts`
- `libs/forum/src/section-group/forum-section-group.service.ts`
- `apps/app-api/src/modules/follow/follow.controller.ts`
- `apps/app-api/src/modules/forum/forum-search.controller.ts`
