# App 端用户相关接口分层规范

## 1. 结论

当前项目把“我的评论”放在评论模块、“我的收藏”放在收藏模块，这种结构是合理的，应该保留。

不建议把所有“我的 xxx”接口都搬到用户中心模块。

正确做法是：

- 业务对象明细接口，留在各自业务模块
- 用户中心模块，只负责用户资料、状态、成长摘要、跨域聚合

也就是：

- `comment/favorite/like/work/message/task/view` 继续承载各自领域的“我的列表”
- `user` 模块只做“我的页面”聚合和资料管理

## 2. 为什么不应该全放用户中心

如果把所有和用户有关的数据都放到 `user` 模块，会出现几个问题：

- `user` 模块会迅速变成跨域大杂烩
- 同一类业务会在两个模块下重复暴露接口
- 分页、筛选、排序、状态定义会被拆散
- 业务演进时容易互相污染
- Swagger 和前端接入会越来越乱

以“我的评论”为例：

- 它的核心对象是“评论”
- 它的筛选、删除、回复、点赞都围绕评论领域
- 因此它应该属于 `comment` 模块，而不是 `user` 模块

## 3. 接口归属判断规则

新增一个接口时，先问 3 个问题。

### 3.1 它返回的核心对象是谁

如果接口返回的是某个明确业务对象的列表或详情，就归这个业务对象所在模块。

例如：

- 评论列表，归 `comment`
- 收藏列表，归 `favorite`
- 点赞列表，归 `like`
- 已购作品，归 `work/purchase`
- 下载记录，归 `work/download`
- 消息通知，归 `message`

### 3.2 它是不是“跨域聚合”

如果接口是给“我的页面”或“用户中心首页”服务，需要同时拼接多个模块的数据，这种接口归 `user` 模块。

例如：

- 用户中心首页摘要
- 我的成长摘要
- 我的资产摘要
- 我的状态摘要

### 3.3 它是不是“用户主资料”

如果接口操作的是 `AppUser` 自身主档案，或者 `forum_profile` 这种紧贴用户画像的资料，也归 `user` 模块。

例如：

- 修改昵称
- 修改头像
- 修改生日
- 修改个人简介
- 查询当前用户状态

## 4. 推荐分层原则

建议固定采用下面这条原则：

### 4.1 领域模块负责

领域模块负责“单领域、可独立使用”的接口。

特征：

- 核心对象单一
- 能单独分页、筛选、排序
- 未来业务规则主要由本领域自己演进

### 4.2 用户中心模块负责

用户中心模块负责“用户视角的聚合入口”。

特征：

- 返回的是面板、摘要、总览
- 依赖多个领域模块拼装
- 主要服务于“我的页面”而不是业务详情页

## 5. 按你当前项目的推荐归属

## 5.1 应继续留在各业务模块的接口

### 评论模块

- `GET /app/comment/my`
- `POST /app/comment/delete`
- `POST /app/comment/reply`

原因：

- 核心对象是评论
- 相关行为都围绕评论域

### 点赞模块

- `GET /app/like/my`
- `GET /app/like/status`
- `POST /app/like`
- `POST /app/like/cancel`

原因：

- 核心对象是点赞关系

### 收藏模块

- `GET /app/favorite/my`
- `GET /app/favorite/status`
- `POST /app/favorite`
- `POST /app/favorite/cancel`

原因：

- 核心对象是收藏关系

### 浏览模块

- `GET /app/view/my`
- `POST /app/view/delete`
- `POST /app/view/clear`

原因：

- 核心对象是浏览记录

### 作品购买 / 下载模块

- `GET /app/work/purchase/works`
- `GET /app/work/purchase/work-chapters`
- `GET /app/work/download/works`
- `GET /app/work/download/work-chapters`

原因：

- 核心对象是购买资产、下载资产

### 消息模块

- `GET /app/message/inbox/summary`
- `GET /app/message/notification/list`
- `GET /app/message/chat/conversation/list`

原因：

- 核心对象是通知、会话、消息

### 任务模块

- `GET /app/task/my-page`

原因：

- 核心对象是任务分配与任务进度

