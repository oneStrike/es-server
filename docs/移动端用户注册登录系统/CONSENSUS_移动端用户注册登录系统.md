# CONSENSUS_移动端用户注册登录系统

## 1. 需求描述

为移动应用端（app-api）创建一套完整、安全且用户友好的注册登录流程系统。

### 1.1 核心功能
1. **用户注册**：支持账号、手机号、邮箱注册
2. **用户登录**：支持账号密码登录
3. **密码找回**：支持通过验证码找回密码
4. **会话管理**：JWT Token 生成、验证、刷新、黑名单管理
5. **数据初始化**：用户注册后自动初始化论坛资料

### 1.2 论坛集成
1. **论坛账户关联**：用户与 ForumProfile 自动关联
2. **论坛数据初始化**：初始化积分、经验、等级、统计数据
3. **论坛权限配置**：通过 status 字段控制用户状态

### 1.3 安全要求
1. 密码使用 Scrypt 加密存储
2. 敏感数据传输使用 RSA 加密
3. JWT Token 包含 jti、aud、iss 验证
4. Token 黑名单机制
5. 验证码机制（防暴力破解、防恶意注册）
6. 防 SQL 注入、XSS 攻击

## 2. 技术实现方案

### 2.1 技术栈
- **框架**: NestJS + Fastify
- **数据库**: PostgreSQL (Prisma ORM)
- **认证**: JWT (passport-jwt)
- **加密**: Scrypt (密码)、RSA (数据传输)
- **缓存**: Redis (验证码、Token黑名单)
- **验证**: class-validator + class-transformer

### 2.2 架构设计
采用分层架构：
- **Controller 层**: 处理 HTTP 请求和响应
- **Service 层**: 处理业务逻辑
- **Repository 层**: 使用 Prisma ORM 操作数据库

### 2.3 模块设计
创建以下模块：
1. **auth 模块**：认证相关（登录、注册、密码找回、Token 管理）
2. **user 模块**：用户相关（用户信息查询、更新）

### 2.4 接口设计

#### 2.4.1 公开接口（使用 @Public()）
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出
- `POST /api/auth/refresh-token` - 刷新 Token
- `POST /api/auth/forgot-password` - 找回密码（获取验证码）
- `POST /api/auth/reset-password` - 重置密码
- `GET /api/auth/captcha` - 获取验证码
- `GET /api/auth/public-key` - 获取 RSA 公钥

#### 2.4.2 需要认证的接口
- `GET /api/user/profile` - 获取用户信息
- `PUT /api/user/profile` - 更新用户信息（可选，不在本次任务范围）

### 2.5 数据流程

#### 2.5.1 注册流程
```
用户输入 → RSA加密 → 验证码验证 → 账号唯一性验证 → 密码加密 → 创建AppUser → 创建ForumProfile → 生成Token → 返回用户信息
```

#### 2.5.2 登录流程
```
用户输入 → RSA加密 → 验证码验证 → 账号密码验证 → 更新登录信息 → 生成Token → 返回用户信息
```

#### 2.5.3 密码找回流程
```
用户输入账号 → 验证账号存在 → 生成验证码 → 用户输入验证码和新密码 → 验证码验证 → 密码加密 → 更新密码
```

### 2.6 数据模型

#### 2.6.1 AppUser（已存在）
```typescript
{
  id: number
  account: string          // 登录账号
  nickname: string        // 昵称
  avatar?: string         // 头像
  phone?: string          // 手机号（可选，唯一）
  email?: string          // 邮箱（可选，唯一）
  password: string        // 密码（Scrypt加密）
  isEnabled: boolean      // 是否启用
  gender: number         // 性别
  birthDate?: Date       // 出生日期
  isSignedIn: boolean    // 是否签到
  lastLoginAt?: Date     // 最后登录时间
  lastLoginIp?: string   // 最后登录IP
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}
```

#### 2.6.2 ForumProfile（已存在）
```typescript
{
  id: number
  userId: number         // 关联 AppUser.id
  points: number         // 积分
  experience: number     // 经验值
  levelId: number       // 等级ID
  topicCount: number     // 主题数
  replyCount: number     // 回复数
  likeCount: number     // 点赞数
  favoriteCount: number  // 收藏数
  signature: string     // 签名
  bio: string          // 个人简介
  status: number       // 状态（1:正常, 2:封禁）
  banReason?: string   // 封禁原因
  banUntil?: Date     // 封禁结束时间
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}
```

## 3. 技术约束

