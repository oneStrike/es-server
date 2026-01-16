# DESIGN_移动端用户注册登录系统

## 1. 整体架构图

```mermaid
graph TB
    subgraph "客户端"
        A[移动应用]
    end

    subgraph "API Gateway"
        B[Fastify Server]
    end

    subgraph "Controller 层"
        C[AuthController]
        D[UserController]
    end

    subgraph "Service 层"
        E[AuthService]
        F[UserService]
    end

    subgraph "基础服务"
        G[BaseAuthService]
        H[ScryptService]
        I[CaptchaService]
        J[RsaService]
        K[JwtBlacklistService]
    end

    subgraph "数据层"
        L[(PostgreSQL)]
        M[(Redis)]
    end

    A --> B
    B --> C
    B --> D
    C --> E
    D --> F
    E --> G
    E --> H
    E --> I
    E --> J
    E --> K
    F --> L
    E --> L
    I --> M
    K --> M
```

## 2. 分层设计

### 2.1 Controller 层
负责处理 HTTP 请求和响应，参数验证，调用 Service 层。

#### AuthController
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出
- `POST /api/auth/refresh-token` - 刷新 Token
- `POST /api/auth/forgot-password` - 找回密码（获取验证码）
- `POST /api/auth/reset-password` - 重置密码
- `GET /api/auth/captcha` - 获取验证码
- `GET /api/auth/public-key` - 获取 RSA 公钥

#### UserController
- `GET /api/user/profile` - 获取用户信息

### 2.2 Service 层
负责业务逻辑处理，调用基础服务和数据层。

#### AuthService
- `register()` - 用户注册
- `login()` - 用户登录
- `logout()` - 用户登出
- `refreshToken()` - 刷新 Token
- `forgotPassword()` - 找回密码（生成验证码）
- `resetPassword()` - 重置密码
- `initForumProfile()` - 初始化论坛资料

#### UserService
- `getUserProfile()` - 获取用户信息

### 2.3 基础服务层
提供通用的功能服务。

#### BaseAuthService
- `generateTokens()` - 生成 Access Token 和 Refresh Token
- `refreshAccessToken()` - 刷新 Access Token
- `logout()` - 退出登录（将 Token 加入黑名单）
- `addToBlacklist()` - 将 Token 加入黑名单

#### ScryptService
- `encryptPassword()` - 加密密码
- `verifyPassword()` - 验证密码

#### CaptchaService
- `generateSvgCaptcha()` - 生成 SVG 验证码
- `verify()` - 验证验证码
- `remove()` - 删除验证码

#### RsaService
- `getPublicKey()` - 获取 RSA 公钥
- `decryptWith()` - 使用 RSA 私钥解密

#### JwtBlacklistService
- `addBlacklist()` - 将 Token 加入黑名单
- `isInBlacklist()` - 检查 Token 是否在黑名单中

### 2.4 数据层
负责数据持久化和缓存。

#### PostgreSQL
- AppUser 表
- ForumProfile 表
- ForumLevelRule 表

#### Redis
- 验证码缓存
- Token 黑名单

## 3. 核心组件

### 3.1 AuthController
负责处理认证相关的 HTTP 请求。

```typescript
@Controller('api/auth')
@ApiTags('认证模块')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rsaService: RsaService,
  ) {}

  @Post('register')
  @Public()
  @ApiDoc({ summary: '用户注册', model: RegisterResponseDto })
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  @Public()
  @ApiDoc({ summary: '用户登录', model: LoginResponseDto })
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('logout')
  @ApiDoc({ summary: '用户登出', model: Boolean })
  async logout(@Body() body: TokenDto) {
    return this.authService.logout(body);
  }

  @Post('refresh-token')
  @Public()
  @ApiDoc({ summary: '刷新 Token', model: TokenDto })
  async refreshToken(@Body() body: RefreshTokenDto) {
    return this.authService.refreshToken(body);
  }

  @Post('forgot-password')
  @Public()
  @ApiDoc({ summary: '找回密码（获取验证码）', model: CaptchaDto })
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body);
  }

  @Post('reset-password')
  @Public()
  @ApiDoc({ summary: '重置密码', model: Boolean })
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body);
  }

  @Get('captcha')
  @Public()
  @ApiDoc({ summary: '获取验证码', model: CaptchaDto })
  async getCaptcha() {
    return this.authService.getCaptcha();
  }

  @Get('public-key')
  @Public()
  @ApiDoc({ summary: '获取 RSA 公钥', model: RsaPublicKeyDto })
  getPublicKey() {
    return { publicKey: this.rsaService.getPublicKey() };
  }
}
```

