# App 端用户中心缺失功能清单 + 推荐接口草案

## 1. 范围说明

本版仅讨论 `AppUser` 在 app 端“用户中心”视角下缺失的功能，不包含以下内容：

- 验证码相关能力
- 设备列表、设备管理、踢设备下线
- 依赖验证码才能安全落地的手机号/邮箱换绑流程

目标是明确：

- 现在 app 端用户中心已经有什么
- 还缺什么
- 推荐怎么设计接口，避免和现有模块重复

## 2. 当前已具备能力

### 2.1 用户中心直接已有

- `GET /app/user/profile`
  - 获取当前用户资料
- `GET /app/user/points/records`
  - 获取我的积分流水

### 2.2 虽不在 `app/user`，但用户中心已经可复用

这些能力已经有接口，不建议在用户中心重复造一套，只建议做聚合入口或摘要：

- 账号安全
  - `POST /app/auth/change-password`
  - `POST /app/auth/forgot-password`
- 我的评论
  - `GET /app/comment/my`
- 我的点赞
  - `GET /app/like/my`
- 我的收藏
  - `GET /app/favorite/my`
- 我的浏览记录
  - `GET /app/view/my`
- 我的已购内容
  - `GET /app/work/purchase/works`
  - `GET /app/work/purchase/work-chapters`
- 我的下载内容
  - `GET /app/work/download/works`
  - `GET /app/work/download/work-chapters`
- 我的任务
  - `GET /app/task/my-page`
- 消息中心
  - `GET /app/message/inbox/summary`
  - `GET /app/message/notification/unread-count`

## 3. 当前缺失的用户中心功能

## 3.1 缺失一：个人资料编辑

当前只能查资料，不能改资料。

### 缺失点

- 修改昵称
- 修改头像
- 修改邮箱
- 修改性别
- 修改生日
- 修改论坛签名
- 修改个人简介

### 设计建议

基础账户资料和论坛资料建议拆分为两个写接口：

- 账户主资料写入 `app_user`
- 论坛个性化资料写入 `forum_profile`

这样后续权限和字段边界更清晰。

### 推荐接口

`POST /app/user/profile/update`

- 作用：更新当前用户基础资料
- 建议字段：
  - `nickname`
  - `avatar`
  - `email`
  - `gender`
  - `birthDate`

`POST /app/user/profile/forum-update`

- 作用：更新当前用户论坛资料
- 建议字段：
  - `signature`
  - `bio`

## 3.2 缺失二：用户中心首页聚合数据

当前用户中心缺少一个总览接口，前端如果要做“我的”页面，只能拼很多接口。

### 缺失点

- 基础资料摘要
- 等级 / 积分 / 经验摘要
- 社区状态摘要
- 徽章数
- 我的评论数
- 我的点赞数
- 我的收藏数
- 我的浏览数
- 已购作品数
- 已下载作品数
- 未读消息数
- 论坛主题数 / 回复数

### 设计建议

保留各业务模块原有分页接口不变，在用户中心新增一个聚合查询接口即可。

### 推荐接口

`GET /app/user/center`

- 作用：获取用户中心首页摘要
- 建议返回：
  - `user`
    - `id`
    - `account`
    - `nickname`
    - `avatar`
    - `phone`
    - `email`
    - `gender`
    - `birthDate`
  - `growth`
    - `points`
    - `experience`
    - `levelId`
    - `badgeCount`
  - `community`
    - `status`
    - `banReason`
    - `banUntil`
    - `topicCount`
    - `replyCount`
    - `likeCount`
    - `favoriteCount`
  - `assets`
    - `commentCount`
    - `likedCount`
    - `favoritedCount`
    - `viewCount`
    - `purchasedWorkCount`
    - `downloadedWorkCount`
  - `message`
    - `unreadNotificationCount`

## 3.3 缺失三：成长中心不完整

当前 app 端只开放了积分流水，没有成长中心完整能力。

### 缺失点

- 积分统计
- 经验统计
- 经验流水
- 我的徽章列表
- 我的等级进度

### 设计建议

直接复用现有服务能力：

- `UserPointService.getUserPointStats`
- `UserExperienceService.getUserExperienceStats`
- `UserExperienceService.getExperienceRecordPage`
- `UserBadgeService.getUserBadges`

### 推荐接口

`GET /app/user/points/stats`

- 作用：获取我的积分统计
- 建议返回：
  - `currentPoints`
  - `todayEarned`
  - `todayConsumed`

`GET /app/user/points/records`

- 已有接口，保留

`GET /app/user/experience/stats`

- 作用：获取我的经验统计
- 建议返回：
  - `currentExperience`
  - `todayEarned`
  - `level`
  - `nextLevel`
  - `gapToNextLevel`

`GET /app/user/experience/records`

- 作用：分页获取我的经验流水
- 建议筛选项：
  - `ruleId`
  - `pageIndex`
  - `pageSize`

