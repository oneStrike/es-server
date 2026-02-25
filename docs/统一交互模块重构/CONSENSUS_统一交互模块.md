# 共识文档：统一交互模块重构

## 一、需求描述

将项目中分散的用户交互功能（点赞、收藏、浏览记录、评论、下载）抽离成统一的公共模块，包括数据表和服务层的重构。

**重要说明：**

- 完全不需要向后兼容，包括 DTO、Controller 等
- targetType 使用数字枚举，需有明确注释
- 数据库注释尽可能详细
- **作品必须区分漫画和小说，不能作为单独类型**
- **评论功能支持范围：漫画、漫画章节、小说、小说章节、论坛**
- **点赞功能支持范围：漫画、漫画章节、小说、小说章节、论坛主题、评论（评论点赞使用独立表）**
- **浏览记录支持范围：漫画、漫画章节、小说、小说章节、论坛主题（新增作品/章节浏览记录功能，扩展原有仅论坛浏览记录的功能）**
- **下载功能支持范围：漫画、漫画章节、小说、小说章节**
- **浏览记录支持用户删除**

## 二、数据模型设计

### 2.1 枚举定义

```typescript
/**
 * 交互目标类型枚举
 * 用于标识用户交互操作的目标对象类型
 *
 * 注意：作品类型必须区分漫画和小说，不能使用通用的"作品"类型
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
}

/**
 * 交互操作类型枚举
 * 用于标识用户对目标执行的操作类型
 */
export enum InteractionActionType {
  /** 点赞 - 用户对目标表示认可 */
  LIKE = 1,
  /** 取消点赞 - 用户撤回点赞操作 */
  UNLIKE = 2,
  /** 收藏 - 用户将目标加入收藏夹 */
  FAVORITE = 3,
  /** 取消收藏 - 用户从收藏夹移除目标 */
  UNFAVORITE = 4,
  /** 浏览 - 用户查看目标内容 */
  VIEW = 5,
  /** 删除浏览记录 - 用户删除自己的浏览记录 */
  DELETE_VIEW = 6,
  /** 评论 - 用户对目标发表评论 */
  COMMENT = 7,
  /** 删除评论 - 用户删除自己的评论 */
  DELETE_COMMENT = 8,
  /** 下载 - 用户下载目标内容 */
  DOWNLOAD = 9,
  // 注：当前不支持删除下载记录功能，如需支持可添加 DELETE_DOWNLOAD = 10
}

/**
 * 审核状态枚举
 * 用于评论等内容的审核流程状态
 */
export enum AuditStatus {
  /** 待审核 - 内容已提交，等待审核 */
  PENDING = 0,
  /** 已通过 - 审核通过，内容可见 */
  APPROVED = 1,
  /** 已拒绝 - 审核拒绝，内容不可见 */
  REJECTED = 2,
}

/**
 * 审核角色枚举
 * 用于标识执行审核操作的角色类型
 */
export enum AuditRole {
  /** 版主 - 论坛版块管理员 */
  MODERATOR = 0,
  /** 管理员 - 系统管理员 */
  ADMIN = 1,
}

/**
 * 举报状态枚举
 * 用于举报记录的处理状态
 */
export enum ReportStatus {
  /** 待处理 - 举报已提交，等待处理 */
  PENDING = 0,
  /** 处理中 - 举报正在处理 */
  PROCESSING = 1,
  /** 已解决 - 举报已处理完成 */
  RESOLVED = 2,
  /** 已拒绝 - 举报被驳回 */
  REJECTED = 3,
}

/**
 * 目标类型分类
 * 用于判断目标类型的归属分类
 *
 * 注意：此枚举使用字符串值，用于业务逻辑分类，不涉及数据库存储
 * 与 InteractionTargetType（数字枚举）的用途不同
 */
export enum TargetTypeCategory {
  /** 漫画类 - 漫画及其章节 */
  COMIC = 'comic',
  /** 小说类 - 小说及其章节 */
  NOVEL = 'novel',
  /** 论坛类 - 论坛主题 */
  FORUM = 'forum',
}

/**
 * 获取目标类型的分类
 */
export function getTargetTypeCategory(
  type: InteractionTargetType,
): TargetTypeCategory | null {
  switch (type) {
    case InteractionTargetType.COMIC:
    case InteractionTargetType.COMIC_CHAPTER:
      return TargetTypeCategory.COMIC
    case InteractionTargetType.NOVEL:
    case InteractionTargetType.NOVEL_CHAPTER:
      return TargetTypeCategory.NOVEL
    case InteractionTargetType.FORUM_TOPIC:
      return TargetTypeCategory.FORUM
    default:
      return null
  }
}

/**
 * 判断是否为作品类型（漫画或小说）
 */
export function isWorkType(type: InteractionTargetType): boolean {
  return (
    type === InteractionTargetType.COMIC || type === InteractionTargetType.NOVEL
  )
}

/**
 * 判断是否为章节类型
 */
export function isChapterType(type: InteractionTargetType): boolean {
  return (
    type === InteractionTargetType.COMIC_CHAPTER ||
    type === InteractionTargetType.NOVEL_CHAPTER
  )
}

/**
 * 获取章节类型对应的作品类型
 */
export function getWorkTypeByChapter(
  type: InteractionTargetType,
): InteractionTargetType | null {
  switch (type) {
    case InteractionTargetType.COMIC_CHAPTER:
      return InteractionTargetType.COMIC
    case InteractionTargetType.NOVEL_CHAPTER:
      return InteractionTargetType.NOVEL
    default:
      return null
  }
}
```

