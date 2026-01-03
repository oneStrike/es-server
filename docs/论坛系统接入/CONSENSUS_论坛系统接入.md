# 论坛系统接入 - 需求共识文档

## 1. 需求描述

### 1.1 核心目标

在现有漫画平台基础上，独立接入一个完整的论坛社区系统，该系统必须与漫画模块完全隔离，同时遵循现有项目架构和代码规范。

### 1.2 功能需求

#### 1.2.1 第一阶段（核心功能）

**用户管理**
- 论坛用户注册、登录
- 用户个人资料管理
- 用户角色管理（普通用户、版主、管理员）

**板块管理**
- 板块分类管理
- 板块信息维护
- 版主管理

**帖子管理**
- 帖子发布（支持富文本）
- 帖子编辑
- 帖子删除（软删除）
- 帖子查看
- 帖子列表（分页、排序、筛选）

**评论系统**
- 评论发布
- 评论回复
- 评论删除
- 评论列表

**点赞功能**
- 帖子点赞/取消点赞
- 评论点赞/取消点赞
- 点赞数统计

**搜索功能**
- 帖子全文搜索
- 用户搜索
- 热门搜索

**通知系统**
- 评论通知
- 点赞通知
- 通知列表
- 通知已读/未读状态

#### 1.2.2 第二阶段（社区功能）

**积分系统**
- 积分获取规则（发帖、评论、点赞等）
- 积分消费规则
- 积分记录查询
- 积分排行榜

**等级系统**
- 用户等级规则（基于积分）
- 等级权益配置
- 等级升级通知

**徽章系统**
- 徽章类型配置
- 徽章获取规则（首次发帖、获得100个赞等）
- 徽章展示

**内容审核**
- 敏感词过滤（基于正则表达式）
- 人工审核工作流
- 审核记录

**数据分析**
- 社区活跃度统计（日活、周活、月活）
- 用户行为分析
- 内容统计（帖子数、评论数、点赞数）

#### 1.2.3 第三阶段（扩展功能）

**插件机制**
- 插件接口设计
- 插件加载机制
- 插件管理

**API开放**
- 开放API接口
- API密钥管理
- API调用限制

**CDN加速**
- 静态资源CDN配置
- 图片上传优化

**缓存优化**
- Redis缓存策略
- 缓存失效机制
- 缓存预热

### 1.3 非功能需求

#### 1.3.1 架构隔离

- **代码隔离**: 论坛模块独立目录结构，与漫画模块代码完全分离
- **数据库隔离**: 独立的数据库表结构，使用 `forum_` 前缀
- **路由隔离**: 独立的路由前缀（`/admin/forum` 和 `/client/forum`）
- **权限隔离**: 独立的权限控制系统，与漫画模块权限体系隔离

#### 1.3.2 性能要求

- 响应时间: API响应时间 < 500ms
- 并发支持: 支持1000+并发用户
- 缓存策略: 热门内容缓存，缓存命中率 > 80%
- 数据库优化: 合理的索引设计，查询性能优化

#### 1.3.3 安全要求

- **认证**: 使用JWT认证，独立的token策略
- **授权**: 基于角色的权限控制（RBAC）
- **防护**: XSS防护、CSRF防护、SQL注入防护
- **防刷**: 频率限制、验证码、IP限制
- **内容安全**: 敏感词过滤、内容审核

#### 1.3.4 可扩展性

- **模块化**: 采用模块化架构，便于功能扩展
- **插件化**: 设计插件机制，支持第三方功能扩展
- **API化**: 预留API接口，便于与其他系统集成

## 2. 验收标准

### 2.1 功能验收标准

#### 2.1.1 第一阶段验收标准

**用户管理**
- [ ] 用户可以成功注册和登录
- [ ] 用户可以更新个人资料
- [ ] 用户角色可以正确区分（普通用户、版主、管理员）
- [ ] 权限控制生效，不同角色只能访问对应权限的接口

**板块管理**
- [ ] 管理员可以创建、编辑、删除板块
- [ ] 板块可以正确分类和排序
- [ ] 版主可以正确分配和管理

