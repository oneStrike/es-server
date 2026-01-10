# 业务逻辑审查 - 待办事项清单

## 1. 第一优先级待办事项（必须立即修复）

### 1.1 数据一致性问题修复

#### 1.1.1 创建ForumStatisticsService服务
**文件位置**: `libs/forum/src/statistics/statistics.service.ts`

**操作指引**:
1. 在`libs/forum/src/`目录下创建`statistics`文件夹
2. 创建`statistics.service.ts`文件
3. 实现以下方法：
   - `updateSectionTopicCount(sectionId: number, delta: number)` - 更新板块主题数
   - `updateTopicReplyCount(topicId: number, delta: number)` - 更新主题回复数
   - `updateTopicLikeCount(topicId: number, delta: number)` - 更新主题点赞数
   - `updateTopicFavoriteCount(topicId: number, delta: number)` - 更新主题收藏数
   - `updateSectionModeratorCount(sectionId: number, delta: number)` - 更新版主数

**参考代码**: 详见`TEMP_改进方案.md`中的方案一

#### 1.1.2 修改TopicService添加统计字段更新
**文件位置**: `libs/forum/src/topic/topic.service.ts`

**操作指引**:
1. 修改`createTopic`方法，在事务内调用`updateSectionTopicCount`
2. 修改`deleteTopic`方法，在事务内调用`updateSectionTopicCount`
3. 确保所有统计字段更新在事务内执行

**参考代码**: 详见`TEMP_改进方案.md`中的方案一

#### 1.1.3 修改ReplyService添加统计字段更新
**文件位置**: `libs/forum/src/reply/reply.service.ts`

**操作指引**:
1. 修改`createReply`方法，在事务内调用`updateTopicReplyCount`
2. 修改`deleteReply`方法，在事务内调用`updateTopicReplyCount`
3. 确保所有统计字段更新在事务内执行

**参考代码**: 详见`TEMP_改进方案.md`中的方案一

#### 1.1.4 修改LikeService添加统计字段更新
**文件位置**: `libs/forum/src/like/like.service.ts`

**操作指引**:
1. 修改`toggleLike`方法，在事务内调用`updateTopicLikeCount`
2. 确保统计字段更新在事务内执行

**参考代码**: 详见`TEMP_改进方案.md`中的方案一

#### 1.1.5 修改FavoriteService添加统计字段更新
**文件位置**: `libs/forum/src/favorite/favorite.service.ts`

**操作指引**:
1. 修改`toggleFavorite`方法，在事务内调用`updateTopicFavoriteCount`
2. 确保统计字段更新在事务内执行

**参考代码**: 详见`TEMP_改进方案.md`中的方案一

#### 1.1.6 修改ModeratorService添加统计字段更新
**文件位置**: `libs/forum/src/moderator/moderator.service.ts`

**操作指引**:
1. 修改`createModerator`方法，在事务内调用`updateSectionModeratorCount`
2. 修改`deleteModerator`方法，在事务内调用`updateSectionModeratorCount`
3. 确保统计字段更新在事务内执行

**参考代码**: 详见`TEMP_改进方案.md`中的方案一

### 1.2 并发控制问题修复

#### 1.2.1 修复PointService的并发控制问题
**文件位置**: `libs/forum/src/point/point.service.ts`

**操作指引**:
1. 在`addPoints`方法中使用事务
2. 使用乐观锁或悲观锁防止竞态条件
3. 考虑添加分布式锁支持

**参考代码**: 详见`TEMP_改进方案.md`中的并发控制改进方案

#### 1.2.2 修复ExperienceService的并发控制问题
**文件位置**: `libs/forum/src/experience/experience.service.ts`

**操作指引**:
1. 在`addExperience`方法中使用事务
2. 使用乐观锁或悲观锁防止竞态条件
3. 考虑添加分布式锁支持

**参考代码**: 详见`TEMP_改进方案.md`中的并发控制改进方案

#### 1.2.3 修复LikeService的并发控制问题
**文件位置**: `libs/forum/src/like/like.service.ts`

**操作指引**:
1. 在`toggleLike`方法中使用事务
2. 确保点赞状态和统计字段更新在同一个事务中

**参考代码**: 详见`TEMP_改进方案.md`中的并发控制改进方案

