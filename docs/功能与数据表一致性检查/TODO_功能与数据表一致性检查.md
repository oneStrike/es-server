# 功能与数据表一致性检查 - 待办事项清单

## 1. 高优先级待办事项（1-2周内完成）

### 1.1 实现主题收藏功能
- **状态**: 待实现
- **优先级**: 高
- **预计工作量**: 2-3天
- **详细任务**:
  - [ ] 创建 `libs/forum/src/topic-favorite/forum-topic-favorite.service.ts`
  - [ ] 实现以下方法:
    - [ ] `createFavorite(topicId, userId)` - 创建收藏
    - [ ] `removeFavorite(topicId, userId)` - 取消收藏
    - [ ] `getUserFavorites(userId, pageIndex, pageSize)` - 获取用户收藏列表
    - [ ] `checkFavorite(topicId, userId)` - 检查是否已收藏
    - [ ] `getTopicFavoriteCount(topicId)` - 获取主题收藏数
  - [ ] 在主题服务中添加收藏统计功能
  - [ ] 在用户服务中添加收藏列表查询接口
  - [ ] 创建对应的Controller
  - [ ] 创建对应的DTO
  - [ ] 编写单元测试
  - [ ] 编写集成测试
- **参考文件**:
  - 数据表定义: `prisma/models/forum/forum-topic-favorite.prisma`
  - 类似功能: `libs/forum/src/topic-like/forum-topic-like.service.ts`

### 1.2 实现审计日志功能
- **状态**: 待实现
- **优先级**: 高
- **预计工作量**: 3-4天
- **详细任务**:
  - [ ] 创建 `libs/forum/src/audit-log/forum-audit-log.service.ts`
  - [ ] 实现以下方法:
    - [ ] `createLog(userId, action, entityType, entityId, details, ipAddress, userAgent)` - 创建日志
    - [ ] `getLogs(queryDto)` - 获取日志列表
    - [ ] `getUserLogs(userId, queryDto)` - 获取用户操作日志
    - [ ] `getEntityLogs(entityType, entityId, queryDto)` - 获取实体操作日志
    - [ ] `getLogStatistics(queryDto)` - 获取日志统计
  - [ ] 在关键操作中集成日志记录（如删除、修改）
  - [ ] 实现日志导出功能
  - [ ] 创建对应的Controller
  - [ ] 创建对应的DTO
  - [ ] 编写单元测试
  - [ ] 编写集成测试
- **参考文件**:
  - 数据表定义: `prisma/models/forum/forum-audit-log.prisma`
  - 需要记录的操作: 主题删除、回复删除、用户封禁、版主操作等

### 1.3 优化数据表索引
- **状态**: 待检查
- **优先级**: 高
- **预计工作量**: 1-2天
- **详细任务**:
  - [ ] 检查 `forumTopicFavorite` 表的索引
    - [ ] 确认是否存在复合索引 `@@unique([topicId, userId])`
    - [ ] 确认是否存在索引 `@@index([userId])`
    - [ ] 确认是否存在索引 `@@index([topicId])`
    - [ ] 如缺少则添加相应索引
  - [ ] 检查 `forumProfileBadge` 表的索引
    - [ ] 确认是否存在复合索引 `@@unique([profileId, badgeId])`
    - [ ] 确认是否存在索引 `@@index([profileId])`
    - [ ] 确认是否存在索引 `@@index([badgeId])`
    - [ ] 如缺少则添加相应索引
  - [ ] 检查 `forumAuditLog` 表的索引
    - [ ] 确认是否存在索引 `@@index([userId])`
    - [ ] 确认是否存在索引 `@@index([action])`
    - [ ] 确认是否存在索引 `@@index([entityType, entityId])`
    - [ ] 确认是否存在索引 `@@index([createdAt])`
    - [ ] 如缺少则添加相应索引
  - [ ] 运行数据库迁移脚本
  - [ ] 测试索引优化效果
- **参考文件**:
  - 数据表定义: `prisma/models/forum/` 目录下对应的Prisma文件
  - Prisma文档: https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#indexes

## 2. 中优先级待办事项（1-2个月内完成）