**帖子管理**
- [ ] 用户可以发布帖子（支持富文本）
- [ ] 用户可以编辑和删除自己的帖子
- [ ] 帖子列表可以正确分页、排序、筛选
- [ ] 帖子详情可以正确展示

**评论系统**
- [ ] 用户可以发布评论和回复
- [ ] 用户可以删除自己的评论
- [ ] 评论列表可以正确展示（支持嵌套回复）

**点赞功能**
- [ ] 用户可以点赞/取消点赞帖子和评论
- [ ] 点赞数可以正确统计和展示
- [ ] 重复点赞会被拒绝

**搜索功能**
- [ ] 用户可以搜索帖子（支持标题、内容、作者）
- [ ] 用户可以搜索其他用户
- [ ] 热门搜索可以正确展示

**通知系统**
- [ ] 用户可以收到评论通知
- [ ] 用户可以收到点赞通知
- [ ] 通知列表可以正确展示（已读/未读状态）
- [ ] 用户可以标记通知为已读

#### 2.1.2 第二阶段验收标准

**积分系统**
- [ ] 用户可以通过发帖、评论、点赞等行为获取积分
- [ ] 积分可以正确记录和查询
- [ ] 积分排行榜可以正确展示

**等级系统**
- [ ] 用户可以根据积分自动升级
- [ ] 等级可以正确展示
- [ ] 等级升级通知可以正确发送

**徽章系统**
- [ ] 用户可以根据特定成就获取徽章
- [ ] 徽章可以正确展示
- [ ] 徽章获取规则可以正确触发

**内容审核**
- [ ] 敏感词可以正确过滤
- [ ] 人工审核工作流可以正常执行
- [ ] 审核记录可以正确保存

**数据分析**
- [ ] 社区活跃度可以正确统计
- [ ] 用户行为可以正确分析
- [ ] 内容统计可以正确展示

#### 2.1.3 第三阶段验收标准

**插件机制**
- [ ] 插件可以正确加载和卸载
- [ ] 插件可以正确扩展功能
- [ ] 插件管理可以正常执行

**API开放**
- [ ] 开放API可以正常调用
- [ ] API密钥可以正确管理
- [ ] API调用限制可以正确执行

**CDN加速**
- [ ] 静态资源可以正确使用CDN
- [ ] 图片上传可以正确优化

**缓存优化**
- [ ] Redis缓存可以正确使用
- [ ] 缓存失效机制可以正确执行
- [ ] 缓存预热可以正确执行

### 2.2 性能验收标准

- [ ] API响应时间 < 500ms（95%的请求）
- [ ] 支持1000+并发用户
- [ ] 缓存命中率 > 80%
- [ ] 数据库查询性能优化（慢查询 < 100ms）

### 2.3 安全验收标准

- [ ] JWT认证正常工作
- [ ] 权限控制生效，未授权请求被拒绝
- [ ] XSS防护生效，恶意脚本被过滤
- [ ] CSRF防护生效，跨站请求被拒绝
- [ ] 防刷机制生效，频繁请求被限制
- [ ] 敏感词过滤生效，违规内容被拦截

### 2.4 代码质量验收标准

- [ ] 代码遵循现有项目规范
- [ ] 代码通过ESLint检查
- [ ] 代码通过Prettier格式化
- [ ] 代码通过TypeScript类型检查
- [ ] 单元测试覆盖率 > 80%
- [ ] API文档完整（Swagger）

### 2.5 文档验收标准

- [ ] API文档完整（Swagger）
- [ ] 数据库设计文档完整
- [ ] 架构设计文档完整
- [ ] 部署文档完整
- [ ] 使用文档完整

## 3. 技术实现方案

### 3.1 整体架构

#### 3.1.1 分层架构

```
┌─────────────────────────────────────┐
│         Client Layer                 │
│    (Web / Mobile / Third-party)      │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│         API Layer                   │
│  (Controller / DTO / Validation)    │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│         Service Layer               │
│  (Business Logic / Cache / Auth)    │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│         Repository Layer             │
│    (Data Access / Prisma ORM)       │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│         Database Layer               │
│     (PostgreSQL / Redis)            │
└─────────────────────────────────────┘
```