### 2.2 统一点赞表 (user_like)

```prisma
/// 用户点赞记录表
/// 记录用户对各类目标（漫画、小说、章节、论坛主题）的点赞操作
/// 支持点赞计数统计和用户点赞状态查询
/// 注意：评论点赞使用独立的 user_comment_like 表
model UserLike {
  /// 主键ID（自增）
  id Int @id @default(autoincrement())

  /// 目标类型
  /// 1=漫画, 2=小说, 3=漫画章节, 4=小说章节, 5=论坛主题
  /// 用于区分点赞对象的具体类型，便于多态查询和统计
  /// 注意：作品必须区分漫画(1)和小说(2)，不能使用通用类型
  targetType Int @map("target_type") @db.SmallInt

  /// 目标ID
  /// 关联的具体目标记录ID
  /// - targetType=1/2 时：work.id
  /// - targetType=3/4 时：work_chapter.id
  /// - targetType=5 时：forum_topic.id
  /// 注意：不使用外键约束，由应用层保证数据一致性
  targetId Int @map("target_id")

  /// 用户ID（关联 app_user.id）
  /// 执行点赞操作的用户
  userId Int @map("user_id")

  /// 创建时间（点赞时间）
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  /// 关联用户
  user AppUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  /// 唯一约束：同一用户对同一目标只能点赞一次
  /// 组合索引确保数据唯一性
  @@unique([targetType, targetId, userId])
  /// 目标类型与目标ID联合索引，用于查询某目标的点赞列表
  @@index([targetType, targetId])
  /// 用户ID索引，用于查询某用户的点赞记录
  @@index([userId])
  /// 创建时间索引，用于按时间排序查询
  @@index([createdAt])
  /// 表名映射
  @@map("user_like")
}
```

### 2.3 统一收藏表 (user_favorite)

```prisma
/// 用户收藏记录表
/// 记录用户对各类目标（漫画、小说、论坛主题）的收藏操作
/// 支持收藏计数统计和用户收藏列表查询
model UserFavorite {
  /// 主键ID（自增）
  id Int @id @default(autoincrement())

  /// 目标类型
  /// 1=漫画, 2=小说, 5=论坛主题
  /// 注意：作品必须区分漫画(1)和小说(2)，不能使用通用类型
  targetType Int @map("target_type") @db.SmallInt

  /// 目标ID
  /// 关联的具体目标记录ID
  /// - targetType=1/2 时：work.id
  /// - targetType=5 时：forum_topic.id
  targetId Int @map("target_id")

  /// 用户ID（关联 app_user.id）
  /// 执行收藏操作的用户
  userId Int @map("user_id")

  /// 创建时间（收藏时间）
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  /// 关联用户
  user AppUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  /// 唯一约束：同一用户对同一目标只能收藏一次
  @@unique([targetType, targetId, userId])
  /// 目标类型与目标ID联合索引
  @@index([targetType, targetId])
  /// 用户ID索引
  @@index([userId])
  /// 创建时间索引
  @@index([createdAt])
  /// 表名映射
  @@map("user_favorite")
}
```

