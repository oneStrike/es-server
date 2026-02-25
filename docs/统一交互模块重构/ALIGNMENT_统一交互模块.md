# 对齐文档：统一交互模块重构

## 一、原始需求

将项目中的点赞、收藏、浏览记录、评论、下载等用户交互功能抽离成公共模块，包括数据表和服务层的统一。

## 二、项目上下文分析

### 2.1 现有交互功能

| 功能 | 数据表 | 服务位置 | 目标类型 |
|------|--------|----------|----------|
| 点赞 | work_like, work_chapter_like, forum_topic_like | WorkService, ForumTopicLikeService | 作品、章节、论坛主题 |
| 收藏 | work_favorite, forum_topic_favorite | WorkService, ForumTopicFavoriteService | 作品、论坛主题 |
| 浏览记录 | forum_view | ForumViewService | 论坛主题（支持删除） |
| 评论 | work_comment, forum_reply | WorkCommentService, ForumReplyService | **漫画、漫画章节、小说、小说章节、论坛** |
| 下载 | work_chapter_download | WorkChapterService | 章节 |

### 2.2 现有公共抽象

- `BaseService` - 服务基类，提供 Prisma 客户端访问
- `ForumCounterService` - 论坛计数服务
- `ForumUserActionLogService` - 操作日志服务
- `UserGrowthEventService` - 用户成长事件服务

### 2.3 技术栈

- NestJS + TypeScript
- Prisma ORM
- PostgreSQL

## 三、需求理解

### 3.1 核心目标

1. **数据表统一**：将分散的交互表合并为统一表
2. **服务层抽象**：提供泛型基类，支持不同目标类型的交互操作
3. **减少代码重复**：提高代码复用率和可维护性

### 3.2 统一后的表结构

| 统一表名 | 合并的旧表 | 说明 |
|----------|-----------|------|
| user_like | work_like, work_chapter_like, forum_topic_like | 统一点赞表 |
| user_favorite | work_favorite, forum_topic_favorite | 统一收藏表 |
| user_view | forum_view | 统一浏览记录表（支持删除） |
| user_comment | work_comment, forum_reply | 统一评论表（支持漫画、漫画章节、小说、小说章节、论坛） |
| user_comment_like | (新增) | 评论点赞表 |
| user_comment_report | work_comment_report | 评论举报表 |
| user_download | work_chapter_download | 统一下载表 |

### 3.3 目标类型枚举

```typescript
/**
 * 交互目标类型枚举
 * 使用数字类型，便于数据库存储和索引优化
 */
export enum InteractionTargetType {
  /** 漫画 - 漫画作品 */
  COMIC = 1,
  /** 小说 - 小说作品 */
  NOVEL = 2,
  /** 漫画章节 - 漫画作品的章节 */
  COMIC_CHAPTER = 3,
  /** 小说章节 - 小说作品的章节 */
  NOVEL_CHAPTER = 4,
  /** 论坛主题 - 论坛板块中的帖子 */
  FORUM_TOPIC = 5,
  // 注意：论坛回复不再作为独立目标类型，而是存储在 user_comment 表中
  // 评论点赞使用独立的 user_comment_like 表
}
```

**重要说明：**
- 作品类型必须明确区分漫画（COMIC）和小说（NOVEL），不能使用通用的"作品"类型
- 章节类型同样需要区分漫画章节和小说章节
- 使用数字枚举便于数据库存储和索引优化

## 四、技术决策

### 4.1 外键约束处理

**决策：应用层校验**

统一表后无法使用外键约束关联目标，采用以下策略保证数据一致性：

1. **创建时校验**：在服务层校验目标是否存在
2. **删除时清理**：目标删除时通过事件机制清理关联数据
3. **定期清理**：定时任务清理孤儿数据

### 4.2 数据迁移策略

**决策：一次性迁移**

不需要向后兼容，采用停机维护方式一次性完成数据迁移：

1. 创建新的统一表
2. 编写迁移脚本，将旧表数据迁移到新表
3. 删除旧表
4. 更新服务层代码

### 4.3 扩展字段处理

**决策：拆分为具体字段**

不使用 JSON 类型的 metadata 字段，而是根据业务需求拆分为具体的数据库字段：

**浏览记录表 (user_view):**
```typescript
ipAddress    String?   // IP 地址
device       String?   // 设备信息
userAgent    String?   // 用户代理
// 不记录浏览时长
```

**下载记录表 (user_download):**
```typescript
chapterId    Int       // 所属章节 ID
targetType   Int       // 目标类型（区分漫画章节/小说章节）
workId       Int       // 所属作品 ID
workType     Int       // 作品类型（区分漫画/小说）
```

**收藏表 (user_favorite):**
```typescript
workType     Int?      // 作品类型（仅作品收藏时有值）
```

## 五、边界确认

### 5.1 包含范围

- ✅ 点赞功能统一
- ✅ 收藏功能统一
- ✅ 浏览记录统一（支持删除）
- ✅ 评论功能统一（**支持漫画、漫画章节、小说、小说章节、论坛**）
- ✅ 下载功能统一
- ✅ 评论点赞功能
- ✅ 评论举报功能
- ✅ 计数服务统一
- ✅ 操作日志统一

### 5.2 不包含范围

- ❌ 用户成长事件系统重构
- ❌ 敏感词检测系统重构
- ❌ 权限系统重构
- ❌ 向后兼容（包括 DTO、Controller 等，完全不需要向后兼容）

### 5.3 影响范围

| 模块 | 影响程度 | 说明 |
|------|----------|------|
| libs/content | 高 | 作品相关交互逻辑需重构 |
| libs/forum | 高 | 论坛相关交互逻辑需重构 |
| libs/user | 中 | 成长事件触发方式需调整 |
| prisma/models | 高 | 数据模型需重构 |

## 六、疑问澄清

### 6.1 已确认

1. **是否需要向后兼容**：不需要，可以一次性迁移，包括 DTO、Controller 等
2. **外键约束处理**：应用层校验
3. **下载功能是否纳入**：是，统一抽离
4. **作品类型处理**：必须区分漫画（COMIC）和小说（NOVEL），不能使用通用"作品"类型
5. **枚举类型**：使用数字枚举，添加详细注释
6. **扩展字段**：拆分为具体字段，不使用 JSON 类型的 metadata
7. **浏览记录**：不需要记录浏览时长，**支持用户删除浏览记录**
8. **数据库注释**：所有字段添加详细注释
9. **评论功能支持范围**：评论和回复需要包含漫画、漫画章节、小说、小说章节、论坛

### 6.2 待确认

无

## 七、验收标准

### 7.1 功能验收

- [ ] 所有交互功能正常工作
- [ ] 计数统计准确
- [ ] 操作日志正确记录
- [ ] 成长事件正确触发

### 7.2 技术验收

- [ ] 数据迁移完整无丢失
- [ ] 服务层代码复用率 > 70%
- [ ] 单元测试覆盖核心逻辑
- [ ] 无孤儿数据

### 7.3 性能验收

- [ ] 查询性能不低于原有实现
- [ ] 索引设计合理

## 八、风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 数据迁移丢失 | 高 | 迁移前备份，迁移后校验 |
| 外键约束缺失导致数据不一致 | 中 | 应用层严格校验 + 定期清理 |
| 性能下降 | 中 | 合理设计索引，监控慢查询 |
| 业务逻辑遗漏 | 中 | 详细测试用例，逐步迁移 |

## 九、下一步

进入 Architect 阶段，设计：
1. 统一数据模型
2. 服务层架构
3. 迁移脚本
4. 事件机制
