# 论坛系统集成 - 最终共识文档

## 1. 需求描述

### 1.1 项目目标
为现有的漫画内容管理系统接入一个独立的论坛社区系统，实现用户交流、内容分享、社区管理等功能，同时确保论坛模块与漫画模块在代码、数据、权限、缓存等方面完全隔离。

### 1.2 核心功能需求

#### 1.2.1 论坛核心功能
1. **版块管理**
   - 创建、编辑、删除版块
   - 版块分类和排序
   - 版块权限设置（发帖权限、回复权限等）
   - 版块统计信息（主题数、回复数、最新动态）

2. **主题/帖子管理**
   - 发布主题（支持富文本、图片上传）
   - 编辑主题
   - 删除主题（软删除）
   - 主题置顶、加精、锁定
   - 主题浏览量统计
   - 主题搜索

3. **回复管理**
   - 回复主题
   - 编辑回复
   - 删除回复（软删除）
   - 回复楼层显示
   - 回复点赞

4. **评论管理**
   - 对回复进行评论
   - 评论点赞
   - 评论删除

5. **点赞功能**
   - 主题点赞
   - 回复点赞
   - 评论点赞
   - 点赞记录查询

6. **搜索功能**
   - 关键词搜索（主题、回复、用户）
   - 标签筛选
   - 版块筛选
   - 时间范围筛选
   - 搜索结果分页

7. **通知系统**
   - 回复通知
   - 点赞通知
   - 系统通知
   - 通知已读/未读状态
   - 通知批量操作

8. **用户激励系统**
   - 积分系统（发帖、回复、点赞等行为获得积分）
   - 等级系统（基于积分自动晋升）
   - 徽章系统（成就徽章、等级徽章）
   - 积分排行榜
   - 等级徽章展示

#### 1.2.2 社区管理功能
1. **版主管理**
   - 版主任命和撤职
   - 版主权限管理
   - 版主操作日志

2. **内容审核**
   - 人工审核（待审核、已通过、已拒绝）
   - 审核历史记录
   - 审核原因记录
   - 预留 AI 审核接口

3. **举报管理**
   - 用户举报功能
   - 举报类型分类
   - 举报处理流程
   - 举报记录查询

4. **社区规则**
   - 社区规则配置
   - 规则版本管理
   - 规则展示

5. **数据分析**
   - 社区活跃度统计（日活、周活、月活）
   - 用户行为统计（发帖数、回复数、点赞数）
   - 内容统计（主题数、回复数、热门内容）
   - 版块统计（各版块活跃度）
   - 用户增长统计

#### 1.2.3 安全防护功能
1. **XSS 防护**
   - 输入内容过滤
   - 输出内容转义
   - CSP 策略配置

2. **CSRF 防护**
   - CSRF Token 验证
   - Referer 检查

3. **防刷屏**
   - 发帖频率限制
   - 回复频率限制
   - IP 限流
   - 用户限流

4. **反垃圾**
   - 敏感词过滤
   - 内容重复检测
   - 垃圾内容识别
   - 预留 AI 反垃圾接口

### 1.3 非功能性需求

#### 1.3.1 性能要求
1. 论坛列表页响应时间 < 500ms
2. 主题详情页响应时间 < 300ms
3. 搜索响应时间 < 1s
4. 并发支持 1000+ 用户在线
5. 数据库查询优化，避免 N+1 查询

#### 1.3.2 安全要求
1. 所有 API 必须通过 JWT 认证
2. 敏感操作需要二次验证
3. 用户输入必须经过验证和过滤
4. 防止 SQL 注入、XSS、CSRF 等攻击
5. API 限流保护

#### 1.3.3 可用性要求
1. 系统可用性 > 99.5%
2. 数据库备份策略
3. 错误日志记录
4. 监控告警机制

#### 1.3.4 可扩展性要求
1. 模块化架构，便于功能扩展
2. 预留插件接口
3. 预留第三方集成接口
4. 支持水平扩展

