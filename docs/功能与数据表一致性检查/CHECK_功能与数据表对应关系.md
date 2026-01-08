# Service模块与数据表对应关系

## 1. Service模块列表

### 1.1 核心功能模块

#### 1.1.1 论坛主题服务 (forum-topic.service.ts)
- **功能描述**: 管理论坛主题的创建、查询、更新、删除等操作
- **主要数据表**:
  - `forumTopic` - 论坛主题表
  - `forumSection` - 论坛板块表
  - `forumProfile` - 论坛用户资料表
- **关联数据表**:
  - `forumTopicLike` - 主题点赞表（通过pointService间接使用）
  - `forumTopicFavorite` - 主题收藏表（通过pointService间接使用）

#### 1.1.2 论坛回复服务 (forum-reply.service.ts)
- **功能描述**: 管理论坛回复的创建、查询、更新、删除等操作
- **主要数据表**:
  - `forumReply` - 论坛回复表
  - `forumTopic` - 论坛主题表
  - `forumSection` - 论坛板块表
  - `forumProfile` - 论坛用户资料表

#### 1.1.3 论坛板块服务 (forum-section.service.ts)
- **功能描述**: 管理论坛板块的创建、查询、更新、删除等操作
- **主要数据表**:
  - `forumSection` - 论坛板块表
  - `forumSectionGroup` - 论坛板块分组表

#### 1.1.4 用户服务 (user.service.ts)
- **功能描述**: 管理用户资料、用户信息查询等操作
- **主要数据表**:
  - `forumProfile` - 论坛用户资料表
- **关联数据表**:
  - `forumProfileBadge` - 用户徽章关联表
  - `forumBadge` - 徽章表

### 1.2 互动功能模块

#### 1.2.1 回复点赞服务 (forum-reply-like.service.ts)
- **功能描述**: 管理回复的点赞和取消点赞操作
- **主要数据表**:
  - `forumReplyLike` - 回复点赞表
  - `forumReply` - 论坛回复表

#### 1.2.2 主题点赞服务 (forum-topic-like.service.ts)
- **功能描述**: 管理主题的点赞和取消点赞操作
- **主要数据表**:
  - `forumTopicLike` - 主题点赞表
  - `forumTopic` - 论坛主题表

#### 1.2.3 浏览服务 (forum-view.service.ts)
- **功能描述**: 记录用户浏览行为，统计浏览次数
- **主要数据表**:
  - `forumView` - 浏览记录表
  - `forumTopic` - 论坛主题表
  - `forumReply` - 论坛回复表
  - `forumProfile` - 论坛用户资料表

### 1.3 管理功能模块

#### 1.3.1 板块分组服务 (forum-section-group.service.ts)
- **功能描述**: 管理论坛板块分组的创建、查询、更新、删除等操作
- **主要数据表**:
  - `forumSectionGroup` - 论坛板块分组表

#### 1.3.2 版主服务 (moderator.service.ts)
- **功能描述**: 管理版主的创建、权限分配、查询等操作
- **主要数据表**:
  - `forumModerator` - 版主表
  - `forumModeratorSection` - 版主板块关联表
  - `forumProfile` - 论坛用户资料表

#### 1.3.3 板块权限服务 (section-permission.service.ts)
- **功能描述**: 管理版主在板块的权限计算、分配、检查等操作
- **主要数据表**:
  - `forumModeratorSection` - 版主板块关联表

#### 1.3.4 举报服务 (forum-report.service.ts)
- **功能描述**: 管理论坛举报的创建、查询、处理、统计等操作
- **主要数据表**:
  - `forumReport` - 举报记录表
  - `forumTopic` - 论坛主题表
  - `forumReply` - 论坛回复表
  - `forumProfile` - 论坛用户资料表

### 1.4 辅助功能模块

#### 1.4.1 标签服务 (forum-tag.service.ts)
- **功能描述**: 管理标签的创建、查询、主题标签关联等操作
- **主要数据表**:
  - `forumTag` - 标签表
  - `forumTopicTag` - 主题标签关联表
  - `forumTopic` - 论坛主题表

#### 1.4.2 通知服务 (notification.service.ts)
- **功能描述**: 管理通知的创建、查询、标记已读等操作
- **主要数据表**:
  - `forumNotification` - 通知表