## 5.2 应放在用户中心模块的接口

这些接口建议统一归 `app/user`。

### 用户资料

- `GET /app/user/profile`
- `POST /app/user/profile/update`
- `POST /app/user/profile/forum-update`

### 用户中心聚合

- `GET /app/user/center`
- `GET /app/user/status`
- `GET /app/user/growth/summary`
- `GET /app/user/assets/summary`

### 成长中心

- `GET /app/user/points/stats`
- `GET /app/user/points/records`
- `GET /app/user/experience/stats`
- `GET /app/user/experience/records`
- `GET /app/user/badges`

### 用户论坛画像

- `GET /app/user/forum/profile`

说明：

- 这里放的是“我的论坛画像摘要”
- 不建议在 `user` 模块下再复制一套完整评论、收藏、主题分页体系

## 5.3 处于边界上的接口，怎么选

有些接口天然在边界上，建议按下面方式处理。

### 我的主题

两种都能讲通：

- 放 `forum/topic`
- 放 `user/forum/topics`

我的建议：

- 如果未来主题查询、筛选、草稿、删除、编辑都还会继续长在论坛域，就放 `forum` 模块
- 如果它只是“我的页面里一个轻量入口”，可以在 `user` 模块做一个聚合只读接口

更稳妥的做法是：

- 主题明细分页归论坛模块
- 用户中心里只保留主题数量摘要

### 我的论坛收藏

同理：

- 如果本质是论坛主题收藏列表，优先留在收藏或论坛域
- 用户中心里只做摘要，不再重复暴露整页接口

## 6. 推荐的最终组织方式

建议把用户相关接口分为两层。

### 第一层：业务域接口

按领域归属，负责明细列表和具体行为：

- `app/comment/*`
- `app/favorite/*`
- `app/like/*`
- `app/view/*`
- `app/work/purchase/*`
- `app/work/download/*`
- `app/message/*`
- `app/task/*`

### 第二层：用户中心聚合接口

只放面向“我的页面”的聚合能力：

- `app/user/profile`
- `app/user/profile/update`
- `app/user/profile/forum-update`
- `app/user/center`
- `app/user/status`
- `app/user/growth/summary`
- `app/user/assets/summary`
- `app/user/points/stats`
- `app/user/points/records`
- `app/user/experience/stats`
- `app/user/experience/records`
- `app/user/badges`

## 7. 明确禁止的做法

后续新增接口时，建议避免下面几种方式。

### 7.1 同一能力双处暴露

不要同时出现：

- `GET /app/comment/my`
- `GET /app/user/comments`

二选一即可。

### 7.2 在用户中心模块塞分页明细全集

不要把下面这些都塞进 `user` 模块：

- 我的评论分页
- 我的收藏分页
- 我的点赞分页
- 我的购买分页
- 我的下载分页
- 我的消息分页

这些都会把 `user` 模块做坏。

### 7.3 只因为“和用户有关”就归 user 模块

“和用户有关”不是归属依据。

真正的归属依据是：

- 领域对象是谁
- 是否跨域聚合
- 是否用户主资料

## 8. 对你当前项目的落地建议

基于当前结构，我建议这样推进：

### 第一阶段

保留现有各业务模块的“我的列表”接口，不动。

新增用户中心聚合接口：

- `GET /app/user/center`
- `GET /app/user/status`
- `GET /app/user/growth/summary`
- `GET /app/user/assets/summary`

### 第二阶段

补用户资料写接口：

- `POST /app/user/profile/update`
- `POST /app/user/profile/forum-update`

### 第三阶段

把成长中心的统计接口补全到 `app/user`：

- `GET /app/user/points/stats`
- `GET /app/user/experience/stats`
- `GET /app/user/experience/records`
- `GET /app/user/badges`

## 9. 最终规范

可以直接把下面这条作为团队约定：

> 用户中心模块只负责用户资料、状态、成长摘要和跨域聚合；  
> 业务对象的明细列表、详情和行为接口，继续归属于各自领域模块。

如果按这条规则执行，你现在的模块划分方向是对的，不需要改成“所有用户数据都收口到用户中心”。