#### 1.3.5 可维护性要求
1. 代码规范统一
2. 完整的 API 文档
3. 完善的日志记录
4. 清晰的代码注释

## 2. 技术实现方案

### 2.1 技术栈

#### 2.1.1 后端技术栈
- **框架**: NestJS 11.x
- **语言**: TypeScript 5.x
- **数据库**: PostgreSQL
- **ORM**: Prisma 7.2.0
- **缓存**: Redis (使用 Keyv 适配器)
- **认证**: JWT + Passport
- **API 文档**: Swagger
- **验证**: class-validator
- **日志**: Winston

#### 2.1.2 架构模式
- **架构风格**: 分层架构（Controller → Service → Repository）
- **模块化**: NestJS 模块化架构
- **设计模式**: 依赖注入、单例模式、工厂模式

### 2.2 架构设计

#### 2.2.1 整体架构
```
┌─────────────────────────────────────────────────────────┐
│                     Client Layer                        │
│              (Web Client, Mobile Client)                │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    API Gateway Layer                    │
│              (NestJS Controller Layer)                   │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                   Business Logic Layer                  │
│              (NestJS Service Layer)                      │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    Data Access Layer                    │
│              (Prisma ORM + Repository)                  │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    Data Storage Layer                    │
│         (PostgreSQL + Redis + File Storage)             │
└─────────────────────────────────────────────────────────┘
```

#### 2.2.2 模块架构
```
apps/
├── admin-api/
│   └── src/
│       └── modules/
│           └── forum/                    # 论坛管理端模块
│               ├── board/                 # 版块管理
│               ├── topic/                 # 主题管理
│               ├── reply/                 # 回复管理
│               ├── comment/               # 评论管理
│               ├── moderator/             # 版主管理
│               ├── audit/                 # 内容审核
│               ├── report/                # 举报管理
│               ├── user/                   # 论坛用户管理
│               ├── point/                 # 积分管理
│               ├── badge/                 # 徽章管理
│               ├── level/                 # 等级管理
│               ├── analytics/             # 数据分析
│               └── forum.module.ts        # 论坛模块入口
│
└── client-api/
    └── src/
        └── modules/
            └── forum/                    # 论坛客户端模块
                ├── board/                 # 版块浏览
                ├── topic/                 # 主题浏览和发布
                ├── reply/                 # 回复功能
                ├── comment/               # 评论功能
                ├── like/                  # 点赞功能
                ├── search/                # 搜索功能
                ├── notification/          # 通知功能
                ├── user/                  # 用户中心
                ├── point/                 # 积分查询
                ├── badge/                 # 徽章展示
                └── forum.module.ts        # 论坛模块入口

libs/
└── forum/                             # 论坛共享库
    ├── src/
        ├── database/                   # 数据库相关
        │   ├── models/                 # Prisma 模型
        │   ├── extensions/             # Prisma 扩展
        │   └── repository.service.ts   # 仓储服务
        ├── dto/                        # 共享 DTO
        ├── decorators/                 # 装饰器
        ├── guards/                     # 守卫
        ├── interceptors/               # 拦截器
        ├── services/                   # 共享服务
        └── utils/                      # 工具函数
```

### 2.3 数据库设计

#### 2.3.1 数据表清单

**用户相关表**:
- `forum_user_profile`: 论坛用户档案
- `forum_user_level`: 用户等级
- `forum_user_badge`: 用户徽章
- `forum_user_point`: 用户积分记录
- `forum_user_role`: 用户角色

**内容相关表**:
- `forum_board`: 版块
- `forum_topic`: 主题/帖子
- `forum_reply`: 回复
- `forum_comment`: 评论
- `forum_like`: 点赞记录
- `forum_attachment`: 附件
- `forum_tag`: 标签
- `forum_topic_tag`: 主题标签关联

**管理相关表**:
- `forum_moderator`: 版主
- `forum_audit`: 审核记录
- `forum_report`: 举报记录
- `forum_rule`: 社区规则

**系统相关表**:
- `forum_notification`: 通知
- `forum_point_rule`: 积分规则
- `forum_analytics`: 数据统计