### 3.2 AuthService
负责处理认证相关的业务逻辑。

```typescript
@Injectable()
export class AuthService extends BaseService {
  constructor(
    private readonly baseAuthService: BaseAuthService,
    private readonly scryptService: ScryptService,
    private readonly captchaService: CaptchaService,
    private readonly rsaService: RsaService,
  ) {
    super();
  }

  async register(body: RegisterDto) {
    // 1. 验证验证码
    await this.verifyCaptcha(body.captchaId, body.captcha);

    // 2. 验证账号唯一性
    await this.validateAccountUnique(body.account, body.phone, body.email);

    // 3. 解密密码
    const password = this.rsaService.decryptWith(body.password);

    // 4. 加密密码
    const hashedPassword = await this.scryptService.encryptPassword(password);

    // 5. 创建用户和论坛资料（使用事务）
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.appUser.create({
        data: {
          account: body.account,
          nickname: body.nickname,
          password: hashedPassword,
          phone: body.phone,
          email: body.email,
          gender: body.gender,
          isEnabled: true,
        },
      });

      await this.initForumProfile(tx, newUser.id);

      return newUser;
    });

    // 6. 生成 Token
    const tokens = await this.baseAuthService.generateTokens({
      sub: String(user.id),
      account: user.account,
    });

    // 7. 返回用户信息和 Token
    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  async login(body: LoginDto) {
    // 1. 验证验证码
    await this.verifyCaptcha(body.captchaId, body.captcha);

    // 2. 查找用户
    const user = await this.prisma.appUser.findUnique({
      where: { account: body.account },
    });

    if (!user) {
      throw new BadRequestException('账号或密码错误');
    }

    // 3. 解密密码
    const password = this.rsaService.decryptWith(body.password);

    // 4. 验证密码
    const isValid = await this.scryptService.verifyPassword(password, user.password);
    if (!isValid) {
      throw new BadRequestException('账号或密码错误');
    }

    // 5. 更新登录信息
    await this.prisma.appUser.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: extractIpAddress(),
      },
    });

    // 6. 生成 Token
    const tokens = await this.baseAuthService.generateTokens({
      sub: String(user.id),
      account: user.account,
    });

    // 7. 返回用户信息和 Token
    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  async logout(body: TokenDto) {
    return this.baseAuthService.logout(body.accessToken, body.refreshToken);
  }

  async refreshToken(body: RefreshTokenDto) {
    return this.baseAuthService.refreshAccessToken(body.refreshToken);
  }

  async forgotPassword(body: ForgotPasswordDto) {
    // 1. 验证账号存在
    const user = await this.prisma.appUser.findFirst({
      where: {
        OR: [
          { account: body.account },
          { phone: body.account },
          { email: body.account },
        ],
      },
    });

    if (!user) {
      throw new BadRequestException('账号不存在');
    }

    // 2. 生成验证码
    return this.captchaService.generateSvgCaptcha('forgot-password:');
  }

  async resetPassword(body: ResetPasswordDto) {
    // 1. 验证验证码
    await this.verifyCaptcha(body.captchaId, body.captcha);

    // 2. 查找用户
    const user = await this.prisma.appUser.findFirst({
      where: {
        OR: [
          { account: body.account },
          { phone: body.account },
          { email: body.account },
        ],
      },
    });

    if (!user) {
      throw new BadRequestException('账号不存在');
    }

    // 3. 解密密码
    const password = this.rsaService.decryptWith(body.password);

    // 4. 加密密码
    const hashedPassword = await this.scryptService.encryptPassword(password);

    // 5. 更新密码
    await this.prisma.appUser.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return true;
  }

  async getCaptcha() {
    return this.captchaService.generateSvgCaptcha('auth:');
  }

  private async verifyCaptcha(captchaId: string, captcha: string) {
    const isValid = await this.captchaService.verify('auth:', captchaId, captcha);
    if (!isValid) {
      throw new BadRequestException('验证码错误');
    }
    await this.captchaService.remove('auth:', captchaId);
  }

  private async validateAccountUnique(account: string, phone?: string, email?: string) {
    const existingUser = await this.prisma.appUser.findFirst({
      where: {
        OR: [
          { account },
          { phone },
          { email },
        ].filter(Boolean),
      },
    });

    if (existingUser) {
      if (existingUser.account === account) {
        throw new BadRequestException('账号已存在');
      }
      if (existingUser.phone === phone) {
        throw new BadRequestException('手机号已注册');
      }
      if (existingUser.email === email) {
        throw new BadRequestException('邮箱已注册');
      }
    }
  }

  private async initForumProfile(tx: any, userId: number) {
    // 查找默认等级
    const level = await tx.forumLevelRule.findFirst({
      where: { name: '初级会员' },
    });

    if (!level) {
      throw new BadRequestException('系统配置错误：找不到默认论坛等级');
    }

    // 创建论坛资料
    await tx.forumProfile.create({
      data: {
        userId,
        points: 0,
        experience: 0,
        levelId: level.id,
        topicCount: 0,
        replyCount: 0,
        likeCount: 0,
        favoriteCount: 0,
        signature: '这是我的个人签名',
        bio: '这是我的个人简介',
        status: 1,
      },
    });
  }

  private sanitizeUser(user: any) {
    const { password, ...sanitized } = user;
    return sanitized;
  }
}
```