#### 3.1.2 模块划分

```
apps/
├── admin-api/
│   └── src/modules/
│       └── forum/
│           ├── user/              # 用户管理
│           ├── board/             # 板块管理
│           ├── post/              # 帖子管理
│           ├── comment/           # 评论管理
│           ├── like/              # 点赞管理
│           ├── search/            # 搜索管理
│           ├── notification/      # 通知管理
│           ├── point/             # 积分管理
│           ├── level/             # 等级管理
│           ├── badge/             # 徽章管理
│           ├── audit/             # 内容审核
│           ├── analytics/         # 数据分析
│           ├── plugin/            # 插件管理
│           └── api/               # 开放API
└── client-api/
    └── src/modules/
        └── forum/
            ├── user/
            ├── board/
            ├── post/
            ├── comment/
            ├── like/
            ├── search/
            └── notification/
```

### 3.2 数据库设计

#### 3.2.1 数据表设计

**用户相关**
- `forum_user_profile`: 论坛用户资料（扩展ClientUser）
- `forum_user_role`: 用户角色关系
- `forum_user_level`: 用户等级记录

**板块相关**
- `forum_board`: 板块信息
- `forum_board_moderator`: 板块版主关系

**帖子相关**
- `forum_post`: 帖子信息
- `forum_post_tag`: 帖子标签关系
- `forum_post_category`: 帖子分类关系

**评论相关**
- `forum_comment`: 评论信息

**点赞相关**
- `forum_like`: 点赞记录

**搜索相关**
- `forum_search_log`: 搜索日志
- `forum_search_hot`: 热门搜索

**通知相关**
- `forum_notification`: 通知信息

**积分相关**
- `forum_point`: 用户积分
- `forum_point_log`: 积分记录

**等级相关**
- `forum_level`: 等级配置

**徽章相关**
- `forum_badge`: 徽章配置
- `forum_user_badge`: 用户徽章关系

**审核相关**
- `forum_audit`: 审核记录

**分析相关**
- `forum_analytics_user`: 用户行为分析
- `forum_analytics_content`: 内容统计分析

**插件相关**
- `forum_plugin`: 插件信息

**API相关**
- `forum_api_key`: API密钥

#### 3.2.2 数据库规范

- **命名规范**: 使用 `forum_` 前缀
- **字段规范**: 小写+下划线
- **索引规范**: 根据查询场景添加索引
- **软删除**: 使用 `deleted_at` 字段
- **时间字段**: 使用 `timestamptz` 类型

### 3.3 路由设计

#### 3.3.1 管理后台路由

```
/admin/forum
├── /user                    # 用户管理
│   ├── GET  /list           # 用户列表
│   ├── GET  /:id            # 用户详情
│   ├── POST /update         # 更新用户
│   └── POST /delete         # 删除用户
├── /board                   # 板块管理
│   ├── GET  /list           # 板块列表
│   ├── GET  /:id            # 板块详情
│   ├── POST /create         # 创建板块
│   ├── POST /update         # 更新板块
│   └── POST /delete         # 删除板块
├── /post                    # 帖子管理
│   ├── GET  /list           # 帖子列表
│   ├── GET  /:id            # 帖子详情
│   ├── POST /audit          # 审核帖子
│   ├── POST /delete         # 删除帖子
│   └── POST /recommend      # 推荐帖子
├── /comment                 # 评论管理
│   ├── GET  /list           # 评论列表
│   └── POST /delete         # 删除评论
├── /audit                   # 内容审核
│   ├── GET  /list           # 审核列表
│   ├── POST /approve        # 通过审核
│   └── POST /reject         # 拒绝审核
├── /point                   # 积分管理
│   ├── GET  /list           # 积分列表
│   ├── POST /adjust         # 调整积分
│   └── POST /config         # 积分配置
├── /level                   # 等级管理
│   ├── GET  /list           # 等级列表
│   ├── POST /create         # 创建等级
│   ├── POST /update         # 更新等级
│   └── POST /delete         # 删除等级
├── /badge                   # 徽章管理
│   ├── GET  /list           # 徽章列表
│   ├── POST /create         # 创建徽章
│   ├── POST /update         # 更新徽章
│   └── POST /delete         # 删除徽章
├── /analytics               # 数据分析
│   ├── GET  /user           # 用户分析
│   ├── GET  /content        # 内容分析
│   └── GET  /activity       # 活跃度分析
└── /plugin                  # 插件管理
    ├── GET  /list           # 插件列表
    ├── POST /install        # 安装插件
    ├── POST /uninstall      # 卸载插件
    └── POST /config         # 插件配置
```

