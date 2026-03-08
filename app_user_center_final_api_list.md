# App 端用户中心最终接口清单

## 1. 最终边界

已确认的边界如下：

- `user` 模块
  - 负责用户主资料
  - 负责用户状态
  - 负责成长中心
  - 负责用户中心首页聚合
  - 负责跨域摘要
- 业务模块
  - 继续负责各自领域的“我的列表 / 我的行为 / 我的明细”

因此，用户中心模块不再承接下面这类分页明细接口：

- 我的评论列表
- 我的收藏列表
- 我的点赞列表
- 我的购买列表
- 我的下载列表
- 我的消息列表
- 我的任务列表

## 2. `app/user` 最终接口清单

## 2.1 资料类

`GET /app/user/profile`

- 说明：获取当前用户基础资料
- 状态：保留现有接口

`POST /app/user/profile/update`

- 说明：更新当前用户基础资料
- 建议字段：
  - `nickname`
  - `avatar`
  - `email`
  - `gender`
  - `birthDate`

`GET /app/user/profile/forum`

- 说明：获取当前用户论坛个性资料
- 建议返回：
  - `signature`
  - `bio`
  - `topicCount`
  - `replyCount`
  - `likeCount`
  - `favoriteCount`

`POST /app/user/profile/forum-update`

- 说明：更新当前用户论坛个性资料
- 建议字段：
  - `signature`
  - `bio`

## 2.2 用户中心聚合类

`GET /app/user/center`

- 说明：用户中心首页聚合接口
- 建议返回：
  - `user`
  - `growth`
  - `community`
  - `assets`
  - `message`

`GET /app/user/status`

- 说明：当前用户状态摘要
- 建议返回：
  - `isEnabled`
  - `status`
  - `canLogin`
  - `canPost`
  - `canReply`
  - `canLike`
  - `canFavorite`
  - `reason`
  - `until`

`GET /app/user/assets/summary`

- 说明：内容资产摘要
- 建议返回：
  - `purchasedWorkCount`
  - `purchasedChapterCount`
  - `downloadedWorkCount`
  - `downloadedChapterCount`
  - `favoriteCount`
  - `likeCount`
  - `viewCount`
  - `commentCount`

## 2.3 成长中心类

`GET /app/user/growth/summary`

- 说明：成长中心摘要
- 建议返回：
  - `points`
  - `experience`
  - `levelId`
  - `levelName`
  - `badgeCount`
  - `todayPointEarned`
  - `todayExperienceEarned`

`GET /app/user/points/stats`

- 说明：积分统计
- 建议返回：
  - `currentPoints`
  - `todayEarned`
  - `todayConsumed`

`GET /app/user/points/records`

- 说明：积分流水
- 状态：保留现有接口

`GET /app/user/experience/stats`

- 说明：经验统计
- 建议返回：
  - `currentExperience`
  - `todayEarned`
  - `level`
  - `nextLevel`
  - `gapToNextLevel`

`GET /app/user/experience/records`

- 说明：经验流水
- 建议筛选项：
  - `ruleId`
  - `pageIndex`
  - `pageSize`

`GET /app/user/badges`

- 说明：我的徽章列表
- 建议筛选项：
  - `type`
  - `isEnabled`
  - `pageIndex`
  - `pageSize`

## 3. 应保留在业务模块的接口

这些接口不迁移，不在 `app/user` 下重复造一套。

### 评论模块

- `GET /app/comment/my`
- `POST /app/comment/post`
- `POST /app/comment/reply`
- `POST /app/comment/delete`

### 点赞模块

- `GET /app/like/my`
- `GET /app/like/status`
- `POST /app/like`
- `POST /app/like/cancel`

### 收藏模块

- `GET /app/favorite/my`
- `GET /app/favorite/status`
- `POST /app/favorite`
- `POST /app/favorite/cancel`

### 浏览模块

- `GET /app/view/my`
- `POST /app/view/delete`
- `POST /app/view/clear`

### 购买 / 下载模块

- `GET /app/work/purchase/works`
- `GET /app/work/purchase/work-chapters`
- `GET /app/work/download/works`
- `GET /app/work/download/work-chapters`

### 消息模块

- `GET /app/message/inbox/summary`
- `GET /app/message/notification/list`
- `GET /app/message/notification/unread-count`
- `GET /app/message/chat/conversation/list`

### 任务模块

- `GET /app/task/my-page`

## 4. 明确不新增的重复接口

后续不要新增下面这类重复接口：

- `GET /app/user/comments`
- `GET /app/user/favorites`
- `GET /app/user/likes`
- `GET /app/user/views`
- `GET /app/user/purchases`
- `GET /app/user/downloads`
- `GET /app/user/messages`
- `GET /app/user/tasks`

原因很简单：

- 和现有业务模块职责冲突
- 前后端会面临双路由并存
- 后续维护成本高

## 5. 如后续要补“我的主题 / 我的论坛收藏”

这两类接口不建议放到 `app/user`。

建议未来按论坛域新增，例如：

- `GET /app/forum/topic/my`
- `GET /app/forum/favorite/my`

如果当前只是“我的页面”里要展示数量或最近几条摘要，则通过：

- `GET /app/user/center`

来聚合，而不是再在 `user` 模块做完整分页。

## 6. 建议实施顺序

### P0

- `POST /app/user/profile/update`
- `GET /app/user/profile/forum`
- `POST /app/user/profile/forum-update`
- `GET /app/user/center`
- `GET /app/user/status`

### P1

- `GET /app/user/growth/summary`
- `GET /app/user/points/stats`
- `GET /app/user/experience/stats`
- `GET /app/user/experience/records`
- `GET /app/user/badges`

### P2

- `GET /app/user/assets/summary`

## 7. 最终执行原则

以后新增用户相关接口时，统一按下面一句话判断：

> 单一业务对象的明细接口归业务模块；  
> 用户资料、状态、成长摘要、跨域聚合接口归 `app/user` 模块。

按这个标准，你当前项目的整体方向是对的，只需要把用户中心该补的聚合能力补上，不需要把所有“我的 xxx”都迁到 `user` 模块。
