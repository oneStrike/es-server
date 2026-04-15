# PRD: forum-home-feed-tabs

## Background

论坛首页需要支撑 `广场 / 综合 / 热门 / 关注` 四个 tab。当前仓库中：

- `广场` 已由板块分组与板块列表接口覆盖。
- `综合 / 热门 / 关注` 缺少清晰分层的 feed 接口。

## Goal

提供语义清晰、后续便于扩展的 app 侧论坛 feed 接口：

1. `GET app/forum/topic/page`
   用于综合 feed，同时保留传 `sectionId` 时查询单板块主题页的兼容能力。
2. `GET app/forum/topic/hot/page`
   用于热门 feed。
3. `GET app/forum/topic/following/page`
   用于关注 feed，仅登录用户可访问。

## Non-goals

- 不改论坛详情、评论、点赞、收藏、关注写接口语义。
- 不改广场页的板块分组接口。
- 不引入新表、新依赖或迁移。

## Functional Requirements

### 综合

- 匿名与登录用户都可访问。
- `sectionId` 为空时返回当前用户可访问板块下的公开主题。
- `sectionId` 有值时保持现有单板块分页语义。
- 排序沿用当前公开主题列表语义：`isPinned desc -> lastCommentAt desc -> createdAt desc`。

### 热门

- 匿名与登录用户都可访问。
- 返回当前用户可访问板块下的公开主题。
- 默认排序：`commentCount desc -> likeCount desc -> viewCount desc -> createdAt desc`。
- 可选支持 `sectionId` 进一步收窄到单板块热门。

### 关注

- 仅登录用户可访问。
- 返回“关注用户发的主题”与“关注板块下的主题”的并集，按主题 ID 去重。
- 主题仍需满足公开可见、板块当前可访问。
- 默认排序沿用 feed 排序：`isPinned desc -> lastCommentAt desc -> createdAt desc`。
- 可选支持 `sectionId` 进一步收窄范围。

## API Shape

- 统一复用公开主题分页返回模型。
- 查询 DTO 统一允许：
  - `pageIndex`
  - `pageSize`
  - `sectionId?`

## Risks

- `following` feed 的语义需要明确采用“关注用户 + 关注板块”的并集，而不是仅关注用户。
- `topic/page` 由必填 `sectionId` 改为可选，虽然兼容旧调用，但需要补测试覆盖空 `sectionId` 分支。

## Validation

- 主题 service 单测覆盖：
  - 综合 feed 无 `sectionId` 时走全站可访问板块范围
  - 热门 feed 使用专属排序规则
  - 关注 feed 聚合用户关注与板块关注
- `pnpm type-check`
- 针对受影响 spec 运行 Jest