#### 3.3.2 客户端路由

```
/client/forum
├── /user                    # 用户管理
│   ├── POST /register       # 用户注册
│   ├── POST /login          # 用户登录
│   ├── GET  /profile        # 个人资料
│   ├── POST /update         # 更新资料
│   ├── GET  /level          # 等级信息
│   └── GET  /badges         # 徽章列表
├── /board                   # 板块管理
│   ├── GET  /list           # 板块列表
│   └── GET  /:id            # 板块详情
├── /post                    # 帖子管理
│   ├── GET  /list           # 帖子列表
│   ├── GET  /:id            # 帖子详情
│   ├── POST /create         # 发布帖子
│   ├── POST /update         # 更新帖子
│   └── POST /delete         # 删除帖子
├── /comment                 # 评论管理
│   ├── GET  /list           # 评论列表
│   ├── POST /create         # 发布评论
│   └── POST /delete         # 删除评论
├── /like                    # 点赞管理
│   ├── POST /post           # 点赞帖子
│   ├── POST /comment        # 点赞评论
│   └── POST /cancel         # 取消点赞
├── /search                  # 搜索管理
│   ├── POST /post           # 搜索帖子
│   ├── POST /user           # 搜索用户
│   └── GET  /hot            # 热门搜索
├── /notification            # 通知管理
│   ├── GET  /list           # 通知列表
│   ├── POST /read           # 标记已读
│   └── POST /read-all       # 全部已读
├── /point                   # 积分管理
│   ├── GET  /balance        # 积分余额
│   ├── GET  /log            # 积分记录
│   └── GET  /rank           # 积分排行
└── /api                     # 开放API
    ├── POST /auth           # API认证
    └── GET  /posts          # 获取帖子列表
```

### 3.4 缓存策略

#### 3.4.1 缓存键设计

```
forum:post:{postId}              # 帖子详情
forum:post:list:{page}:{size}    # 帖子列表
forum:post:hot                   # 热门帖子
forum:post:recommend             # 推荐帖子
forum:comment:list:{postId}      # 评论列表
forum:user:profile:{userId}      # 用户资料
forum:board:list                 # 板块列表
forum:search:hot                 # 热门搜索
forum:notification:list:{userId}  # 通知列表
forum:point:balance:{userId}     # 积分余额
forum:point:rank                 # 积分排行
```

#### 3.4.2 缓存策略

- **热门内容**: 长期缓存（1小时）
- **用户内容**: 短期缓存（5分钟）
- **列表数据**: 中期缓存（30分钟）
- **配置数据**: 长期缓存（1小时）
- **缓存失效**: 内容更新时主动失效

### 3.5 安全策略

#### 3.5.1 认证策略

- 使用JWT认证
- Token有效期: 7天
- Refresh Token有效期: 30天
- 独立的token策略区分论坛和漫画

#### 3.5.2 授权策略

- 基于角色的权限控制（RBAC）
- 角色定义: 普通用户、版主、管理员
- 权限装饰器: `@ForumRole()`
- 权限守卫: `ForumRoleGuard`

#### 3.5.3 防护策略

- **XSS防护**: 使用DOMPurify过滤富文本
- **CSRF防护**: 使用@nestjs/throttler限制请求频率
- **SQL注入防护**: 使用Prisma ORM参数化查询
- **防刷机制**: 
  - 频率限制: 每分钟最多10次请求
  - 验证码: 注册、登录、发帖时使用
  - IP限制: 异常IP封禁