### 2.4 统一浏览记录表 (user_view)

```prisma
/// 用户浏览记录表
/// 记录用户对各类目标（漫画、小说、章节、论坛主题）的浏览行为
/// 用于浏览历史查询、热度统计、推荐算法等
/// 支持用户删除浏览记录
model UserView {
  /// 主键ID（自增）
  id Int @id @default(autoincrement())

  /// 目标类型
  /// 1=漫画, 2=小说, 3=漫画章节, 4=小说章节, 5=论坛主题
  /// 注意：作品必须区分漫画(1)和小说(2)，不能使用通用类型
  targetType Int @map("target_type") @db.SmallInt

  /// 目标ID
  /// 关联的具体目标记录ID
  /// - targetType=1/2 时：work.id
  /// - targetType=3/4 时：work_chapter.id
  /// - targetType=5 时：forum_topic.id
  targetId Int @map("target_id")

  /// 用户ID（关联 app_user.id）
  /// 执行浏览操作的用户
  userId Int @map("user_id")

  /// IP地址
  /// 用户浏览时的IP地址，用于地域统计、风控等
  ipAddress String? @map("ip_address") @db.VarChar(45)

  /// 设备类型
  /// 用户使用的设备类型，如：mobile、desktop、tablet
  /// 用于设备统计和适配分析
  device String? @db.VarChar(20)

  /// 用户代理
  /// 浏览器User-Agent字符串，用于详细的设备和浏览器分析
  userAgent String? @map("user_agent") @db.VarChar(500)

  /// 浏览时间
  viewedAt DateTime @default(now()) @map("viewed_at") @db.Timestamptz(6)

  /// 关联用户
  user AppUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  /// 目标类型与目标ID联合索引，用于查询某目标的浏览记录
  @@index([targetType, targetId])
  /// 用户ID索引，用于查询某用户的浏览历史
  @@index([userId])
  /// 浏览时间索引，用于按时间排序和清理过期数据
  @@index([viewedAt])
  /// 目标与用户联合索引，用于查询某用户对某目标的浏览记录
  @@index([targetType, targetId, userId])
  /// 用户与浏览时间联合索引，用于查询用户浏览历史并按时间排序
  @@index([userId, viewedAt])
  /// 表名映射
  @@map("user_view")
}
```

### 2.5 统一评论表 (user_comment)

**重要说明：** 评论功能支持漫画、漫画章节、小说、小说章节、论坛五种目标类型。