#### 2.3.2 核心表设计

**forum_user_profile** (论坛用户档案)
```prisma
model ForumUserProfile {
  id              Int      @id @default(autoincrement())
  userId          Int      @unique @map("user_id")
  nickname        String?  @db.VarChar(50)
  avatar          String?  @db.VarChar(500)
  signature       String?  @db.VarChar(200)
  levelId         Int?     @map("level_id")
  point           Int      @default(0)
  topicCount      Int      @default(0) @map("topic_count")
  replyCount      Int      @default(0) @map("reply_count")
  likeCount       Int      @default(0) @map("like_count")
  lastActiveAt    DateTime? @map("last_active_at") @db.Timestamptz
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt       DateTime? @map("deleted_at") @db.Timestamptz
  
  user            ClientUser @relation(fields: [userId], references: [id])
  level           ForumUserLevel? @relation(fields: [levelId], references: [id])
  topics          ForumTopic[]
  replies         ForumReply[]
  comments        ForumComment[]
  likes           ForumLike[]
  points          ForumUserPoint[]
  badges          ForumUserBadge[]
  roles           ForumUserRole[]
  
  @@index([userId])
  @@index([levelId])
  @@index([point])
  @@map("forum_user_profile")
}
```

**forum_board** (版块)
```prisma
model ForumBoard {
  id              Int      @id @default(autoincrement())
  name            String   @db.VarChar(100)
  description     String?  @db.Text
  icon            String?  @db.VarChar(500)
  sortOrder       Int      @default(0) @map("sort_order")
  isEnabled       Boolean  @default(true) @map("is_enabled")
  topicCount      Int      @default(0) @map("topic_count")
  replyCount      Int      @default(0) @map("reply_count")
  lastTopicId     Int?     @map("last_topic_id")
  lastTopicTitle  String?  @map("last_topic_title") @db.VarChar(200)
  lastTopicAt     DateTime? @map("last_topic_at") @db.Timestamptz
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt       DateTime? @map("deleted_at") @db.Timestamptz
  
  topics          ForumTopic[]
  
  @@index([sortOrder])
  @@index([isEnabled])
  @@map("forum_board")
}
```

**forum_topic** (主题)
```prisma
model ForumTopic {
  id              Int      @id @default(autoincrement())
  boardId         Int      @map("board_id")
  userId          Int      @map("user_id")
  title           String   @db.VarChar(200)
  content         String   @db.Text
  isPinned        Boolean  @default(false) @map("is_pinned")
  isEssence       Boolean  @default(false) @map("is_essence")
  isLocked        Boolean  @default(false) @map("is_locked")
  isAudit         Boolean  @default(false) @map("is_audit")
  auditStatus     String   @default("pending") @map("audit_status") @db.VarChar(20)
  viewCount       Int      @default(0) @map("view_count")
  replyCount      Int      @default(0) @map("reply_count")
  likeCount       Int      @default(0) @map("like_count")
  lastReplyAt     DateTime? @map("last_reply_at") @db.Timestamptz
  lastReplyId     Int?     @map("last_reply_id")
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt       DateTime? @map("deleted_at") @db.Timestamptz
  
  board           ForumBoard @relation(fields: [boardId], references: [id])
  user            ForumUserProfile @relation(fields: [userId], references: [id])
  replies         ForumReply[]
  likes           ForumLike[]
  tags            ForumTopicTag[]
  audits          ForumAudit[]
  
  @@index([boardId])
  @@index([userId])
  @@index([isPinned, createdAt])
  @@index([isEssence])
  @@index([auditStatus])
  @@index([createdAt])
  @@index([viewCount])
  @@index([replyCount])
  @@index([likeCount])
  @@map("forum_topic")
}
```