#### 3.5.4 内容安全

- **敏感词过滤**: 基于正则表达式
- **内容审核**: 人工审核工作流
- **图片审核**: 集成第三方图片审核服务

### 3.6 搜索策略

#### 3.6.1 第一阶段

使用PostgreSQL全文搜索:
- 创建全文索引
- 使用 `tsvector` 和 `tsquery`
- 支持中文分词（使用zhparser插件）

#### 3.6.2 第二阶段

集成Elasticsearch:
- 索引设计
- 查询优化
- 高级搜索功能

## 4. 技术约束

### 4.1 技术栈约束

- **后端框架**: NestJS 11.x
- **HTTP服务器**: Fastify 5.x
- **ORM**: Prisma 7.x
- **数据库**: PostgreSQL
- **编程语言**: TypeScript 5.x
- **缓存**: Redis (cache-manager + keyv)
- **认证**: JWT + Passport
- **API文档**: Swagger
- **日志**: Winston
- **文件上传**: Fastify Multipart
- **安全**: Fastify Helmet, CSRF Protection, @nestjs/throttler

### 4.2 代码规范约束

- **模块化设计**: 每个功能独立成模块
- **分层架构**: Controller → Service → Repository
- **DTO验证**: 使用class-validator进行数据验证
- **装饰器使用**: 遵循现有装饰器规范
- **错误处理**: 使用标准异常类
- **数据库操作**: 继承RepositoryService复用通用方法
- **软删除**: 使用deletedAt字段
- **事务处理**: 复杂操作使用Prisma事务

### 4.3 数据库约束

- **命名规范**: 使用 `forum_` 前缀
- **字段规范**: 小写+下划线
- **索引规范**: 根据查询场景添加索引
- **软删除**: 使用 `deleted_at` 字段
- **时间字段**: 使用 `timestamptz` 类型

### 4.4 路由约束

- **管理后台**: `/admin/forum/{子模块}/{操作}`
- **客户端**: `/client/forum/{子模块}/{操作}`
- **RESTful风格**: GET（查询）、POST（创建/更新）、DELETE（删除）

### 4.5 性能约束

- **响应时间**: API响应时间 < 500ms
- **并发支持**: 支持1000+并发用户
- **缓存命中率**: 缓存命中率 > 80%
- **数据库查询**: 慢查询 < 100ms

### 4.6 安全约束

- **认证**: 使用JWT认证
- **授权**: 基于角色的权限控制
- **防护**: XSS防护、CSRF防护、SQL注入防护
- **防刷**: 频率限制、验证码、IP限制
- **内容安全**: 敏感词过滤、内容审核

## 5. 集成方案

### 5.1 用户系统集成

#### 5.1.1 用户表设计

复用现有的 `ClientUser` 表，添加论坛相关字段:

```prisma
model ClientUser {
  id                Int      @id @default(autoincrement())
  username          String   @unique
  email             String?  @unique
  password          String
  nickname          String?
  avatar            String?
  // ... 现有字段

  // 论坛相关字段
  forumRole         String   @default("user") // user, moderator, admin
  forumLevel        Int      @default(1)
  forumPoints       Int      @default(0)
  forumPostCount    Int      @default(0)
  forumCommentCount Int      @default(0)
  forumLikeCount    Int      @default(0)
  forumFollowCount  Int      @default(0)
  forumFollowerCount Int     @default(0)
  forumCreatedAt    DateTime @default(now())
  forumUpdatedAt    DateTime @updatedAt

  forumPosts        ForumPost[]
  forumComments     ForumComment[]
  forumLikes        ForumLike[]
  forumNotifications ForumNotification[]
  forumPointsLogs   ForumPointLog[]
  forumUserBadges   ForumUserBadge[]
}
```

#### 5.1.2 认证集成

复用现有的JWT认证体系，创建独立的token策略:

```typescript
// src/modules/forum/auth/strategies/forum-jwt.strategy.ts
@Injectable()
export class ForumJwtStrategy extends PassportStrategy(Strategy, 'forum-jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('FORUM_JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
```

