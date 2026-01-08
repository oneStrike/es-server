# 功能与数据表一致性检查 - 对齐文档

## 1. 原始需求

对 `libs\forum\src` 目录下的所有功能模块与对应的数据表进行全面一致性检查。按照社区开发最佳实践，系统梳理现有功能实现与业务数据表结构，严格排查是否存在功能缺失、数据表设计不合理的情况。需详细检查每个功能模块的实现逻辑、数据交互流程及对应的数据表结构，确保所有功能均有对应的数据表支持，同时验证所有数据表均有相应的功能实现。完成后输出详细的梳理报告，包括功能与数据表的对应关系、发现的问题及改进建议。

## 2. 边界确认

### 2.1 检查范围
- **代码范围**: `libs\forum\src` 目录下的所有功能模块
- **数据表范围**: `prisma\models\forum` 目录下的所有Prisma模型文件
- **检查维度**:
  - 功能模块与数据表的对应关系
  - 数据表与功能模块的对应关系
  - 功能完整性检查
  - 数据表设计合理性检查

### 2.2 不包含范围
- 不检查其他模块（如client、work、admin）的数据表
- 不检查非forum相关的功能模块
- 不检查数据库性能优化
- 不检查前端实现

## 3. 需求理解

### 3.1 项目技术栈
- **框架**: NestJS
- **语言**: TypeScript
- **ORM**: Prisma
- **数据库**: PostgreSQL
- **架构**: 模块化架构（Service-Controller-DTO模式）

### 3.2 功能模块识别

从 `libs\forum\src` 目录识别出以下功能模块：

| 模块名称 | Service文件 | 功能描述 |
|---------|------------|---------|
| 主题管理 | forum-topic.service.ts | 主题的创建、更新、删除、查询、审核等 |
| 回复管理 | forum-reply.service.ts | 回复的创建、更新、删除、查询、审核等 |
| 板块管理 | forum-section.service.ts | 板块的创建、更新、删除、查询等 |
| 板块分组管理 | forum-section-group.service.ts | 板块分组的创建、更新、删除、查询等 |
| 回复点赞 | forum-reply-like.service.ts | 回复的点赞和取消点赞 |
| 主题点赞 | forum-topic-like.service.ts | 主题的点赞和取消点赞 |
| 用户管理 | user.service.ts | 论坛用户的创建、更新、删除、查询等 |
| 板块权限管理 | section-permission.service.ts | 板块权限的管理和验证 |
| 举报管理 | forum-report.service.ts | 举报的创建、处理、查询等 |
| 版主管理 | moderator.service.ts | 版主的创建、更新、删除、权限管理等 |
| 浏览记录管理 | forum-view.service.ts | 浏览记录的创建、查询等 |
| 标签管理 | forum-tag.service.ts | 标签的创建、更新、删除、查询等 |
| 通知管理 | notification.service.ts | 通知的创建、查询、标记已读等 |
| 积分管理 | point.service.ts | 积分的获取、消费、查询等 |
| 搜索管理 | search.service.ts | 主题和回复的搜索功能 |
| 等级规则管理 | level-rule.service.ts | 等级规则的创建、更新、删除、查询等 |

### 3.3 数据表识别

从 `prisma\models\forum` 目录识别出以下数据表：