### 2.1 实现徽章管理功能
- **状态**: 待实现
- **优先级**: 中
- **预计工作量**: 5-7天
- **详细任务**:
  - [ ] 创建 `libs/forum/src/badge/forum-badge.service.ts`
  - [ ] 实现以下方法:
    - [ ] `createBadge(dto)` - 创建徽章
    - [ ] `updateBadge(id, dto)` - 更新徽章
    - [ ] `deleteBadge(id)` - 删除徽章
    - [ ] `getBadges(queryDto)` - 获取徽章列表
    - [ ] `getUserBadges(userId)` - 获取用户徽章
    - [ ] `awardBadge(userId, badgeId)` - 颁发徽章
    - [ ] `revokeBadge(userId, badgeId)` - 撤销徽章
  - [ ] 实现徽章自动颁发逻辑（根据用户行为）
    - [ ] 根据发帖数量颁发徽章
    - [ ] 根据回复数量颁发徽章
    - [ ] 根据获得点赞数量颁发徽章
    - [ ] 根据等级颁发徽章
  - [ ] 在用户服务中添加用户徽章查询接口
  - [ ] 在等级规则服务中集成徽章颁发逻辑
  - [ ] 创建对应的Controller
  - [ ] 创建对应的DTO
  - [ ] 编写单元测试
  - [ ] 编写集成测试
- **参考文件**:
  - 数据表定义: `prisma/models/forum/forum-badge.prisma`
  - 数据表定义: `prisma/models/forum/forum-profile-badge.prisma`
  - 类似功能: `libs/forum/src/level-rule/level-rule.service.ts`

### 2.2 完善错误处理机制
- **状态**: 待完善
- **优先级**: 中
- **预计工作量**: 3-4天
- **详细任务**:
  - [ ] 审查所有Service方法的错误处理
  - [ ] 统一错误码和错误消息
  - [ ] 实现错误日志记录
  - [ ] 为缺少错误处理的方法添加错误处理
  - [ ] 编写错误处理测试用例
- **参考文件**:
  - 所有Service文件: `libs/forum/src/` 目录下所有 `.service.ts` 文件
  - 现有错误处理示例: `libs/forum/src/topic/forum-topic.service.ts`

### 2.3 完善事务管理
- **状态**: 待完善
- **优先级**: 中
- **预计工作量**: 2-3天
- **详细任务**:
  - [ ] 审查所有涉及多表操作的方法
  - [ ] 为缺少事务管理的方法添加事务管理
  - [ ] 测试事务回滚功能
  - [ ] 编写事务管理测试用例
- **参考文件**:
  - 所有Service文件: `libs/forum/src/` 目录下所有 `.service.ts` 文件
  - 现有事务管理示例: `libs/forum/src/topic/forum-topic.service.ts`

## 3. 低优先级待办事项（3-6个月内完成）

### 3.1 性能优化
- **状态**: 待优化
- **优先级**: 低
- **预计工作量**: 7-10天
- **详细任务**:
  - [ ] 分析查询性能瓶颈
  - [ ] 优化慢查询
  - [ ] 实现缓存机制（Redis）
  - [ ] 优化数据库索引
  - [ ] 实现查询结果缓存
  - [ ] 性能测试和监控
- **参考工具**:
  - Prisma查询分析工具
  - 数据库慢查询日志
  - 性能监控工具

### 3.2 功能扩展
- **状态**: 待规划
- **优先级**: 低
- **预计工作量**: 10-15天
- **详细任务**:
  - [ ] 实现关注功能（关注用户）
  - [ ] 实现私信功能
  - [ ] 实现内容推荐功能
  - [ ] 实现数据分析功能
  - [ ] 实现更多互动功能
- **参考文件**:
  - 现有功能模块: `libs/forum/src/` 目录下所有Service文件

### 3.3 安全增强
- **状态**: 待增强
- **优先级**: 低
- **预计工作量**: 7-10天
- **详细任务**:
  - [ ] 实现更完善的权限控制
  - [ ] 实现内容审核功能
  - [ ] 实现防刷机制
  - [ ] 实现敏感词过滤
  - [ ] 实现安全审计
- **参考文件**:
  - 现有权限控制: `libs/forum/src/section-permission/section-permission.service.ts`
  - 现有举报功能: `libs/forum/src/report/forum-report.service.ts`