```prisma
/// 用户评论表
/// 统一存储漫画评论、漫画章节评论、小说评论、小说章节评论、论坛回复等所有评论内容
/// 支持楼中楼回复、审核流程、敏感词检测等功能
model UserComment {
  /// 主键ID（自增）
  id Int @id @default(autoincrement())

  /// 目标类型
  /// 1=漫画, 2=小说, 3=漫画章节, 4=小说章节, 5=论坛主题
  /// 注意：作品必须区分漫画(1)和小说(2)，不能使用通用类型
  /// 评论支持：漫画、漫画章节、小说、小说章节、论坛
  targetType Int @map("target_type") @db.SmallInt

  /// 目标ID
  /// 评论所属的目标ID
  /// - targetType=1 时：work.id (漫画)
  /// - targetType=2 时：work.id (小说)
  /// - targetType=3 时：work_chapter.id (漫画章节)
  /// - targetType=4 时：work_chapter.id (小说章节)
  /// - targetType=5 时：forum_topic.id (论坛主题)
  targetId Int @map("target_id")

  /// 用户ID（关联 app_user.id）
  /// 发表评论的用户
  userId Int @map("user_id")

  /// 评论内容
  /// 用户发表的评论文本，支持富文本格式
  content String @db.Text

  /// 楼层号
  /// 一级评论的楼层编号，从1开始递增
  /// 楼中楼回复此字段为null
  floor Int? @map("floor")

  /// 回复的评论ID（楼中楼）
  /// 直接回复的评论ID，用于构建回复关系
  replyToId Int? @map("reply_to_id")

  /// 实际回复的根评论ID
  /// 一级评论的ID，用于快速定位楼中楼所属的一级评论
  /// 当 replyToId 指向楼中楼时，此字段指向该楼中楼的根评论
  actualReplyToId Int? @map("actual_reply_to_id")

  /// 是否隐藏
  /// 管理员可设置隐藏评论，隐藏后前端不展示
  isHidden Boolean @default(false) @map("is_hidden")

  /// 审核状态（0=待审核, 1=已通过, 2=已拒绝）
  /// 配合敏感词检测系统自动设置
  auditStatus Int @default(0) @map("audit_status") @db.SmallInt

  /// 审核原因
  /// 审核拒绝时的原因说明
  auditReason String? @map("audit_reason") @db.VarChar(500)

  /// 审核时间
  /// 执行审核操作的时间
  auditAt DateTime? @map("audit_at") @db.Timestamptz(6)

  /// 审核人ID（关联 app_user.id）
  /// 执行审核操作的用户ID
  auditById Int? @map("audit_by_id")

  /// 审核人角色（0=版主, 1=管理员）
  /// 标识审核人的角色类型
  auditRole Int? @map("audit_role") @db.SmallInt

  /// 点赞数
  /// 该评论被点赞的次数，用于热度排序
  likeCount Int @default(0) @map("like_count")

  /// 敏感词命中记录
  /// JSON格式存储命中的敏感词详情，包含词名、等级、位置等
  /// 用于审核参考和追溯
  /// 注：此字段为例外情况，因敏感词命中记录结构复杂且会变，使用JSONB存储
  sensitiveWordHits Json? @map("sensitive_word_hits") @db.JsonB

  /// 创建时间
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  /// 更新时间
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  /// 软删除时间
  /// 用户或管理员删除评论时设置此字段，非物理删除
  deletedAt DateTime? @map("deleted_at") @db.Timestamptz(6)

  /// 关联用户
  user AppUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  /// 回复的评论
  replyTo UserComment? @relation("CommentReply", fields: [replyToId], references: [id], onDelete: SetNull)
  /// 该评论的回复列表
  replies UserComment[] @relation("CommentReply")

  /// 实际回复的根评论
  actualReplyTo UserComment? @relation("CommentActualReply", fields: [actualReplyToId], references: [id], onDelete: SetNull)
  /// 以此评论为根评论的楼中楼列表
  actualReplies UserComment[] @relation("CommentActualReply")

  /// 评论点赞列表
  likes UserCommentLike[]

  /// 评论举报列表
  reports UserCommentReport[]

  /// 目标类型与目标ID联合索引，用于查询某目标的评论列表
  /// 注：PostgreSQL 复合索引 (a,b,c) 支持 (a,b) 前缀查询，故不单独创建冗余索引
  @@index([targetType, targetId, createdAt])
  /// 用户ID索引，用于查询某用户的评论记录
  @@index([userId])
  /// 创建时间索引，用于按时间排序
  @@index([createdAt])
  /// 审核状态索引，用于筛选待审核评论
  @@index([auditStatus])
  /// 隐藏状态索引，用于筛选隐藏评论
  @@index([isHidden])
  /// 回复目标索引，用于查询某评论的回复
  @@index([replyToId])
  /// 根回复索引，用于查询某一级评论下的所有楼中楼
  @@index([actualReplyToId])
  /// 删除时间索引，用于筛选已删除评论
  @@index([deletedAt])
  /// 表名映射
  @@map("user_comment")
}
```

### 2.6 评论点赞表 (user_comment_like)

```prisma
/// 评论点赞记录表
/// 记录用户对评论的点赞操作
/// 支持评论点赞计数和用户点赞状态查询
model UserCommentLike {
  /// 主键ID（自增）
  id Int @id @default(autoincrement())

  /// 评论ID（关联 user_comment.id）
  /// 被点赞的评论
  commentId Int @map("comment_id")

  /// 用户ID（关联 app_user.id）
  /// 执行点赞操作的用户
  userId Int @map("user_id")

  /// 创建时间（点赞时间）
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  /// 关联评论
  comment UserComment @relation(fields: [commentId], references: [id], onDelete: Cascade)

  /// 关联用户
  user AppUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  /// 唯一约束：同一用户对同一评论只能点赞一次
  @@unique([commentId, userId])
  /// 评论ID索引，用于查询某评论的点赞列表
  @@index([commentId])
  /// 用户ID索引，用于查询某用户的点赞记录
  @@index([userId])
  /// 表名映射
  @@map("user_comment_like")
}
```