### 5.2 文件上传集成

复用现有的上传模块:

```typescript
// src/modules/forum/post/dto/create-post.dto.ts
export class CreatePostDto {
  @ApiProperty({ description: '帖子标题' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: '帖子内容' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ description: '图片列表', type: [String] })
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}
```

### 5.3 缓存集成

复用现有的Redis缓存模块，使用独立的缓存键前缀:

```typescript
// src/modules/forum/core/forum-cache.service.ts
@Injectable()
export class ForumCacheService {
  constructor(private readonly cacheService: CacheService) {}

  async get(key: string): Promise<any> {
    return this.cacheService.get(`forum:${key}`);
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    return this.cacheService.set(`forum:${key}`, value, ttl);
  }

  async del(key: string): Promise<void> {
    return this.cacheService.del(`forum:${key}`);
  }
}
```

### 5.4 日志集成

复用现有的Winston日志模块:

```typescript
// src/modules/forum/core/forum-logger.service.ts
@Injectable()
export class ForumLoggerService {
  constructor(private readonly logger: Logger) {}

  log(message: string, context?: string) {
    this.logger.log(message, context || 'Forum');
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, trace, context || 'Forum');
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, context || 'Forum');
  }
}
```

### 5.5 API文档集成

复用现有的Swagger配置:

```typescript
// src/modules/forum/post/post.controller.ts
@ApiTags('论坛-帖子管理')
@Controller('client/forum/post')
export class PostController {
  @Post('create')
  @ApiOperation({ summary: '发布帖子' })
  @ApiDoc({ summary: '发布帖子', description: '用户发布新帖子' })
  async create(@Body() dto: CreatePostDto, @Request() req) {
    return this.postService.create(req.user.id, dto);
  }
}
```

## 6. 任务边界限制

### 6.1 功能边界

#### 6.1.1 包含的功能

**第一阶段（核心功能）**
- 用户管理（注册、登录、个人资料）
- 板块管理（板块分类、版主管理）
- 帖子管理（发布、编辑、删除、查看）
- 评论系统（发布、回复、删除）
- 点赞功能（帖子点赞、评论点赞）
- 搜索功能（帖子搜索、用户搜索）
- 通知系统（评论通知、点赞通知）

**第二阶段（社区功能）**
- 积分系统（积分获取、积分消费、积分记录）
- 等级系统（用户等级、等级权益）
- 徽章系统（徽章获取、徽章展示）
- 内容审核（敏感词过滤、人工审核）
- 数据分析（活跃度统计、用户行为分析）

**第三阶段（扩展功能）**
- 插件机制（插件接口、插件加载）
- API开放（开放API、API密钥管理）
- CDN加速（静态资源CDN）
- 缓存优化（Redis缓存策略）

#### 6.1.2 不包含的功能

- **前端界面**: 仅提供后端API，不包含前端页面
- **第三方登录**: 暂不集成微信、QQ等第三方登录
- **实时通讯**: 暂不实现WebSocket实时聊天
- **支付功能**: 暂不实现积分充值等支付功能
- **移动端**: 暂不提供移动端专用API
- **邮件通知**: 暂不实现邮件通知
- **推送通知**: 暂不实现推送通知

### 6.2 技术边界

#### 6.2.1 技术栈限制

- 必须使用现有技术栈（NestJS + Prisma + PostgreSQL）
- 必须使用现有数据库（PostgreSQL）
- 必须使用现有缓存（Redis）
- 必须使用现有认证体系（JWT）
- 必须使用现有上传模块

#### 6.2.2 架构限制

- 必须遵循现有项目架构（分层架构、模块化设计）
- 必须遵循现有代码规范（装饰器、DTO、错误处理）
- 必须遵循现有数据库规范（命名、索引、软删除）
- 必须遵循现有路由规范（路由前缀、RESTful风格）

### 6.3 时间边界

#### 6.3.1 开发阶段

- **第一阶段**: 核心功能开发（预计2-3周）
- **第二阶段**: 社区功能开发（预计2-3周）
- **第三阶段**: 扩展功能开发（预计1-2周）