## 4. 文档待办事项

### 4.1 完善API文档
- **状态**: 待完善
- **优先级**: 中
- **预计工作量**: 3-4天
- **详细任务**:
  - [ ] 为所有API接口添加Swagger文档
  - [ ] 完善接口参数说明
  - [ ] 完善接口返回值说明
  - [ ] 添加接口使用示例
- **参考文件**:
  - 现有API文档: 项目中的Swagger配置文件

### 4.2 完善开发文档
- **状态**: 待完善
- **优先级**: 中
- **预计工作量**: 2-3天
- **详细任务**:
  - [ ] 完善项目架构文档
  - [ ] 完善模块设计文档
  - [ ] 完善数据库设计文档
  - [ ] 完善开发规范文档
- **参考文件**:
  - 现有文档: `docs/` 目录下所有文档

### 4.3 完善部署文档
- **状态**: 待完善
- **优先级**: 低
- **预计工作量**: 1-2天
- **详细任务**:
  - [ ] 完善部署流程文档
  - [ ] 完善环境配置文档
  - [ ] 完善故障排查文档
- **参考文件**:
  - 现有部署文档: 项目中的部署相关文档

## 5. 测试待办事项

### 5.1 完善单元测试
- **状态**: 待完善
- **优先级**: 中
- **预计工作量**: 5-7天
- **详细任务**:
  - [ ] 为所有Service方法编写单元测试
  - [ ] 提高测试覆盖率到80%以上
  - [ ] 完善测试用例
  - [ ] 完善Mock数据
- **参考文件**:
  - 现有测试文件: `libs/forum/test/` 目录下所有测试文件

### 5.2 完善集成测试
- **状态**: 待完善
- **优先级**: 中
- **预计工作量**: 5-7天
- **详细任务**:
  - [ ] 为所有API接口编写集成测试
  - [ ] 完善测试场景
  - [ ] 完善测试数据准备
  - [ ] 完善测试清理逻辑
- **参考文件**:
  - 现有测试文件: `libs/forum/test/` 目录下所有测试文件

### 5.3 完善性能测试
- **状态**: 待完善
- **优先级**: 低
- **预计工作量**: 3-4天
- **详细任务**:
  - [ ] 编写性能测试用例
  - [ ] 进行压力测试
  - [ ] 进行负载测试
  - [ ] 优化性能瓶颈
- **参考工具**:
  - JMeter
  - K6
  - Artillery

## 6. 配置待办事项

### 6.1 环境配置
- **状态**: 待配置
- **优先级**: 高
- **预计工作量**: 1天
- **详细任务**:
  - [ ] 检查 `.env` 文件配置
  - [ ] 检查数据库连接配置
  - [ ] 检查Redis连接配置
  - [ ] 检查其他第三方服务配置
- **参考文件**:
  - 环境配置文件: `.env.example`
  - 环境配置文件: `.env`

### 6.2 CI/CD配置
- **状态**: 待配置
- **优先级**: 中
- **预计工作量**: 2-3天
- **详细任务**:
  - [ ] 配置GitHub Actions
  - [ ] 配置自动测试
  - [ ] 配置自动部署
  - [ ] 配置代码质量检查
- **参考文件**:
  - CI/CD配置文件: `.github/workflows/` 目录下所有配置文件

### 6.3 监控配置
- **状态**: 待配置
- **优先级**: 低
- **预计工作量**: 2-3天
- **详细任务**:
  - [ ] 配置应用监控
  - [ ] 配置数据库监控
  - [ ] 配置错误监控
  - [ ] 配置性能监控
- **参考工具**:
  - Prometheus
  - Grafana
  - Sentry

## 7. 其他待办事项

### 7.1 代码审查
- **状态**: 待进行
- **优先级**: 中
- **预计工作量**: 2-3天
- **详细任务**:
  - [ ] 审查所有Service代码
  - [ ] 审查所有Controller代码
  - [ ] 审查所有DTO代码
  - [ ] 提出改进建议
- **参考文件**:
  - 所有代码文件: `libs/forum/src/` 目录下所有代码文件