### 3.1 必须使用的现有服务
- [AuthService](file:///d:/code/es/es-server/libs/base/src/modules/auth/auth.service.ts) - JWT Token 生成和管理
- [ScryptService](file:///d:/code/es/es-server/libs/base/src/modules/crypto/scrypt.service.ts) - 密码加密和验证
- [CaptchaService](file:///d:/code/es/es-server/libs/base/src/modules/captcha/captcha.service.ts) - 验证码生成和验证
- [RsaService](file:///d:/code/es/es-server/libs/base/src/modules/crypto/rsa.service.ts) - RSA 加密解密

### 3.2 必须遵循的代码规范
- 使用 `BaseService` 作为服务基类
- 使用装饰器进行参数验证（@ValidateString、@ValidateNumber 等）
- 使用 `@ApiDoc` 和 `@ApiTags` 进行 Swagger 文档注解
- 使用 `@Public()` 标记公开接口
- 使用 `@Audit()` 装饰器记录审计日志
- DTO 继承 `BaseDto`，使用 `PickType`、`PartialType`、`IntersectionType` 组合

### 3.3 必须遵循的安全规范
- 密码使用 Scrypt 加密存储
- 敏感数据传输使用 RSA 加密
- JWT Token 包含 jti、aud、iss 验证
- Token 黑名单机制
- 验证码机制
- 防 SQL 注入（使用 Prisma ORM）
- 防 XSS 攻击（前端转义，后端验证）

## 4. 集成方案

### 4.1 与现有系统集成
- **认证系统**：复用现有的 JwtAuthGuard 和 AuthStrategy
- **数据库**：使用现有的 AppUser 和 ForumProfile 模型
- **缓存**：使用现有的 Redis 配置
- **配置**：使用现有的 AuthConfig

### 4.2 模块依赖关系
```
app-api
├── auth.module
│   ├── auth.controller
│   ├── auth.service
│   └── dto/
│       ├── auth.dto.ts
│       └── user.dto.ts
└── user.module
    ├── user.controller
    ├── user.service
    └── dto/
        └── user.dto.ts
```

### 4.3 数据库事务
用户注册时需要同时创建 AppUser 和 ForumProfile，必须使用事务确保数据一致性。

## 5. 任务边界限制

### 5.1 包含的功能
- ✅ 用户注册（账号、手机号、邮箱）
- ✅ 用户登录（账号密码）
- ✅ 密码找回（验证码方式）
- ✅ Token 管理（生成、验证、刷新、黑名单）
- ✅ 验证码机制
- ✅ 论坛资料初始化
- ✅ 接口鉴权
- ✅ 错误处理和用户提示

### 5.2 不包含的功能
- ❌ 第三方登录（微信、QQ、Google等）
- ❌ 短信验证码服务集成
- ❌ 邮件发送服务集成
- ❌ 用户资料修改（昵称、头像等）
- ❌ 论坛发帖、回复等业务功能
- ❌ 管理端用户管理功能
- ❌ 复杂的角色权限系统

## 6. 验收标准

### 6.1 功能验收
- [ ] 用户能够成功注册账号
- [ ] 用户能够成功登录
- [ ] 用户能够找回密码
- [ ] 用户能够刷新 Token
- [ ] 用户能够退出登录
- [ ] 用户注册后自动创建论坛资料
- [ ] 论坛资料初始化正确（积分、等级、统计数据）

### 6.2 安全验收
- [ ] 密码使用 Scrypt 加密存储
- [ ] 敏感数据传输使用 RSA 加密
- [ ] Token 包含 jti、aud、iss 验证
- [ ] Token 黑名单机制正常工作
- [ ] 验证码机制正常工作
- [ ] 防 SQL 注入
- [ ] 防 XSS 攻击
- [ ] 防暴力破解

### 6.3 性能验收
- [ ] 注册接口响应时间 < 500ms
- [ ] 登录接口响应时间 < 300ms
- [ ] Token 刷新接口响应时间 < 200ms
- [ ] 数据库查询优化

### 6.4 代码质量验收
- [ ] 代码符合 ESLint 规范
- [ ] 代码符合 Prettier 规范
- [ ] 代码符合 TypeScript 严格模式
- [ ] 测试覆盖率 > 80%
- [ ] Swagger 文档完整

### 6.5 文档验收
- [ ] API 文档完整（Swagger）
- [ ] 代码注释完整
- [ ] README 文档更新

## 7. 风险评估

### 7.1 技术风险
- **风险**：论坛等级初始化时可能找不到默认等级
- **应对**：添加容错逻辑，如果找不到"初级会员"，则使用 ID 为 1 的等级，如果还不存在则抛出错误

### 7.2 安全风险
- **风险**：验证码可能被暴力破解
- **应对**：限制验证码获取频率，设置验证码过期时间（1分钟）

### 7.3 性能风险
- **风险**：注册时需要同时创建 AppUser 和 ForumProfile，可能影响性能
- **应对**：使用数据库事务，优化查询语句

## 8. 不确定性确认

### 8.1 已确认的问题
- ✅ 注册方式：支持账号、手机号、邮箱注册
- ✅ 验证码使用场景：注册、登录、密码找回都需要
- ✅ 密码找回方式：验证码验证流程（不集成短信或邮件服务）
- ✅ 论坛等级初始化：使用"初级会员"等级
- ✅ 第三方登录：不在本次任务范围
- ✅ 用户资料修改：不在本次任务范围
- ✅ 论坛权限配置：通过 status 字段控制

### 8.2 所有不确定性已解决
所有关键决策点已确认，可以进入下一阶段。