**forum_reply** (回复)
```prisma
model ForumReply {
  id              Int      @id @default(autoincrement())
  topicId         Int      @map("topic_id")
  userId          Int      @map("user_id")
  content         String   @db.Text
  floor           Int      @default(1)
  isAudit         Boolean  @default(false) @map("is_audit")
  auditStatus     String   @default("pending") @map("audit_status") @db.VarChar(20)
  likeCount       Int      @default(0) @map("like_count")
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt       DateTime? @map("deleted_at") @db.Timestamptz
  
  topic           ForumTopic @relation(fields: [topicId], references: [id])
  user            ForumUserProfile @relation(fields: [userId], references: [id])
  comments        ForumComment[]
  likes           ForumLike[]
  audits          ForumAudit[]
  
  @@index([topicId])
  @@index([userId])
  @@index([floor])
  @@index([auditStatus])
  @@index([createdAt])
  @@map("forum_reply")
}
```

**forum_comment** (评论)
```prisma
model ForumComment {
  id              Int      @id @default(autoincrement())
  replyId         Int      @map("reply_id")
  userId          Int      @map("user_id")
  content         String   @db.Text
  likeCount       Int      @default(0) @map("like_count")
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt       DateTime? @map("deleted_at") @db.Timestamptz
  
  reply           ForumReply @relation(fields: [replyId], references: [id])
  user            ForumUserProfile @relation(fields: [userId], references: [id])
  likes           ForumLike[]
  
  @@index([replyId])
  @@index([userId])
  @@index([createdAt])
  @@map("forum_comment")
}
```

**forum_like** (点赞)
```prisma
model ForumLike {
  id              Int      @id @default(autoincrement())
  targetType      String   @map("target_type") @db.VarChar(20)
  targetId        Int      @map("target_id")
  userId          Int      @map("user_id")
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz
  
  topic           ForumTopic? @relation(fields: [targetId], references: [id])
  reply           ForumReply? @relation(fields: [targetId], references: [id])
  comment         ForumComment? @relation(fields: [targetId], references: [id])
  user            ForumUserProfile @relation(fields: [userId], references: [id])
  
  @@unique([targetType, targetId, userId])
  @@index([targetType, targetId])
  @@index([userId])
  @@map("forum_like")
}
```

### 2.4 API 设计

#### 2.4.1 路由前缀规范
- **管理端**: `/admin/forum/*`
- **客户端**: `/api/forum/*`

#### 2.4.2 API 列表

**管理端 API**:

**版块管理** (`/admin/forum/board`)
- `POST /create` - 创建版块
- `GET /page` - 分页查询版块列表
- `GET /detail` - 获取版块详情
- `POST /update` - 更新版块信息
- `POST /update-status` - 更新版块状态
- `POST /delete` - 删除版块

**主题管理** (`/admin/forum/topic`)
- `POST /create` - 创建主题
- `GET /page` - 分页查询主题列表
- `GET /detail` - 获取主题详情
- `POST /update` - 更新主题信息
- `POST /pin` - 置顶/取消置顶
- `POST /essence` - 加精/取消加精
- `POST /lock` - 锁定/取消锁定
- `POST /audit` - 审核主题
- `POST /delete` - 删除主题

**回复管理** (`/admin/forum/reply`)
- `GET /page` - 分页查询回复列表
- `GET /detail` - 获取回复详情
- `POST /update` - 更新回复信息
- `POST /audit` - 审核回复
- `POST /delete` - 删除回复

**版主管理** (`/admin/forum/moderator`)
- `POST /create` - 任命版主
- `GET /page` - 分页查询版主列表
- `POST /update` - 更新版主信息
- `POST /delete` - 撤职版主

**审核管理** (`/admin/forum/audit`)
- `GET /page` - 分页查询审核列表
- `POST /approve` - 通过审核
- `POST /reject` - 拒绝审核

**举报管理** (`/admin/forum/report`)
- `GET /page` - 分页查询举报列表
- `POST /handle` - 处理举报

**用户管理** (`/admin/forum/user`)
- `GET /page` - 分页查询用户列表
- `GET /detail` - 获取用户详情
- `POST /update` - 更新用户信息
- `POST /ban` - 封禁用户
- `POST /unban` - 解封用户