### 2.7 评论举报表 (user_comment_report)

```prisma
/// 评论举报记录表
/// 记录用户对违规评论的举报信息
/// 支持举报处理流程和举报统计
model UserCommentReport {
  /// 主键ID（自增）
  id Int @id @default(autoincrement())

  /// 举报人ID（关联 app_user.id）
  /// 发起举报的用户
  reporterId Int @map("reporter_id")

  /// 处理人ID（关联 app_user.id）
  /// 处理举报的管理员，未处理时为null
  handlerId Int? @map("handler_id")

  /// 被举报评论ID（关联 user_comment.id）
  /// 被举报的评论
  commentId Int @map("comment_id")

  /// 举报原因
  /// 预定义的举报原因类型，如：spam（垃圾信息）、harassment（骚扰）、inappropriate（不当内容）等
  reason String @db.VarChar(50)

  /// 举报说明
  /// 用户填写的详细举报说明
  description String? @db.VarChar(500)

  /// 证据截图URL
  /// 用户上传的证据图片链接
  evidenceUrl String? @map("evidence_url") @db.VarChar(500)

  /// 处理状态（pending=待处理, processing=处理中, resolved=已解决, rejected=已拒绝）
  /// 标识举报的处理进度
  status String @default("pending") @db.VarChar(20)

  /// 处理备注
  /// 管理员处理时填写的备注信息
  handlingNote String? @map("handling_note") @db.VarChar(500)

  /// 处理时间
  /// 举报被处理的时间
  handledAt DateTime? @map("handled_at") @db.Timestamptz(6)

  /// 创建时间（举报时间）
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  /// 更新时间
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  /// 关联举报人
  reporter AppUser @relation("ReportReporter", fields: [reporterId], references: [id], onDelete: Cascade)

  /// 关联处理人
  handler AppUser? @relation("ReportHandler", fields: [handlerId], references: [id])

  /// 关联评论
  comment UserComment @relation(fields: [commentId], references: [id], onDelete: Cascade)

  /// 评论ID索引，用于查询某评论的举报记录
  @@index([commentId])
  /// 举报人ID索引，用于查询某用户的举报记录
  @@index([reporterId])
  /// 处理状态索引，用于筛选待处理举报
  @@index([status])
  /// 创建时间索引，用于按时间排序
  @@index([createdAt])
  /// 表名映射
  @@map("user_comment_report")
}
```

### 2.8 统一下载表 (user_download)

```prisma
/// 用户下载记录表
/// 记录用户对作品、章节等内容的下载操作
/// 支持下载计数统计和用户下载历史查询
model UserDownload {
  /// 主键ID（自增）
  id Int @id @default(autoincrement())

  /// 目标类型
  /// 1=漫画, 2=小说, 3=漫画章节, 4=小说章节
  /// 注意：章节必须区分漫画章节(3)和小说章节(4)，不能使用通用类型
  /// 作品必须区分漫画(1)和小说(2)，不能使用通用类型
  targetType Int @map("target_type") @db.SmallInt

  /// 目标ID
  /// 下载的具体目标ID
  /// - targetType=1/2 时：work.id（作品下载）
  /// - targetType=3/4 时：work_chapter.id（章节下载）
  targetId Int @map("target_id")

  /// 用户ID（关联 app_user.id）
  /// 执行下载操作的用户
  userId Int @map("user_id")

  /// 作品ID
  /// 下载内容所属的作品ID，便于按作品查询下载记录
  /// targetType=1/2 时与 targetId 相同
  /// targetType=3/4 时为章节所属作品ID
  workId Int @map("work_id")

  /// 作品类型
  /// 1=漫画, 2=小说
  /// 下载内容所属的作品类型
  workType Int @map("work_type") @db.SmallInt

  /// 创建时间（下载时间）
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  /// 关联用户
  user AppUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  /// 唯一约束：同一用户对同一目标只能下载一次（记录层面）
  @@unique([targetType, targetId, userId])
  /// 目标类型与目标ID联合索引
  @@index([targetType, targetId])
  /// 用户ID索引
  @@index([userId])
  /// 作品ID索引，用于查询某作品的下载记录
  @@index([workId])
  /// 作品类型索引
  @@index([workType])
  /// 创建时间索引
  @@index([createdAt])
  /// 表名映射
  @@map("user_download")
}
```