| 表名 | 功能描述 | 关键字段 |
|-----|---------|---------|
| forum_topic | 论坛主题表 | id, title, content, sectionId, userId, auditStatus, viewCount, replyCount, likeCount, favoriteCount |
| forum_reply | 论坛回复表 | id, content, topicId, profileId, floor, auditStatus, likeCount |
| forum_section | 论坛板块表 | id, name, groupId, topicReviewPolicy, userLevelRuleId, topicCount, replyCount |
| forum_section_group | 论坛板块分组表 | id, name, sortOrder, maxModerators |
| forum_topic_like | 论坛主题点赞表 | id, topicId, userId |
| forum_reply_like | 论坛回复点赞表 | id, replyId, userId |
| forum_topic_favorite | 论坛主题收藏表 | id, topicId, userId |
| forum_tag | 论坛标签表 | id, name, icon, useCount |
| forum_topic_tag | 论坛主题标签关联表 | id, topicId, tagId |
| forum_moderator | 论坛版主表 | id, userId, roleType, groupId, permissions |
| forum_moderator_section | 论坛版主板块关联表 | id, moderatorId, sectionId, permissions |
| forum_moderator_application | 论坛版主申请表 | id, applicantId, sectionId, permissions, status |
| forum_moderator_action_log | 论坛版主操作日志表 | id, moderatorId, actionType, targetType, targetId |
| forum_profile | 论坛用户资料表 | id, userId, points, levelId, topicCount, replyCount, likeCount, favoriteCount, status |
| forum_notification | 论坛通知表 | id, profileId, type, title, content, isRead |
| forum_view | 论坛浏览记录表 | id, topicId, replyId, userId, viewedAt, duration |
| forum_report | 论坛举报表 | id, reporterId, type, targetId, reason, status |
| forum_point_rule | 论坛积分规则表 | id, name, type, points, dailyLimit |
| forum_point_record | 论坛积分记录表 | id, userId, ruleId, points, beforePoints, afterPoints |
| forum_level_rule | 论坛等级规则表 | id, name, requiredPoints, dailyTopicLimit, dailyReplyLimit, postInterval |
| forum_badge | 论坛徽章表 | id, name, icon, type |
| forum_profile_badge | 论坛用户徽章关联表 | id, profileId, badgeId |
| forum_sensitive_word | 论坛敏感词表 | id, word, replaceWord, level, matchMode, type |
| forum_audit_log | 论坛审核日志表 | id, objectType, objectId, auditStatus, auditBy |
| forum_user_action_log | 论坛用户操作日志表 | id, userId, actionType, targetType, targetId |

## 4. 疑问澄清

### 4.1 已明确的问题
- ✅ 检查范围已明确：forum模块的所有功能模块和数据表
- ✅ 检查维度已明确：功能与数据表的对应关系、功能完整性、数据表设计合理性
- ✅ 输出要求已明确：详细的梳理报告，包括对应关系、问题、改进建议

### 4.2 需要确认的问题
- ❓ 是否需要检查数据库中的实际数据（使用PostgreSQL查询）？
- ❓ 是否需要检查数据表的索引设计是否合理？
- ❓ 是否需要检查数据表的关联关系是否正确？
- ❓ 是否需要检查Service层的实现逻辑是否完整？
- ❓ 是否需要检查Controller层的API接口是否完整？

### 4.3 决策策略
基于社区开发最佳实践和现有项目结构，我将：
1. **优先检查功能与数据表的对应关系**：确保每个功能模块都有对应的数据表支持
2. **检查数据表与功能模块的对应关系**：确保每个数据表都有相应的功能实现
3. **分析功能缺失问题**：识别哪些功能有数据表支持但没有实现，或哪些功能实现了但没有数据表支持
4. **分析数据表设计问题**：检查数据表设计是否合理，是否存在冗余或缺失
5. **使用PostgreSQL查询工具**：查询数据库中的实际数据，验证数据表的使用情况
6. **生成详细的梳理报告**：包括对应关系、发现的问题、改进建议

## 5. 项目特性规范

### 5.1 代码规范
- 使用TypeScript强类型
- 使用Prisma ORM进行数据库操作
- 使用NestJS框架的依赖注入
- Service层负责业务逻辑
- Controller层负责API接口
- DTO层负责数据传输对象

### 5.2 数据表设计规范
- 使用软删除（deletedAt字段）
- 使用乐观锁（version字段）
- 使用时间戳（createdAt, updatedAt）
- 使用索引优化查询性能
- 使用外键约束保证数据完整性
- 使用枚举类型（SmallInt）存储状态

### 5.3 业务逻辑规范
- 主题和回复需要审核
- 用户操作需要记录日志
- 版主操作需要记录日志
- 积分变化需要记录
- 通知需要及时推送
- 敏感词需要过滤

## 6. 验收标准

### 6.1 功能与数据表对应关系
- ✅ 每个功能模块都有对应的数据表支持
- ✅ 每个数据表都有相应的功能实现
- ✅ 对应关系清晰明确

### 6.2 功能完整性
- ✅ 所有核心功能都已实现
- ✅ 功能实现符合业务需求
- ✅ 功能实现符合技术规范

### 6.3 数据表设计合理性
- ✅ 数据表设计符合业务需求
- ✅ 数据表设计符合数据库规范
- ✅ 数据表设计符合性能要求

### 6.4 梳理报告质量
- ✅ 报告结构清晰
- ✅ 报告内容完整
- ✅ 报告结论准确
- ✅ 改进建议可行