#### 1.4.3 积分服务 (point.service.ts)
- **功能描述**: 管理积分规则、积分记录、积分增加/减少等操作
- **主要数据表**:
  - `forumPointRecord` - 积分记录表
  - `forumPointRule` - 积分规则表
  - `forumProfile` - 论坛用户资料表

#### 1.4.4 搜索服务 (search.service.ts)
- **功能描述**: 提供主题和回复的搜索功能
- **主要数据表**:
  - `forumTopic` - 论坛主题表
  - `forumReply` - 论坛回复表

#### 1.4.5 等级规则服务 (level-rule.service.ts)
- **功能描述**: 管理等级规则、等级权限检查、等级升级等操作
- **主要数据表**:
  - `forumLevelRule` - 等级规则表
  - `forumProfile` - 论坛用户资料表
- **关联数据表**:
  - `forumTopic` - 论坛主题表（用于统计）
  - `forumReply` - 论坛回复表（用于统计）
  - `forumTopicLike` - 主题点赞表（用于统计）
  - `forumTopicFavorite` - 主题收藏表（用于统计）
  - `forumReplyLike` - 回复点赞表（用于统计）

## 2. 数据表与Service模块对应关系

### 2.1 核心数据表

#### 2.1.1 forumTopic (论坛主题表)
- **对应Service模块**:
  - forum-topic.service.ts (主要使用)
  - forum-reply.service.ts (关联查询)
  - forum-view.service.ts (浏览记录)
  - forum-tag.service.ts (标签关联)
  - forum-report.service.ts (举报目标)
  - search.service.ts (搜索功能)
  - level-rule.service.ts (统计功能)
- **数据表状态**: ✅ 有完整的功能实现

#### 2.1.2 forumReply (论坛回复表)
- **对应Service模块**:
  - forum-reply.service.ts (主要使用)
  - forum-reply-like.service.ts (点赞功能)
  - forum-view.service.ts (浏览记录)
  - forum-report.service.ts (举报目标)
  - search.service.ts (搜索功能)
  - level-rule.service.ts (统计功能)
- **数据表状态**: ✅ 有完整的功能实现

#### 2.1.3 forumSection (论坛板块表)
- **对应Service模块**:
  - forum-section.service.ts (主要使用)
  - forum-topic.service.ts (板块查询)
  - forum-reply.service.ts (板块统计)
- **数据表状态**: ✅ 有完整的功能实现

#### 2.1.4 forumProfile (论坛用户资料表)
- **对应Service模块**:
  - user.service.ts (主要使用)
  - forum-topic.service.ts (用户信息)
  - forum-reply.service.ts (用户信息)
  - forum-view.service.ts (用户信息)
  - forum-report.service.ts (举报人/被举报人)
  - point.service.ts (积分管理)
  - level-rule.service.ts (等级管理)
- **数据表状态**: ✅ 有完整的功能实现

### 2.2 互动数据表

#### 2.2.1 forumTopicLike (主题点赞表)
- **对应Service模块**:
  - forum-topic-like.service.ts (主要使用)
  - forum-topic.service.ts (点赞统计)
  - level-rule.service.ts (权限统计)
- **数据表状态**: ✅ 有完整的功能实现

#### 2.2.2 forumReplyLike (回复点赞表)
- **对应Service模块**:
  - forum-reply-like.service.ts (主要使用)
  - level-rule.service.ts (权限统计)
- **数据表状态**: ✅ 有完整的功能实现

#### 2.2.3 forumView (浏览记录表)
- **对应Service模块**:
  - forum-view.service.ts (主要使用)
- **数据表状态**: ✅ 有完整的功能实现

#### 2.2.4 forumTopicFavorite (主题收藏表)
- **对应Service模块**:
  - ⚠️ 未找到对应的Service模块
- **数据表状态**: ⚠️ 功能缺失

### 2.3 管理数据表

#### 2.3.1 forumSectionGroup (论坛板块分组表)
- **对应Service模块**:
  - forum-section-group.service.ts (主要使用)
  - forum-section.service.ts (分组关联)
- **数据表状态**: ✅ 有完整的功能实现

#### 2.3.2 forumModerator (版主表)
- **对应Service模块**:
  - moderator.service.ts (主要使用)
- **数据表状态**: ✅ 有完整的功能实现

#### 2.3.3 forumModeratorSection (版主板块关联表)
- **对应Service模块**:
  - moderator.service.ts (关联管理)
  - section-permission.service.ts (权限管理)