## 4. 模块依赖关系图

```mermaid
graph LR
    A[AuthModule] --> B[JwtAuthModule]
    A --> C[BaseModule]
    D[UserModule] --> C
    B --> E[PassportModule]
    B --> F[JwtModule]
    C --> G[PrismaModule]
    C --> H[CacheModule]
```

## 5. 接口契约定义

### 5.1 用户注册接口

**请求**
```typescript
POST /api/auth/register
Content-Type: application/json

{
  "account": "user123",
  "nickname": "张三",
  "password": "加密后的密码",
  "phone": "13800000000",
  "email": "user@example.com",
  "gender": 1,
  "captchaId": "uuid",
  "captcha": "1234"
}
```

**响应**
```typescript
{
  "user": {
    "id": 1,
    "account": "user123",
    "nickname": "张三",
    "avatar": null,
    "phone": "13800000000",
    "email": "user@example.com",
    "isEnabled": true,
    "gender": 1,
    "birthDate": null,
    "isSignedIn": false,
    "lastLoginAt": null,
    "lastLoginIp": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 5.2 用户登录接口

**请求**
```typescript
POST /api/auth/login
Content-Type: application/json

{
  "account": "user123",
  "password": "加密后的密码",
  "captchaId": "uuid",
  "captcha": "1234"
}
```

**响应**
```typescript
{
  "user": {
    "id": 1,
    "account": "user123",
    "nickname": "张三",
    "avatar": null,
    "phone": "13800000000",
    "email": "user@example.com",
    "isEnabled": true,
    "gender": 1,
    "birthDate": null,
    "isSignedIn": false,
    "lastLoginAt": "2024-01-01T00:00:00.000Z",
    "lastLoginIp": "192.168.1.1",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 5.3 用户登出接口

**请求**
```typescript
POST /api/auth/logout
Content-Type: application/json
Authorization: Bearer {accessToken}

{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**响应**
```typescript
true
```

### 5.4 刷新 Token 接口

**请求**
```typescript
POST /api/auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**响应**
```typescript
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 5.5 找回密码接口

**请求**
```typescript
POST /api/auth/forgot-password
Content-Type: application/json

{
  "account": "user123"
}
```

**响应**
```typescript
{
  "captcha": "data:image/svg+xml;base64,...",
  "captchaId": "uuid"
}
```

### 5.6 重置密码接口

**请求**
```typescript
POST /api/auth/reset-password
Content-Type: application/json

{
  "account": "user123",
  "password": "加密后的密码",
  "captchaId": "uuid",
  "captcha": "1234"
}
```

**响应**
```typescript
true
```

### 5.7 获取验证码接口

**请求**
```typescript
GET /api/auth/captcha
```

**响应**
```typescript
{
  "captcha": "data:image/svg+xml;base64,...",
  "captchaId": "uuid"
}
```

### 5.8 获取 RSA 公钥接口

**请求**
```typescript
GET /api/auth/public-key
```

**响应**
```typescript
{
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA..."
}
```

## 6. 数据流向图

### 6.1 注册流程

```mermaid
sequenceDiagram
    participant Client
    participant Controller
    participant Service
    participant Captcha
    participant RSA
    participant Scrypt
    participant DB
    participant JWT

    Client->>Controller: POST /register
    Controller->>Service: register(dto)
    Service->>Captcha: verify(captchaId, captcha)
    Captcha-->>Service: true/false
    Service->>DB: check account unique
    DB-->>Service: true/false
    Service->>RSA: decrypt(password)
    RSA-->>Service: plaintext password
    Service->>Scrypt: encrypt(password)
    Scrypt-->>Service: hashed password
    Service->>DB: transaction (create user + forum profile)
    DB-->>Service: user
    Service->>JWT: generateTokens(payload)
    JWT-->>Service: tokens
    Service-->>Controller: {user, tokens}
    Controller-->>Client: response
```

### 6.2 登录流程

```mermaid
sequenceDiagram
    participant Client
    participant Controller
    participant Service
    participant Captcha
    participant RSA
    participant Scrypt
    participant DB
    participant JWT

    Client->>Controller: POST /login
    Controller->>Service: login(dto)
    Service->>Captcha: verify(captchaId, captcha)
    Captcha-->>Service: true/false
    Service->>DB: find user by account
    DB-->>Service: user
    Service->>RSA: decrypt(password)
    RSA-->>Service: plaintext password
    Service->>Scrypt: verify(password, hashedPassword)
    Scrypt-->>Service: true/false
    Service->>DB: update lastLoginAt, lastLoginIp
    DB-->>Service: updated user
    Service->>JWT: generateTokens(payload)
    JWT-->>Service: tokens
    Service-->>Controller: {user, tokens}
    Controller-->>Client: response
```

## 7. 异常处理策略

### 7.1 异常类型
- `BadRequestException` - 参数错误、验证失败
- `UnauthorizedException` - 未授权、Token 无效
- `NotFoundException` - 资源不存在
- `ConflictException` - 资源冲突（账号已存在）

### 7.2 异常处理流程
1. Service 层抛出业务异常
2. Controller 层捕获异常（可选）
3. 全局异常过滤器处理
4. 返回统一的错误响应格式

### 7.3 错误响应格式
```typescript
{
  "statusCode": 400,
  "message": "账号已存在",
  "error": "Bad Request",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/auth/register"
}
```

### 7.4 用户友好的错误提示
- "账号已存在" - 而不是 "Duplicate entry"
- "验证码错误" - 而不是 "Invalid captcha"
- "账号或密码错误" - 而不是 "Authentication failed"
- "密码长度至少为8个字符" - 而不是 "Password too short"

## 8. 安全设计

### 8.1 密码安全
- 使用 Scrypt 算法加密密码
- 密码长度至少 8 个字符
- 密码不返回给前端
- 密码传输使用 RSA 加密

### 8.2 Token 安全
- Access Token 有效期：4小时
- Refresh Token 有效期：7天
- Token 包含 jti（token ID）用于黑名单管理
- Token 包含 aud（audience）和 iss（issuer）验证
- Token 退出时加入黑名单

### 8.3 验证码安全
- 验证码长度：4位
- 验证码过期时间：1分钟
- 验证码使用后立即删除
- 验证码存储在 Redis 中

### 8.4 防 SQL 注入
- 使用 Prisma ORM
- 使用参数化查询
- 不拼接 SQL 字符串

### 8.5 防 XSS 攻击
- 前端转义用户输入
- 后端验证用户输入
- 使用 class-validator 验证

### 8.6 防暴力破解
- 登录需要验证码
- 验证码过期时间短（1分钟）
- 限制验证码获取频率（可选）

## 9. 性能优化

### 9.1 数据库优化
- 使用索引加速查询（account、phone、email）
- 使用事务确保数据一致性
- 使用批量操作减少数据库访问

### 9.2 缓存优化
- 验证码存储在 Redis 中
- Token 黑名单存储在 Redis 中
- 用户信息缓存（可选）

### 9.3 查询优化
- 只查询需要的字段
- 使用分页查询
- 使用关联查询减少查询次数

## 10. 测试策略

### 10.1 单元测试
- 测试每个 Service 方法
- 测试边界条件
- 测试异常情况

### 10.2 集成测试
- 测试完整的业务流程
- 测试数据库事务
- 测试 Redis 缓存

### 10.3 E2E 测试
- 测试完整的用户注册流程
- 测试完整的用户登录流程
- 测试完整的密码找回流程

## 11. 部署方案

### 11.1 环境变量
```env
# JWT 配置
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
EXPIRATION_IN=4h
REFRESH_EXPIRATION_IN=7d
JWT_ISSUER=es
JWT_AUD=es
JWT_STRATEGY_KEY=jwt

# RSA 配置
RSA_PRIVATE_KEY=your-private-key
RSA_PUBLIC_KEY=your-public-key

# 数据库配置
DATABASE_URL=postgresql://user:password@localhost:5432/db

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### 11.2 Docker 部署
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

### 11.3 健康检查
```typescript
@Get('health')
@Public()
health() {
  return { status: 'ok', timestamp: new Date() };
}
```