## 三、表数量变化

| 当前 (12张表)         | 重构后 (7张表)      | 变化                                       |
| --------------------- | ------------------- | ------------------------------------------ |
| work_like             | user_like           | 合并                                       |
| work_chapter_like     | user_like           | 合并                                       |
| forum_topic_like      | user_like           | 合并                                       |
| forum_reply_like      | user_comment_like   | 合并（评论点赞）                           |
| work_favorite         | user_favorite       | 合并                                       |
| forum_topic_favorite  | user_favorite       | 合并                                       |
| forum_view            | user_view           | 合并（扩展支持作品/章节浏览）              |
| work_comment          | user_comment        | 合并                                       |
| forum_reply           | user_comment        | 合并                                       |
| work_comment_report   | user_comment_report | 保留                                       |
| work_chapter_download | user_download       | 合并（扩展支持作品下载）                   |
| (新增)                | user_comment_like   | 新增（用于所有评论点赞，包括论坛回复点赞） |

## 四、目标类型映射关系

### 4.1 新旧类型映射

| 旧表                                 | 旧字段     | 新 targetType                     | 说明                           |
| ------------------------------------ | ---------- | --------------------------------- | ------------------------------ |
| work_like (type=1)                   | work_id    | 1 (COMIC)                         | 漫画点赞                       |
| work_like (type=2)                   | work_id    | 2 (NOVEL)                         | 小说点赞                       |
| work_chapter_like                    | chapter_id | 3/4 (COMIC_CHAPTER/NOVEL_CHAPTER) | 章节点赞，根据作品类型区分     |
| forum_topic_like                     | topic_id   | 5 (FORUM_TOPIC)                   | 论坛主题点赞                   |
| forum_reply_like                     | reply_id   | user_comment_like                 | 论坛回复点赞（使用评论点赞表） |
| work_favorite (type=1)               | work_id    | 1 (COMIC)                         | 漫画收藏                       |
| work_favorite (type=2)               | work_id    | 2 (NOVEL)                         | 小说收藏                       |
| forum_topic_favorite                 | topic_id   | 5 (FORUM_TOPIC)                   | 论坛主题收藏                   |
| work_comment (work_id, 无chapter_id) | work_id    | 1/2 (COMIC/NOVEL)                 | 作品评论，根据作品类型区分     |
| work_comment (chapter_id)            | chapter_id | 3/4 (COMIC_CHAPTER/NOVEL_CHAPTER) | 章节评论                       |
| forum_reply                          | topic_id   | 5 (FORUM_TOPIC)                   | 论坛回复（作为评论）           |
| work_chapter_download                | chapter_id | 3/4 (COMIC_CHAPTER/NOVEL_CHAPTER) | 章节下载（新增支持作品下载）   |

### 4.2 评论功能目标类型说明

评论功能支持以下五种目标类型：

- **COMIC (1)**: 漫画作品评论
- **NOVEL (2)**: 小说作品评论
- **COMIC_CHAPTER (3)**: 漫画章节评论
- **NOVEL_CHAPTER (4)**: 小说章节评论
- **FORUM_TOPIC (5)**: 论坛主题回复

### 4.3 数据迁移

使用项目统一的 Prisma 迁移命令：

```bash
# 更新数据库结构（包含迁移和种子数据）
pnpm prisma:update

# 仅重置数据库（清空数据并重新填充种子数据）
pnpm prisma:reset
```

**迁移注意事项：**
- 迁移前请确保备份数据库
- 迁移脚本会自动将旧表数据迁移到新表
- 作品和章节的浏览记录为新增功能，无需迁移旧数据
- 作品下载为新增功能，无需迁移旧数据

## 五、服务层架构

### 5.1 模块结构

遵循项目现有的 libs 模块结构规范（参考 `libs/forum`、`libs/content`、`libs/user`），每个功能子模块独立目录，内部包含 `dto/`、`*.module.ts`、`*.service.ts`、`*.constant.ts`、`index.ts`。

**设计原则：**
- 不使用 `common/` 目录，公共组件扁平化放置
- 每个子模块职责单一，边界清晰
- 参考 `libs/forum` 的 `reply/` 和 `reply-like/` 分离模式