**积分管理** (`/admin/forum/point`)
- `GET /page` - 分页查询积分记录
- `POST /adjust` - 调整用户积分
- `GET /rule/page` - 分页查询积分规则
- `POST /rule/create` - 创建积分规则
- `POST /rule/update` - 更新积分规则
- `POST /rule/delete` - 删除积分规则

**等级管理** (`/admin/forum/level`)
- `GET /page` - 分页查询等级列表
- `POST /create` - 创建等级
- `POST /update` - 更新等级
- `POST /delete` - 删除等级

**徽章管理** (`/admin/forum/badge`)
- `GET /page` - 分页查询徽章列表
- `POST /create` - 创建徽章
- `POST /update` - 更新徽章
- `POST /delete` - 删除徽章
- `POST /grant` - 授予徽章
- `POST /revoke` - 撤销徽章

**数据分析** (`/admin/forum/analytics`)
- `GET /overview` - 获取概览数据
- `GET /activity` - 获取活跃度数据
- `GET /content` - 获取内容数据
- `GET /user` - 获取用户数据
- `GET /board` - 获取版块数据

**客户端 API**:

**版块浏览** (`/api/forum/board`)
- `GET /list` - 获取版块列表
- `GET /detail` - 获取版块详情

**主题浏览** (`/api/forum/topic`)
- `GET /page` - 分页查询主题列表
- `GET /detail` - 获取主题详情
- `POST /create` - 发布主题
- `POST /update` - 更新主题
- `POST /delete` - 删除主题

**回复功能** (`/api/forum/reply`)
- `GET /page` - 分页查询回复列表
- `POST /create` - 回复主题
- `POST /update` - 更新回复
- `POST /delete` - 删除回复

**评论功能** (`/api/forum/comment`)
- `GET /page` - 分页查询评论列表
- `POST /create` - 评论回复
- `POST /delete` - 删除评论

**点赞功能** (`/api/forum/like`)
- `POST /create` - 点赞
- `POST /cancel` - 取消点赞
- `GET /check` - 检查是否已点赞

**搜索功能** (`/api/forum/search`)
- `GET /topic` - 搜索主题
- `GET /user` - 搜索用户
- `GET /hot` - 热门搜索

**通知功能** (`/api/forum/notification`)
- `GET /page` - 分页查询通知列表
- `GET /unread-count` - 获取未读通知数
- `POST /read` - 标记为已读
- `POST /read-all` - 全部标记为已读
- `POST /delete` - 删除通知

**用户中心** (`/api/forum/user`)
- `GET /profile` - 获取用户档案
- `POST /update-profile` - 更新用户档案
- `GET /topics` - 获取用户发布的主题
- `GET /replies` - 获取用户的回复
- `GET /likes` - 获取用户的点赞

**积分查询** (`/api/forum/point`)
- `GET /balance` - 获取积分余额
- `GET /records` - 获取积分记录
- `GET /ranking` - 获取积分排行榜

**徽章展示** (`/api/forum/badge`)
- `GET /list` - 获取徽章列表
- `GET /my-badges` - 获取我的徽章

### 2.5 缓存策略

#### 2.5.1 缓存命名空间
- 前缀: `Forum:`
- 版块缓存: `Forum:Board:{id}`
- 版块列表: `Forum:Board:List`
- 主题缓存: `Forum:Topic:{id}`
- 热门主题: `Forum:Topic:Hot`
- 用户缓存: `Forum:User:{id}`
- 用户统计: `Forum:User:Stats:{id}`
- 搜索结果: `Forum:Search:{hash}`
- 统计数据: `Forum:Analytics:*`

#### 2.5.2 缓存策略
- **版块列表**: 长期缓存（1小时），版块更新时清除
- **版块详情**: 中期缓存（30分钟），版块更新时清除
- **热门主题**: 中期缓存（10分钟），定时刷新
- **主题详情**: 短期缓存（5分钟），主题更新时清除
- **用户档案**: 中期缓存（10分钟），用户更新时清除
- **用户统计**: 中期缓存（10分钟），用户行为变化时清除
- **搜索结果**: 短期缓存（1分钟）
- **统计数据**: 定期刷新（15分钟）