#### 1.2.4 修复FavoriteService的并发控制问题
**文件位置**: `libs/forum/src/favorite/favorite.service.ts`

**操作指引**:
1. 在`toggleFavorite`方法中使用事务
2. 确保收藏状态和统计字段更新在同一个事务中

**参考代码**: 详见`TEMP_改进方案.md`中的并发控制改进方案

#### 1.2.5 修复TopicService的并发控制问题
**文件位置**: `libs/forum/src/topic/topic.service.ts`

**操作指引**:
1. 在`createTopic`方法中使用事务
2. 确保主题创建和统计字段更新在同一个事务中

**参考代码**: 详见`TEMP_改进方案.md`中的并发控制改进方案

#### 1.2.6 修复ReplyService的并发控制问题
**文件位置**: `libs/forum/src/reply/reply.service.ts`

**操作指引**:
1. 在`createReply`方法中使用事务
2. 确保回复创建和统计字段更新在同一个事务中

**参考代码**: 详见`TEMP_改进方案.md`中的并发控制改进方案

### 1.3 权限控制问题修复

#### 1.3.1 创建PermissionsGuard守卫
**文件位置**: `libs/forum/src/guards/permissions.guard.ts`

**操作指引**:
1. 在`libs/forum/src/`目录下创建`guards`文件夹
2. 创建`permissions.guard.ts`文件
3. 实现基于RBAC的权限守卫
4. 从请求中提取用户权限
5. 检查用户是否拥有所需权限

**参考代码**: 详见`TEMP_改进方案.md`中的权限控制改进方案

#### 1.3.2 创建RequirePermissions装饰器
**文件位置**: `libs/forum/src/decorators/require-permissions.decorator.ts`

**操作指引**:
1. 在`libs/forum/src/`目录下创建`decorators`文件夹
2. 创建`require-permissions.decorator.ts`文件
3. 实现权限装饰器，用于标记需要特定权限的路由

**参考代码**: 详见`TEMP_改进方案.md`中的权限控制改进方案

#### 1.3.3 修复SectionPermissionService的permissionService引用
**文件位置**: `libs/forum/src/section/section-permission.service.ts`

**操作指引**:
1. 检查`permissionService`的引用是否正确
2. 如果不存在，需要创建或修复该服务
3. 确保权限检查逻辑正确

**参考代码**: 详见`TEMP_权限控制检查.md`中的问题分析

#### 1.3.4 在控制器中添加权限验证
**文件位置**: 各个控制器文件

**操作指引**:
1. 在需要权限验证的路由上使用`@RequirePermissions`装饰器
2. 在控制器类或方法上应用`@UseGuards(PermissionsGuard)`
3. 确保权限验证正确实施

**参考代码**: 详见`TEMP_改进方案.md`中的权限控制改进方案

## 2. 第二优先级待办事项（尽快修复）

### 2.1 业务流程问题修复

#### 2.1.1 重构主题创建流程
**文件位置**: `libs/forum/src/topic/topic.service.ts`

**操作指引**:
1. 将通知发送移到事务外
2. 实现异步通知机制
3. 确保事务失败时不会影响通知发送

**参考代码**: 详见`TEMP_改进方案.md`中的业务流程改进方案

#### 2.1.2 重构回复创建流程
**文件位置**: `libs/forum/src/reply/reply.service.ts`

**操作指引**:
1. 将通知发送移到事务外
2. 实现异步通知机制
3. 确保事务失败时不会影响通知发送

**参考代码**: 详见`TEMP_改进方案.md`中的业务流程改进方案

#### 2.1.3 实现经验等级升级逻辑
**文件位置**: `libs/forum/src/experience/experience.service.ts`

**操作指引**:
1. 在`addExperience`方法中添加等级升级逻辑
2. 根据经验值计算用户等级
3. 更新用户等级信息

**参考代码**: 详见`TEMP_改进方案.md`中的业务流程改进方案

### 2.2 功能完整性问题修复

#### 2.2.1 创建forum-topic.controller.ts
**文件位置**: `libs/forum/src/topic/forum-topic.controller.ts`

**操作指引**:
1. 创建`forum-topic.controller.ts`文件
2. 实现主题相关的API端点
3. 添加权限验证
4. 添加输入验证