- **数据表状态**: ✅ 有完整的功能实现

#### 2.3.4 forumReport (举报记录表)
- **对应Service模块**:
  - forum-report.service.ts (主要使用)
- **数据表状态**: ✅ 有完整的功能实现

### 2.4 辅助数据表

#### 2.4.1 forumTag (标签表)
- **对应Service模块**:
  - forum-tag.service.ts (主要使用)
- **数据表状态**: ✅ 有完整的功能实现

#### 2.4.2 forumTopicTag (主题标签关联表)
- **对应Service模块**:
  - forum-tag.service.ts (主要使用)
- **数据表状态**: ✅ 有完整的功能实现

#### 2.4.3 forumNotification (通知表)
- **对应Service模块**:
  - notification.service.ts (主要使用)
- **数据表状态**: ✅ 有完整的功能实现

#### 2.4.4 forumPointRecord (积分记录表)
- **对应Service模块**:
  - point.service.ts (主要使用)
- **数据表状态**: ✅ 有完整的功能实现

#### 2.4.5 forumPointRule (积分规则表)
- **对应Service模块**:
  - point.service.ts (主要使用)
- **数据表状态**: ✅ 有完整的功能实现

#### 2.4.6 forumLevelRule (等级规则表)
- **对应Service模块**:
  - level-rule.service.ts (主要使用)
- **数据表状态**: ✅ 有完整的功能实现

#### 2.4.7 forumBadge (徽章表)
- **对应Service模块**:
  - ⚠️ 未找到对应的Service模块
- **数据表状态**: ⚠️ 功能缺失

#### 2.4.8 forumProfileBadge (用户徽章关联表)
- **对应Service模块**:
  - ⚠️ 未找到对应的Service模块
- **数据表状态**: ⚠️ 功能缺失

#### 2.4.9 forumAuditLog (审计日志表)
- **对应Service模块**:
  - ⚠️ 未找到对应的Service模块
- **数据表状态**: ⚠️ 功能缺失

## 3. 发现的问题

### 3.1 功能缺失问题

#### 3.1.1 主题收藏功能缺失
- **数据表**: forumTopicFavorite
- **问题描述**: 数据表已创建，但没有对应的Service模块来管理主题收藏功能
- **影响**: 用户无法收藏主题，影响用户体验
- **建议**: 创建 forum-topic-favorite.service.ts 来管理主题收藏功能

#### 3.1.2 徽章管理功能缺失
- **数据表**: forumBadge, forumProfileBadge
- **问题描述**: 数据表已创建，但没有对应的Service模块来管理徽章功能
- **影响**: 无法实现徽章系统，影响用户激励机制
- **建议**: 创建 forum-badge.service.ts 来管理徽章功能

#### 3.1.3 审计日志功能缺失
- **数据表**: forumAuditLog
- **问题描述**: 数据表已创建，但没有对应的Service模块来管理审计日志
- **影响**: 无法记录关键操作日志，影响系统安全性和可追溯性
- **建议**: 创建 forum-audit-log.service.ts 来管理审计日志功能

### 3.2 数据表设计问题

#### 3.2.1 forumTopicFavorite 表缺少关联索引
- **问题描述**: forumTopicFavorite 表可能缺少复合索引，影响查询性能
- **建议**: 检查并添加适当的索引

#### 3.2.2 forumProfileBadge 表缺少关联索引
- **问题描述**: forumProfileBadge 表可能缺少复合索引，影响查询性能
- **建议**: 检查并添加适当的索引

## 4. 总结

### 4.1 整体评估
- **Service模块总数**: 16个
- **数据表总数**: 25个
- **完全对应的数据表**: 22个
- **功能缺失的数据表**: 3个

### 4.2 功能完整性
- **核心功能**: ✅ 完整
- **互动功能**: ⚠️ 部分缺失（主题收藏功能）
- **管理功能**: ✅ 完整
- **辅助功能**: ⚠️ 部分缺失（徽章管理、审计日志）

### 4.3 数据表设计
- **数据表结构**: ✅ 合理
- **关联关系**: ✅ 清晰
- **索引设计**: ⚠️ 需要检查
- **字段设计**: ✅ 完整

### 4.4 改进建议
1. 创建主题收藏功能的Service模块
2. 创建徽章管理功能的Service模块
3. 创建审计日志功能的Service模块
4. 检查并优化数据表索引
5. 完善相关文档和注释