### 2.6 安全防护设计

#### 2.6.1 XSS 防护
1. **输入过滤**: 使用 `sanitize-html` 过滤 HTML 标签
2. **输出转义**: 使用模板引擎自动转义
3. **CSP 策略**: 配置 Content-Security-Policy 头
4. **富文本**: 使用安全的富文本编辑器

#### 2.6.2 CSRF 防护
1. **CSRF Token**: 使用 `@fastify/csrf-protection` 生成和验证 Token
2. **SameSite Cookie**: 设置 Cookie 的 SameSite 属性
3. **Referer 检查**: 验证请求来源

#### 2.6.3 防刷屏
1. **频率限制**: 使用 `@nestjs/throttler` 限制请求频率
   - 发帖: 1分钟最多1次
   - 回复: 10秒最多1次
   - 评论: 10秒最多1次
   - 点赞: 1秒最多1次
2. **IP 限流**: 基于 IP 的限流策略
3. **用户限流**: 基于用户的限流策略

#### 2.6.4 反垃圾
1. **敏感词过滤**: 实现敏感词库和过滤逻辑
2. **内容重复检测**: 检测重复发布的内容
3. **垃圾内容识别**: 基于规则识别垃圾内容
4. **预留 AI 接口**: 预留 AI 反垃圾接口

### 2.7 权限系统设计

#### 2.7.1 角色定义
- **普通用户 (USER)**: 浏览、发帖、回复、点赞
- **版主 (MODERATOR)**: 管理指定版块的内容
- **超级版主 (SUPER_MODERATOR)**: 管理所有版块
- **管理员 (ADMIN)**: 系统级管理权限

#### 2.7.2 权限控制
1. **API 级别**: 通过 Guard 控制访问
2. **数据级别**: 通过 Service 层逻辑控制
3. **操作级别**: 通过装饰器和中间件控制

#### 2.7.3 权限验证
- 使用装饰器 `@RequireRole('MODERATOR')` 标记需要特定角色的接口
- 在 Service 层验证用户是否有权限操作特定数据
- 版主只能管理自己负责的版块

### 2.8 搜索功能设计

#### 2.8.1 搜索方式
1. **关键词搜索**: 使用 PostgreSQL 全文搜索
2. **标签筛选**: 按标签筛选内容
3. **版块筛选**: 按版块筛选内容
4. **时间范围**: 按时间范围筛选
5. **用户筛选**: 按用户筛选内容

#### 2.8.2 搜索优化
1. **全文搜索**: 使用 PostgreSQL 的 `tsvector` 和 `to_tsquery`
2. **索引优化**: 为搜索字段创建 GIN 索引
3. **结果缓存**: 缓存热门搜索结果
4. **搜索历史**: 记录用户搜索历史

## 3. 任务边界限制

### 3.1 包含范围
1. 论坛模块的完整设计和实现
2. 论坛数据库表结构设计和迁移
3. 论坛核心功能开发（帖子、回复、点赞、评论）
4. 论坛权限系统（独立于漫画模块）
5. 论坛搜索功能（独立索引）
6. 论坛通知系统
7. 论坛缓存策略
8. 论坛安全防护（XSS、CSRF、防刷屏）
9. 社区管理功能（版主、审核、举报）
10. 用户激励系统（积分、等级、徽章）
11. 论坛数据分析
12. API 文档

### 3.2 不包含范围
1. 前端界面开发（仅提供后端 API）
2. 论坛与漫画模块的数据互通（如漫画讨论帖等）
3. 第三方论坛系统集成（如 Discuz、phpBB 等）
4. 实时聊天功能
5. 论坛插件市场开发
6. 论坛移动端适配（后端 API 应支持，但前端不在范围内）
7. AI 辅助审核（仅预留接口）
8. AI 反垃圾（仅预留接口）
9. 积分兑换功能
10. 实时通知（WebSocket）