`GET /app/user/badges`

- 作用：获取我的徽章列表
- 建议筛选项：
  - `type`
  - `isEnabled`
  - `pageIndex`
  - `pageSize`

`GET /app/user/growth/summary`

- 作用：成长中心摘要
- 建议返回：
  - `points`
  - `experience`
  - `levelId`
  - `levelName`
  - `badgeCount`
  - `todayPointEarned`
  - `todayExperienceEarned`

## 3.4 缺失四：论坛用户中心入口

当前论坛相关的用户数据虽然服务层已有部分能力，但 app 端没有统一对外开放到用户中心。

### 缺失点

- 我的论坛资料详情
- 我的主题列表
- 我的论坛收藏列表聚合入口

说明：

- “我的评论”当前已有 `GET /app/comment/my`
- 因此用户中心不需要重复做“我的评论”接口

### 推荐接口

`GET /app/user/forum/profile`

- 作用：获取当前用户论坛画像
- 建议返回：
  - `signature`
  - `bio`
  - `topicCount`
  - `replyCount`
  - `likeCount`
  - `favoriteCount`
  - `status`
  - `banReason`
  - `banUntil`

`GET /app/user/forum/topics`

- 作用：分页获取我的主题
- 建议筛选项：
  - `pageIndex`
  - `pageSize`

`GET /app/user/forum/favorites`

- 作用：分页获取我收藏的论坛主题
- 建议筛选项：
  - `pageIndex`
  - `pageSize`

## 3.5 缺失五：用户中心资产摘要

虽然购买、下载、收藏、点赞、浏览记录分别已有接口，但用户中心缺少“资产汇总”。

### 缺失点

- 已购作品总数
- 已购章节总数
- 已下载作品总数
- 已下载章节总数
- 我的收藏总数
- 我的点赞总数
- 我的浏览总数

### 推荐接口

`GET /app/user/assets/summary`

- 作用：获取我的内容资产摘要
- 建议返回：
  - `purchasedWorkCount`
  - `purchasedChapterCount`
  - `downloadedWorkCount`
  - `downloadedChapterCount`
  - `favoriteCount`
  - `likeCount`
  - `viewCount`

## 3.6 缺失六：统一的用户状态说明

当前 `profile` 会带出 `isEnabled / status / banReason / banUntil`，但缺少一个面向前端展示的“状态说明结构”。

### 缺失点

- 当前是否可登录
- 当前是否可发言
- 当前是否可互动
- 当前限制原因
- 当前限制截止时间

这类信息前端通常要用于：

- 我的页面状态提示
- 发帖 / 评论前置提示
- 封禁或禁言说明页

### 推荐接口

`GET /app/user/status`

- 作用：获取当前账号状态摘要
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

## 4. 建议不纳入本版的功能

以下能力确实属于用户中心，但当前不建议在这版接口草案内推进：

- 手机绑定 / 换绑
- 邮箱绑定 / 换绑
- 注销账号
- 申诉解封

原因：

- 这几项都强依赖验证码、安全校验或额外状态字段
- 本轮你已经明确不处理验证码

## 5. 推荐路由组织方式

建议遵循下面的组织原则：

- `app/user`
  - 放用户中心聚合接口
  - 放“我的资料、我的成长、我的摘要、我的状态”
- 其他业务模块
  - 保持原有独立接口
  - 不重复在 `app/user` 里造分页接口

建议最终结构如下：

- `GET /app/user/profile`
- `POST /app/user/profile/update`
- `POST /app/user/profile/forum-update`
- `GET /app/user/center`
- `GET /app/user/status`
- `GET /app/user/growth/summary`
- `GET /app/user/points/stats`
- `GET /app/user/points/records`
- `GET /app/user/experience/stats`
- `GET /app/user/experience/records`
- `GET /app/user/badges`
- `GET /app/user/forum/profile`
- `GET /app/user/forum/topics`
- `GET /app/user/forum/favorites`
- `GET /app/user/assets/summary`

## 6. 实施优先级建议

如果按“用户中心最小闭环”来排，建议顺序如下：

### P0

- `POST /app/user/profile/update`
- `POST /app/user/profile/forum-update`
- `GET /app/user/center`
- `GET /app/user/status`

### P1

- `GET /app/user/points/stats`
- `GET /app/user/experience/stats`
- `GET /app/user/experience/records`
- `GET /app/user/badges`

### P2

- `GET /app/user/forum/profile`
- `GET /app/user/forum/topics`
- `GET /app/user/forum/favorites`
- `GET /app/user/assets/summary`

## 7. 最终建议

这一版最值得先补的是四件事：

- 资料可编辑
- 用户中心首页聚合
- 成长中心补齐
- 用户状态摘要

这样做的收益最大：

- 前端可以立即做完整“我的”页
- 不会和现有 `comment/favorite/like/work/message` 模块冲突
- 不依赖验证码，也不涉及设备管理