**参考代码**: 参考其他控制器的实现模式

#### 2.2.2 创建forum-section.controller.ts
**文件位置**: `libs/forum/src/section/forum-section.controller.ts`

**操作指引**:
1. 创建`forum-section.controller.ts`文件
2. 实现板块相关的API端点
3. 添加权限验证
4. 添加输入验证

**参考代码**: 参考其他控制器的实现模式

#### 2.2.3 创建forum-moderator.controller.ts
**文件位置**: `libs/forum/src/moderator/forum-moderator.controller.ts`

**操作指引**:
1. 创建`forum-moderator.controller.ts`文件
2. 实现版主相关的API端点
3. 添加权限验证
4. 添加输入验证

**参考代码**: 参考其他控制器的实现模式

### 2.3 安全性问题修复

#### 2.3.1 实现请求频率限制
**文件位置**: `libs/base/src/modules/throttle/` 或 `libs/forum/src/guards/`

**操作指引**:
1. 创建频率限制守卫或中间件
2. 使用Redis存储请求计数
3. 配置不同路由的频率限制规则

**参考代码**: 详见`TEMP_改进方案.md`中的安全性改进方案

#### 2.3.2 实现CSRF保护
**文件位置**: `libs/base/src/modules/csrf/` 或 `libs/forum/src/guards/`

**操作指引**:
1. 创建CSRF守卫或中间件
2. 生成和验证CSRF令牌
3. 在表单中添加CSRF令牌

**参考代码**: 详见`TEMP_改进方案.md`中的安全性改进方案

#### 2.3.3 配置安全头
**文件位置**: `libs/base/src/main.ts` 或 `libs/forum/src/main.ts`

**操作指引**:
1. 使用Helmet配置安全头
2. 配置CSP、XSS保护等安全头
3. 确保安全头正确配置

**参考代码**: 详见`TEMP_改进方案.md`中的安全性改进方案

#### 2.3.4 创建敏感词过滤API端点
**文件位置**: `libs/forum/src/sensitive-word/sensitive-word.controller.ts`

**操作指引**:
1. 创建敏感词过滤控制器
2. 实现敏感词检查API端点
3. 添加权限验证
4. 添加输入验证

**参考代码**: 详见`TEMP_改进方案.md`中的安全性改进方案

## 3. 第三优先级待办事项（逐步改进）

### 3.1 代码质量改进

#### 3.1.1 改进异常处理
**文件位置**: 各个服务文件

**操作指引**:
1. 检查所有异常处理
2. 确保异常信息详细准确
3. 使用适当的异常类型

**参考代码**: 详见`TEMP_异常处理评估.md`中的问题分析

#### 3.1.2 消除any类型使用
**文件位置**: 各个文件

**操作指引**:
1. 搜索所有`any`类型使用
2. 替换为具体类型
3. 确保类型安全

**参考代码**: 详见`TEMP_TypeScript类型安全检查.md`中的问题分析

#### 3.1.3 增强日志记录
**文件位置**: 各个服务文件

**操作指引**:
1. 检查所有日志记录
2. 确保日志信息详细准确
3. 使用适当的日志级别

**参考代码**: 详见`TEMP_异常处理评估.md`中的问题分析

### 3.2 权限粒度改进

#### 3.2.1 实现资源级权限控制
**文件位置**: `libs/forum/src/guards/permissions.guard.ts`

**操作指引**:
1. 扩展PermissionsGuard守卫
2. 支持资源级权限检查
3. 实现资源所有权验证

**参考代码**: 详见`TEMP_改进方案.md`中的权限控制改进方案

#### 3.2.2 优化权限检查逻辑
**文件位置**: `libs/forum/src/section/section-permission.service.ts`

**操作指引**:
1. 优化权限计算逻辑
2. 提高权限检查性能
3. 添加权限缓存

**参考代码**: 详见`TEMP_改进方案.md`中的权限控制改进方案

### 3.3 审计日志改进

#### 3.3.1 实现操作审计日志
**文件位置**: `libs/forum/src/audit/audit.service.ts`

**操作指引**:
1. 创建审计日志服务
2. 记录所有重要操作
3. 实现审计日志查询功能

**参考代码**: 详见`TEMP_改进方案.md`中的审计日志改进方案