### 3.3 技术约束
1. 使用项目现有的技术栈（NestJS、Prisma、PostgreSQL、Redis）
2. 不引入新的数据库或缓存系统
3. 不引入新的认证系统（复用现有 JWT）
4. 不修改现有漫画模块代码
5. 不影响现有漫画模块功能
6. 遵循项目现有的代码规范
7. 遵循项目现有的 API 设计规范

### 3.4 集成方案
1. **用户集成**: 论坛用户复用 `ClientUser`，通过 `ForumUserProfile` 扩展
2. **认证集成**: 复用现有 JWT 认证机制
3. **缓存集成**: 使用现有 Redis 缓存，使用独立命名空间
4. **上传集成**: 复用现有上传服务
5. **日志集成**: 复用现有日志系统
6. **监控集成**: 复用现有健康检查

## 4. 验收标准

### 4.1 功能验收标准

#### 4.1.1 论坛核心功能
- [ ] 用户可以浏览版块列表
- [ ] 用户可以查看版块详情
- [ ] 用户可以发布主题（支持富文本、图片上传）
- [ ] 用户可以编辑自己发布的主题
- [ ] 用户可以删除自己发布的主题
- [ ] 用户可以回复主题
- [ ] 用户可以编辑自己的回复
- [ ] 用户可以删除自己的回复
- [ ] 用户可以对回复进行评论
- [ ] 用户可以删除自己的评论
- [ ] 用户可以点赞主题、回复、评论
- [ ] 用户可以取消点赞
- [ ] 用户可以搜索主题（支持关键词、标签、版块筛选）
- [ ] 用户可以搜索其他用户
- [ ] 用户可以查看通知列表
- [ ] 用户可以标记通知为已读
- [ ] 用户可以查看自己的积分
- [ ] 用户可以查看积分记录
- [ ] 用户可以查看积分排行榜
- [ ] 用户可以查看自己的等级
- [ ] 用户可以查看自己的徽章

#### 4.1.2 社区管理功能
- [ ] 管理员可以创建、编辑、删除版块
- [ ] 管理员可以任命和撤职版主
- [ ] 版主可以置顶主题
- [ ] 版主可以加精主题
- [ ] 版主可以锁定主题
- [ ] 版主可以删除主题
- [ ] 版主可以审核主题
- [ ] 版主可以审核回复
- [ ] 用户可以举报内容
- [ ] 管理员可以处理举报
- [ ] 管理员可以配置积分规则
- [ ] 管理员可以调整用户积分
- [ ] 管理员可以创建、编辑、删除等级
- [ ] 管理员可以创建、编辑、删除徽章
- [ ] 管理员可以授予和撤销徽章

#### 4.1.3 数据分析功能
- [ ] 管理员可以查看社区概览数据
- [ ] 管理员可以查看活跃度数据
- [ ] 管理员可以查看内容数据
- [ ] 管理员可以查看用户数据
- [ ] 管理员可以查看版块数据

### 4.2 性能验收标准
- [ ] 论坛列表页响应时间 < 500ms
- [ ] 主题详情页响应时间 < 300ms
- [ ] 搜索响应时间 < 1s
- [ ] 并发支持 1000+ 用户在线
- [ ] 数据库查询无 N+1 问题
- [ ] 缓存命中率 > 80%

### 4.3 安全验收标准
- [ ] 所有 API 都通过 JWT 认证
- [ ] 敏感操作需要二次验证
- [ ] 用户输入经过验证和过滤
- [ ] 防止 SQL 注入攻击
- [ ] 防止 XSS 攻击
- [ ] 防止 CSRF 攻击
- [ ] API 限流保护生效
- [ ] 防刷屏机制生效
- [ ] 敏感词过滤生效

### 4.4 可用性验收标准
- [ ] 系统可用性 > 99.5%
- [ ] 数据库有备份策略
- [ ] 错误日志记录完整
- [ ] 监控告警机制生效