```
libs/interaction/
├── src/
│   │
│   ├── like/                           # 点赞模块
│   │   ├── dto/
│   │   │   ├── like.dto.ts
│   │   │   └── index.ts
│   │   ├── like.constant.ts
│   │   ├── like.module.ts
│   │   ├── like.service.ts
│   │   └── index.ts
│   │
│   ├── favorite/                       # 收藏模块
│   │   ├── dto/
│   │   │   ├── favorite.dto.ts
│   │   │   └── index.ts
│   │   ├── favorite.constant.ts
│   │   ├── favorite.module.ts
│   │   ├── favorite.service.ts
│   │   └── index.ts
│   │
│   ├── view/                           # 浏览记录模块
│   │   ├── dto/
│   │   │   ├── view.dto.ts
│   │   │   └── index.ts
│   │   ├── view.constant.ts
│   │   ├── view.module.ts
│   │   ├── view.service.ts
│   │   └── index.ts
│   │
│   ├── comment/                        # 评论模块
│   │   ├── dto/
│   │   │   ├── comment.dto.ts
│   │   │   └── index.ts
│   │   ├── comment.constant.ts
│   │   ├── comment.module.ts
│   │   ├── comment.service.ts
│   │   ├── comment.types.ts            # 评论相关类型定义
│   │   └── index.ts
│   │
│   ├── comment-like/                   # 评论点赞模块（独立子模块）
│   │   ├── dto/
│   │   │   ├── comment-like.dto.ts
│   │   │   └── index.ts
│   │   ├── comment-like.module.ts
│   │   ├── comment-like.service.ts
│   │   └── index.ts
│   │
│   ├── comment-report/                 # 评论举报模块（独立子模块）
│   │   ├── dto/
│   │   │   ├── comment-report.dto.ts
│   │   │   └── index.ts
│   │   ├── comment-report.constant.ts
│   │   ├── comment-report.module.ts
│   │   ├── comment-report.service.ts
│   │   └── index.ts
│   │
│   ├── download/                       # 下载模块
│   │   ├── dto/
│   │   │   ├── download.dto.ts
│   │   │   └── index.ts
│   │   ├── download.constant.ts
│   │   ├── download.module.ts
│   │   ├── download.service.ts
│   │   └── index.ts
│   │
│   ├── counter/                        # 计数处理器模块（独立子模块）
│   │   ├── counter-handler.interface.ts
│   │   ├── counter-handler.registry.ts
│   │   ├── work-counter.handler.ts
│   │   ├── chapter-counter.handler.ts
│   │   ├── forum-counter.handler.ts
│   │   ├── counter.module.ts
│   │   └── index.ts
│   │
│   ├── validator/                      # 目标校验器模块（独立子模块）
│   │   ├── target-validator.interface.ts
│   │   ├── target-validator.registry.ts
│   │   ├── comic.validator.ts
│   │   ├── novel.validator.ts
│   │   ├── comic-chapter.validator.ts
│   │   ├── novel-chapter.validator.ts
│   │   ├── forum-topic.validator.ts
│   │   ├── validator.module.ts
│   │   └── index.ts
│   │
│   ├── base-interaction.service.ts     # 交互服务基类（根目录）
│   ├── interaction.constant.ts         # 公共常量（根目录）
│   ├── interaction.types.ts            # 公共类型（根目录）
│   ├── interaction.module.ts           # 主模块（聚合所有子模块）
│   └── index.ts
│
├── tsconfig.lib.json
└── package.json
```

## 六、验收标准

### 6.1 功能验收

- [ ] 点赞/取消点赞功能正常
- [ ] 收藏/取消收藏功能正常
- [ ] 浏览记录记录正常（支持删除）
- [ ] 评论/回复功能正常（支持漫画、漫画章节、小说、小说章节、论坛）
- [ ] 下载记录功能正常
- [ ] 计数统计准确
- [ ] 操作日志正确
- [ ] 成长事件触发正确

### 6.2 数据验收

- [ ] 数据迁移完整
- [ ] 无数据丢失
- [ ] 无孤儿数据

### 6.3 代码验收

- [ ] 服务层代码复用率 > 70%
- [ ] 单元测试覆盖核心逻辑
- [ ] 代码符合项目规范