### 7.2 重构优化
- **状态**: 待规划
- **优先级**: 低
- **预计工作量**: 5-7天
- **详细任务**:
  - [ ] 识别需要重构的代码
  - [ ] 制定重构计划
  - [ ] 执行重构
  - [ ] 测试重构后的代码
- **参考文件**:
  - 所有代码文件: `libs/forum/src/` 目录下所有代码文件

### 7.3 技术债务清理
- **状态**: 待清理
- **优先级**: 低
- **预计工作量**: 3-5天
- **详细任务**:
  - [ ] 识别技术债务
  - [ ] 制定清理计划
  - [ ] 执行清理
  - [ ] 测试清理后的代码
- **参考文件**:
  - 所有代码文件: `libs/forum/src/` 目录下所有代码文件

## 8. 操作指引

### 8.1 如何开始实现主题收藏功能
1. 查看 `prisma/models/forum/forum-topic-favorite.prisma` 了解数据表结构
2. 参考 `libs/forum/src/topic-like/forum-topic-like.service.ts` 了解类似功能的实现
3. 创建 `libs/forum/src/topic-favorite/forum-topic-favorite.service.ts`
4. 实现所有必要的方法
5. 创建对应的Controller和DTO
6. 编写单元测试和集成测试
7. 运行测试确保功能正常

### 8.2 如何开始实现审计日志功能
1. 查看 `prisma/models/forum/forum-audit-log.prisma` 了解数据表结构
2. 创建 `libs/forum/src/audit-log/forum-audit-log.service.ts`
3. 实现所有必要的方法
4. 在关键操作中集成日志记录
5. 创建对应的Controller和DTO
6. 编写单元测试和集成测试
7. 运行测试确保功能正常

### 8.3 如何开始实现徽章管理功能
1. 查看 `prisma/models/forum/forum-badge.prisma` 和 `prisma/models/forum/forum-profile-badge.prisma` 了解数据表结构
2. 参考 `libs/forum/src/level-rule/level-rule.service.ts` 了解类似功能的实现
3. 创建 `libs/forum/src/badge/forum-badge.service.ts`
4. 实现所有必要的方法
5. 实现徽章自动颁发逻辑
6. 创建对应的Controller和DTO
7. 编写单元测试和集成测试
8. 运行测试确保功能正常

### 8.4 如何检查和优化数据表索引
1. 查看 `prisma/models/forum/` 目录下对应的Prisma文件
2. 检查是否存在必要的索引
3. 如缺少则添加相应索引
4. 运行 `npx prisma migrate dev` 生成迁移脚本
5. 运行 `npx prisma migrate deploy` 应用迁移
6. 测试索引优化效果

### 8.5 如何完善错误处理机制
1. 审查所有Service方法的错误处理
2. 统一错误码和错误消息
3. 实现错误日志记录
4. 为缺少错误处理的方法添加错误处理
5. 编写错误处理测试用例
6. 运行测试确保错误处理正常

### 8.6 如何完善事务管理
1. 审查所有涉及多表操作的方法
2. 为缺少事务管理的方法添加事务管理
3. 测试事务回滚功能
4. 编写事务管理测试用例
5. 运行测试确保事务管理正常

## 9. 注意事项

### 9.1 开发注意事项
1. 遵循项目现有的代码规范和架构模式
2. 使用项目现有的工具和库
3. 复用项目现有的组件
4. 保持代码风格一致
5. 编写完整的注释
6. 编写完整的测试

### 9.2 测试注意事项
1. 确保测试覆盖率不低于80%
2. 确保所有测试用例都能通过
3. 确保测试用例覆盖所有边界情况
4. 确保测试用例覆盖所有异常情况

### 9.3 部署注意事项
1. 确保所有配置文件都已正确配置
2. 确保所有依赖都已正确安装
3. 确保所有环境变量都已正确设置
4. 确保所有数据库迁移都已正确执行
5. 确保所有测试都已通过

### 9.4 文档注意事项
1. 确保文档完整、准确、一致
2. 确保文档易于理解和使用
3. 确保文档与代码保持同步
4. 确保文档及时更新

## 10. 联系方式

如有任何问题或需要帮助，请联系项目团队。