#### 3.3.2 实现权限变更审计
**文件位置**: `libs/forum/src/audit/audit.service.ts`

**操作指引**:
1. 记录所有权限变更操作
2. 记录权限变更前后状态
3. 实现权限变更审计查询功能

**参考代码**: 详见`TEMP_改进方案.md`中的审计日志改进方案

## 4. 缺少的配置

### 4.1 环境变量配置

#### 4.1.1 Redis配置
**文件位置**: `.env`

**操作指引**:
1. 添加Redis连接配置
2. 配置Redis缓存策略
3. 配置Redis分布式锁

**示例配置**:
```
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

#### 4.1.2 频率限制配置
**文件位置**: `.env`

**操作指引**:
1. 添加频率限制配置
2. 配置不同路由的频率限制规则

**示例配置**:
```
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

#### 4.1.3 CSRF配置
**文件位置**: `.env`

**操作指引**:
1. 添加CSRF配置
2. 配置CSRF令牌有效期

**示例配置**:
```
CSRF_SECRET=your-secret-key
CSRF_EXPIRES_IN=3600
```

### 4.2 数据库配置

#### 4.2.1 添加审计日志表
**文件位置**: `prisma/models/forum/audit-log.prisma`

**操作指引**:
1. 创建审计日志模型
2. 运行数据库迁移
3. 更新Prisma客户端

**参考代码**: 详见`TEMP_改进方案.md`中的审计日志改进方案

#### 4.2.2 添加权限缓存表（可选）
**文件位置**: `prisma/models/forum/permission-cache.prisma`

**操作指引**:
1. 创建权限缓存模型
2. 运行数据库迁移
3. 更新Prisma客户端

**参考代码**: 详见`TEMP_改进方案.md`中的权限控制改进方案

## 5. 测试建议

### 5.1 单元测试
- 为所有新增的服务编写单元测试
- 测试统计字段更新逻辑
- 测试并发控制逻辑
- 测试权限检查逻辑

### 5.2 集成测试
- 测试完整的业务流程
- 测试事务一致性
- 测试并发场景
- 测试权限控制

### 5.3 性能测试
- 测试高并发场景
- 测试缓存效果
- 测试权限检查性能

## 6. 文档更新

### 6.1 API文档
- 更新所有新增的API端点
- 更新权限要求说明
- 更新错误码说明

### 6.2 架构文档
- 更新系统架构图
- 更新模块依赖关系
- 更新数据流向图

### 6.3 部署文档
- 更新环境变量配置说明
- 更新数据库迁移步骤
- 更新部署流程

## 7. 注意事项

### 7.1 数据库迁移
- 在生产环境执行数据库迁移前，先在测试环境验证
- 备份生产数据库
- 准备回滚方案

### 7.2 缓存策略
- 合理配置缓存过期时间
- 实现缓存预热
- 监控缓存命中率

### 7.3 权限控制
- 确保权限配置正确
- 测试所有权限场景
- 避免权限漏洞

### 7.4 并发控制
- 测试高并发场景
- 监控系统性能
- 优化锁策略

### 7.5 安全性
- 定期更新依赖
- 监控安全漏洞
- 实施安全审计

## 8. 实施建议

### 8.1 分阶段实施
- 按优先级分阶段实施
- 每个阶段完成后进行测试
- 确保每个阶段的质量

### 8.2 代码审查
- 所有代码变更需要经过审查
- 确保代码质量
- 避免引入新问题

### 8.3 测试覆盖
- 确保测试覆盖充分
- 包括单元测试、集成测试、性能测试
- 确保测试通过

### 8.4 监控告警
- 实施系统监控
- 配置告警规则
- 及时发现问题

### 8.5 文档同步
- 及时更新文档
- 确保文档准确
- 便于后续维护

## 9. 参考文档

- `FINAL_业务逻辑审查.md` - 完整审查报告
- `TEMP_改进方案.md` - 详细改进方案
- `TEMP_数据一致性检查.md` - 数据一致性检查结果
- `TEMP_并发控制检查.md` - 并发控制检查结果
- `TEMP_权限控制检查.md` - 权限控制检查结果
- `TEMP_业务流程合理性评估.md` - 业务流程评估结果
- `TEMP_安全性评估.md` - 安全性评估结果