### 4.5 代码质量验收标准
- [ ] 代码符合 ESLint 规范
- [ ] 代码通过 TypeScript 类型检查
- [ ] 代码通过 Prettier 格式化
- [ ] API 文档完整（Swagger）
- [ ] 代码注释清晰
- [ ] 代码复用性高
- [ ] 代码可维护性好

### 4.6 集成验收标准
- [ ] 论坛模块与漫画模块代码完全隔离
- [ ] 论坛模块与漫画模块数据库完全隔离
- [ ] 论坛模块与漫画模块缓存完全隔离
- [ ] 论坛模块与漫画模块权限完全隔离
- [ ] 论坛模块不影响漫画模块功能
- [ ] 漫画模块不影响论坛模块功能

### 4.7 部署验收标准
- [ ] 数据库迁移成功
- [ ] 数据库种子数据成功
- [ ] 应用启动成功
- [ ] 健康检查通过
- [ ] API 可以正常访问
- [ ] 缓存正常工作
- [ ] 日志正常输出

## 5. 风险评估

### 5.1 技术风险
1. **性能风险**: 论坛模块可能影响现有系统性能
   - **缓解措施**: 通过缓存和优化降低影响，监控性能指标

2. **数据库风险**: 数据库表数量增加可能影响查询性能
   - **缓解措施**: 合理设计索引，定期优化数据库

3. **搜索风险**: 搜索功能可能需要额外的优化
   - **缓解措施**: 测试和调整搜索性能，使用缓存

### 5.2 业务风险
1. **用户集成风险**: 论坛用户体系与现有用户体系的集成可能存在兼容性问题
   - **缓解措施**: 充分测试用户集成逻辑

2. **权限风险**: 权限系统的隔离可能增加管理复杂度
   - **缓解措施**: 提供清晰的管理界面和文档

3. **审核风险**: 论坛内容审核可能需要大量人力投入
   - **缓解措施**: 实现高效的审核流程，预留 AI 审核接口

### 5.3 实施风险
1. **开发风险**: 开发工作量较大，可能延期
   - **缓解措施**: 合理规划时间，分阶段交付

2. **测试风险**: 测试覆盖可能不充分
   - **缓解措施**: 编写完整的测试用例，进行充分测试

3. **部署风险**: 部署和迁移可能存在问题
   - **缓解措施**: 充分测试部署流程，制定回滚方案

## 6. 里程碑计划

### 6.1 阶段一：架构设计和数据库设计（1周）
- 完成系统架构设计
- 完成数据库表结构设计
- 完成数据库迁移脚本
- 完成数据库种子数据

### 6.2 阶段二：核心功能开发（2周）
- 完成版块管理功能
- 完成主题管理功能
- 完成回复管理功能
- 完成评论管理功能
- 完成点赞功能

### 6.3 阶段三：管理功能开发（1周）
- 完成版主管理功能
- 完成内容审核功能
- 完成举报管理功能
- 完成用户管理功能

### 6.4 阶段四：激励系统开发（1周）
- 完成积分系统
- 完成等级系统
- 完成徽章系统

### 6.5 阶段五：辅助功能开发（1周）
- 完成搜索功能
- 完成通知功能
- 完成数据分析功能

### 6.6 阶段六：安全防护和优化（1周）
- 完成安全防护功能
- 完成缓存策略
- 完成性能优化

### 6.7 阶段七：测试和部署（1周）
- 完成单元测试
- 完成集成测试
- 完成部署脚本
- 完成部署和验证

**总计**: 约 8 周

## 7. 资源需求

### 7.1 人力资源
- 后端开发工程师: 2人
- 测试工程师: 1人
- 运维工程师: 1人

### 7.2 技术资源
- 开发服务器: 1台
- 测试服务器: 1台
- 数据库服务器: 1台
- Redis 服务器: 1台

### 7.3 时间资源
- 开发时间: 6周
- 测试时间: 1周
- 部署时间: 1周

---

**文档版本**: v1.0  
**创建时间**: 2026-01-03  
**最后更新**: 2026-01-03  
**状态**: 已确认