#### 6.3.2 测试阶段

- **单元测试**: 每个功能开发完成后进行
- **集成测试**: 每个阶段完成后进行
- **性能测试**: 第二阶段完成后进行
- **安全测试**: 第三阶段完成后进行

### 6.4 资源边界

#### 6.4.1 人力资源

- **后端开发**: 1-2名开发人员
- **测试**: 1名测试人员
- **运维**: 1名运维人员

#### 6.4.2 服务器资源

- **数据库**: PostgreSQL数据库
- **缓存**: Redis缓存
- **文件存储**: 对象存储（OSS）
- **CDN**: CDN加速服务

## 7. 不确定性解决

### 7.1 用户体系问题

**问题**: 论坛用户是否需要独立的用户表，还是复用现有的ClientUser表？

**决策**: 复用ClientUser表，添加论坛相关字段

**理由**:
- 统一用户管理，数据一致性好
- 减少数据冗余，降低维护成本
- 便于用户在漫画和论坛之间切换

### 7.2 权限隔离问题

**问题**: 论坛权限系统如何与现有权限系统隔离？

**决策**: 创建独立的权限装饰器和守卫

**理由**:
- 完全隔离，互不影响
- 便于权限管理和扩展
- 符合架构隔离要求

### 7.3 数据库表前缀问题

**问题**: 论坛相关表是否需要统一的前缀？

**决策**: 使用 `forum_` 前缀

**理由**:
- 便于区分和管理
- 符合现有命名规范（漫画模块使用 `work_` 前缀）
- 便于数据库维护

### 7.4 路由前缀问题

**问题**: 论坛模块的路由前缀如何设计？

**决策**: 
- 管理后台: `/admin/forum/{子模块}/{操作}`
- 客户端: `/client/forum/{子模块}/{操作}`

**理由**:
- 符合现有路由规范
- 便于路由管理和扩展
- 清晰的模块划分

### 7.5 搜索功能问题

**问题**: 论坛搜索功能是否需要独立的搜索引擎？

**决策**: 第一阶段使用PostgreSQL全文搜索

**理由**:
- 快速实现，降低开发成本
- PostgreSQL全文搜索性能足够
- 后续可以升级到Elasticsearch

### 7.6 通知系统问题

**问题**: 论坛通知系统如何与现有通知系统集成？

**决策**: 创建独立的通知表，复用现有通知发送机制

**理由**:
- 完全隔离，互不影响
- 复用现有机制，降低开发成本
- 便于通知类型区分

### 7.7 内容审核问题

**问题**: 内容审核机制如何实现？

**决策**: 第一阶段实现敏感词过滤

**理由**:
- 快速实现，降低开发成本
- 基于正则表达式，易于维护
- 后续可以集成AI审核服务

### 7.8 积分系统问题

**问题**: 积分系统是否需要独立设计？

**决策**: 创建独立的积分系统

**理由**:
- 积分系统是社区激励的核心
- 需要支持多种积分获取和消费场景
- 需要积分记录和统计

### 7.9 等级和徽章问题

**问题**: 等级和徽章系统如何设计？

**决策**: 
- 等级系统: 基于积分自动升级
- 徽章系统: 基于事件触发

**理由**:
- 等级基于积分，简单易实现
- 徽章基于事件，灵活可扩展
- 符合社区最佳实践

### 7.10 缓存策略问题

**问题**: 论坛缓存策略如何设计？

**决策**: 
- 使用独立的缓存键前缀（如 `forum:`）
- 热门内容长期缓存
- 用户内容短期缓存
- 内容更新时主动失效缓存

**理由**:
- 与漫画模块缓存隔离
- 合理的缓存策略，提高性能
- 便于缓存管理和维护

## 8. 下一步行动

1. **设计系统架构**: 基于CONSENSUS文档设计论坛系统的整体架构
2. **制定功能清单**: 制定详细的功能清单供用户审核
3. **创建DESIGN文档**: 基于CONSENSUS文档创建设计文档
4. **创建TASK文档**: 基于DESIGN文档创建任务文档
5. **开始开发**: 按照TASK文档开始开发
