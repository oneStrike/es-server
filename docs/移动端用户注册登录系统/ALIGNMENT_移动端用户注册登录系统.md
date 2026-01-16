# ALIGNMENT_移动端用户注册登录系统

## 1. 项目上下文分析

### 1.1 技术栈
- **框架**: NestJS + Fastify
- **数据库**: PostgreSQL (Prisma ORM)
- **语言**: TypeScript
- **认证**: JWT (passport-jwt)
- **加密**: Scrypt (密码加密)、RSA (数据传输加密)
- **缓存**: Redis (验证码、Token黑名单)
- **验证**: class-validator + class-transformer

### 1.2 现有基础设施

#### 已有服务组件
- [AuthService](file:///d:/code/es/es-server/libs/base/src/modules/auth/auth.service.ts) - JWT Token生成和管理
- [ScryptService](file:///d:/code/es/es-server/libs/base/src/modules/crypto/scrypt.service.ts) - 密码加密和验证
- [CaptchaService](file:///d:/code/es/es-server/libs/base/src/modules/captcha/captcha.service.ts) - SVG验证码生成和验证
- [RsaService](file:///d:/code/es/es-server/libs/base/src/modules/crypto/rsa.service.ts) - RSA加密解密
- [JwtAuthGuard](file:///d:/code/es/es-server/libs/base/src/modules/auth/auth.guard.ts) - JWT认证守卫
- [AuthStrategy](file:///d:/code/es/es-server/libs/base/src/modules/auth/auth.strategy.ts) - JWT验证策略
- [@Public()](file:///d:/code/es/es-server/libs/base/src/decorators/public.decorator.ts) - 公开路由装饰器

#### 已有数据模型
- [AppUser](file:///d:/code/es/es-server/libs/base/src/database/prisma-client/models/AppUser.ts) - 用户基础信息表
  - 字段：id, account, nickname, avatar, phone, email, password, isEnabled, gender, birthDate, isSignedIn, lastLoginAt, lastLoginIp, createdAt, updatedAt, deletedAt
- [ForumProfile](file:///d:/code/es/es-server/libs/base/src/database/prisma-client/models/ForumProfile.ts) - 论坛用户资料表
  - 字段：id, userId, points, experience, levelId, topicCount, replyCount, likeCount, favoriteCount, signature, bio, status, banReason, banUntil, createdAt, updatedAt, deletedAt

#### 已有论坛服务
- [UserService](file:///d:/code/es/es-server/libs/forum/src/user/user.service.ts) - 论坛用户服务
- [PointService](file:///d:/code/es/es-server/libs/forum/src/point/point.service.ts) - 论坛积分服务

### 1.3 现有代码模式
- 使用 `BaseService` 作为服务基类，提供 Prisma 客户端
- 使用 `@ValidateString`、`@ValidateNumber` 等装饰器进行参数验证
- 使用 `@ApiDoc` 和 `@ApiTags` 进行 Swagger 文档注解
- 使用 `@Public()` 标记公开接口
- 使用 `@Audit` 装饰器记录审计日志
- DTO 继承 `BaseDto`，使用 `PickType`、`PartialType`、`IntersectionType` 组合

## 2. 原始需求

为移动应用端客户创建一套完整、安全且用户友好的注册登录流程系统。该系统需包含以下核心功能模块：

### 2.1 核心功能模块
1. **用户注册** - 支持用户账号注册
2. **用户登录** - 支持账号密码登录
3. **密码找回** - 支持找回密码功能
4. **会话管理** - Token管理和刷新
5. **数据初始化** - 用户注册后的数据初始化

### 2.2 论坛相关功能
1. **论坛账户关联** - 用户与论坛资料关联
2. **论坛权限配置** - 论坛用户权限设置
3. **论坛数据初始化** - 论坛积分、等级等初始化

### 2.3 安全要求
1. 遵循行业安全标准
2. 用户数据加密存储
3. 防SQL注入、XSS攻击等安全防护
4. 清晰的错误提示和用户引导

## 3. 边界确认

### 3.1 任务范围
**包含**：
- app-api 下的用户注册、登录、密码找回功能
- 用户与论坛资料的关联和初始化
- JWT Token 的生成、验证、刷新、黑名单管理
- 验证码功能（注册、登录、密码找回）
- 密码加密存储（Scrypt）
- 数据传输加密（RSA）
- 接口鉴权和权限控制
- 错误处理和用户提示

**不包含**：
- 第三方登录（微信、QQ、Google等）
- 短信验证码服务集成
- 邮件发送服务集成
- 用户资料管理（昵称、头像等修改）
- 论坛发帖、回复等业务功能
- 管理端用户管理功能

### 3.2 技术约束
- 必须使用现有的 AuthService、ScryptService、CaptchaService、RsaService
- 必须遵循现有的代码规范和架构模式
- 必须使用 Prisma ORM 操作数据库
- 必须使用 JWT 进行认证
- 必须使用 @Public() 标记公开接口

## 4. 需求理解

### 4.1 用户注册流程
1. 用户输入账号、密码、昵称、手机号（可选）、邮箱（可选）
2. 前端使用 RSA 公钥加密密码
3. 后端验证账号唯一性
4. 后端验证验证码（如果启用）
5. 后端使用 Scrypt 加密密码
6. 创建 AppUser 记录
7. 创建 ForumProfile 记录（初始化积分、等级等）
8. 返回用户信息和 Token

### 4.2 用户登录流程
1. 用户输入账号、密码、验证码
2. 前端使用 RSA 公钥加密密码
3. 后端验证验证码
4. 后端验证账号密码
5. 更新登录信息（lastLoginAt、lastLoginIp）
6. 生成 Access Token 和 Refresh Token
7. 返回用户信息和 Token

### 4.3 密码找回流程
1. 用户输入账号
2. 后端验证账号存在
3. 后端生成验证码（通过短信或邮箱发送，此处仅生成验证码）
4. 用户输入验证码和新密码
5. 后端验证验证码
6. 后端更新密码（使用 Scrypt 加密）

### 4.4 会话管理
1. Access Token 有效期：4小时（可配置）
2. Refresh Token 有效期：7天（可配置）
3. Token 黑名单机制（退出登录时将 Token 加入黑名单）
4. Token 刷新机制（使用 Refresh Token 获取新的 Access Token）

### 4.5 论坛数据初始化
1. 用户注册时自动创建 ForumProfile
2. 初始积分为 0
3. 初始经验值为 0
4. 初始等级为系统默认等级（如"初级会员"）
5. 初始统计数据（主题数、回复数、点赞数、收藏数）为 0
6. 初始签名和个人简介为默认值

## 5. 疑问澄清

### 5.1 注册方式
**问题**：注册时是否支持手机号或邮箱作为登录账号？

**决策**：基于现有 AppUser 模型，支持以下注册方式：
- 账号注册（account 字段，必填）
- 手机号注册（phone 字段，可选，但需要唯一性验证）
- 邮箱注册（email 字段，可选，但需要唯一性验证）

### 5.2 验证码使用场景
**问题**：注册、登录、密码找回是否都需要验证码？

**决策**：
- **注册**：需要验证码（防止恶意注册）
- **登录**：需要验证码（防止暴力破解）
- **密码找回**：需要验证码（验证用户身份）

### 5.3 密码找回方式
**问题**：密码找回是通过手机验证码还是邮箱验证码？

**决策**：基于现有基础设施，暂时实现验证码验证流程，不集成短信或邮件服务。验证码生成后，用户需要通过其他方式获取（如测试环境直接读取缓存）。

### 5.4 论坛等级初始化
**问题**：新用户注册时的默认论坛等级是什么？

**决策**：从 `ForumLevelRule` 表中查找名称为"初级会员"的等级，如果不存在则使用 ID 为 1 的等级。

### 5.5 第三方登录
**问题**：是否需要支持第三方登录（微信、QQ、Google等）？

**决策**：不在本次任务范围内，后续可扩展。

### 5.6 用户资料修改
**问题**：是否需要支持用户修改昵称、头像、手机号、邮箱等资料？

**决策**：不在本次任务范围内，后续可扩展。

### 5.7 论坛权限配置
**问题**：论坛权限配置具体指什么？是否需要角色权限系统？

**决策**：基于现有 ForumProfile 模型，权限主要通过 status 字段控制（正常、封禁等）。本次任务不实现复杂的角色权限系统。

## 6. 项目特性规范

### 6.1 代码规范
- 使用 TypeScript 严格模式
- 遵循 ESLint 和 Prettier 配置
- 使用装饰器进行参数验证（@ValidateString、@ValidateNumber 等）
- 使用 Swagger 注解生成 API 文档
- 使用 `@Public()` 标记公开接口
- 使用 `@Audit()` 记录审计日志（登录、注册等）

### 6.2 安全规范
- 密码使用 Scrypt 加密存储
- 敏感数据传输使用 RSA 加密
- JWT Token 包含 jti（token ID）用于黑名单管理
- Token 包含 aud（audience）和 iss（issuer）验证
- 验证码存储在 Redis 中，设置过期时间
- 防止 SQL 注入（使用 Prisma ORM）
- 防止 XSS 攻击（前端转义，后端验证）
- 防止暴力破解（验证码 + 登录失败锁定）

### 6.3 数据库规范
- 使用 Prisma ORM 操作数据库
- 使用事务确保数据一致性
- 使用软删除（deletedAt 字段）
- 使用时间戳（createdAt、updatedAt）
- 使用唯一索引防止重复数据

### 6.4 API 规范
- RESTful API 设计
- 统一错误处理（HttpExceptionFilter）
- 统一响应格式
- 使用 Swagger 文档
- 接口版本控制（/api/v1）

### 6.5 测试规范
- 编写单元测试
- 编写集成测试
- 测试覆盖率要求：>80%
- 使用 Jest 测试框架

## 7. 验收标准

### 7.1 功能验收
- [ ] 用户能够成功注册账号
- [ ] 用户能够成功登录
- [ ] 用户能够找回密码
- [ ] 用户能够刷新 Token
- [ ] 用户能够退出登录
- [ ] 用户注册后自动创建论坛资料
- [ ] 论坛资料初始化正确（积分、等级、统计数据）

### 7.2 安全验收
- [ ] 密码使用 Scrypt 加密存储
- [ ] 敏感数据传输使用 RSA 加密
- [ ] Token 包含 jti、aud、iss 验证
- [ ] Token 黑名单机制正常工作
- [ ] 验证码机制正常工作
- [ ] 防止 SQL 注入
- [ ] 防止 XSS 攻击
- [ ] 防止暴力破解

### 7.3 性能验收
- [ ] 注册接口响应时间 < 500ms
- [ ] 登录接口响应时间 < 300ms
- [ ] Token 刷新接口响应时间 < 200ms
- [ ] 数据库查询优化

### 7.4 代码质量验收
- [ ] 代码符合 ESLint 规范
- [ ] 代码符合 Prettier 规范
- [ ] 代码符合 TypeScript 严格模式
- [ ] 测试覆盖率 > 80%
- [ ] Swagger 文档完整

### 7.5 文档验收
- [ ] API 文档完整（Swagger）
- [ ] 代码注释完整
- [ ] README 文档更新
