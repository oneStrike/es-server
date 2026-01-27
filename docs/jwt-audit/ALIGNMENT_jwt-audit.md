# JWT 全面排查与审计报告 (Alignment Phase)

## 1. 项目上下文分析 (Project Context Analysis)

### 1.1 现有架构
- **核心模块**: `libs/base/src/modules/auth` 提供了核心的 `JwtAuthModule`、`AuthService` 和 `JwtBlacklistService`。
- **应用实现**:
  - `apps/app-api`: C端应用，实现了完整的 JWT 流程，包括 Token 存储 (`AppTokenStorageService`) 和认证策略 (`AuthStrategy`)。
  - `apps/admin-api`: 管理端应用，使用了 `JwtAuthModule` 但存在配置缺失。
- **技术栈**: NestJS, Passport (passport-jwt), Redis (用于黑名单和缓存), Prisma (数据库)。

### 1.2 JWT 机制概览
- **双令牌机制**: 使用 Access Token (短效) + Refresh Token (长效)。
- **黑名单机制**: 基于 Redis 的 JTI (JWT ID) 黑名单，用于登出和刷新时的旧 Token 作废。
- **存储机制**:
  - `app-api`: 将 Token 元数据（JTI, Expiration, Device Info）存储在数据库 (`AppUserToken`) 并通过 Redis 缓存加速验证。
  - `admin-api`: 目前未发现 Token 持久化存储实现。

---

## 2. 审计发现 (Audit Findings)

### 2.1 关键问题 (Critical Issues)

#### 🚨 1. Admin-API 认证服务缺失 (Admin API Authentication Broken)
  - **问题描述**: `apps/admin-api` 在 `AppModule` 中启用了全局 `JwtAuthGuard` (依赖 'jwt' 策略)，但并未在任何模块中提供 `AuthStrategy`。
- **影响**: 管理端 API 实际上无法进行 JWT 认证，任何受保护的接口请求都会因为找不到策略而报错 (Internal Server Error 或 401)。
- **证据**:
  - `apps/admin-api/src/app.module.ts` 引入了 `JwtAuthGuard`。
  - `apps/admin-api` 中搜索不到 `AuthStrategy` 的提供者 (Provider)。
  - `libs/base` 中的 `JwtAuthModule` 导出了 `AuthStrategy` 但未将其作为 Provider 注册。

#### 🚨 2. Admin-API 缺失 Token 存储实现
- **问题描述**: `AuthStrategy` 依赖 `ITokenStorageService` 接口来验证 Token 是否被撤销。`admin-api` 未提供该接口的实现。
- **影响**: 即使修复了 Strategy 注入问题，Admin 端也无法使用现有的 `AuthStrategy`，因为它需要依赖数据库中的 Token 记录。
- **风险**: 管理员 Token 无法被服务端主动撤销（除非仅依赖 Redis 黑名单，但 `AuthStrategy` 强制检查 `tokenStorageService`）。

#### 🚨 3. CORS 配置缺失 (Missing CORS Configuration)
- **问题描述**: 在 `apps/admin-api/src/main.ts` 和 `apps/app-api/src/main.ts` (以及 `libs/base/src/bootstrap/app.setup.ts`) 中未发现明确的 `enableCors()` 调用或 Fastify 的 CORS 配置。
- **影响**: 浏览器端的前后端分离调用可能会因为跨域策略被拦截。
- **建议**: 需要在 `setupApp` 中显式配置 CORS，允许受信任的域名。

### 2.2 配置与安全 (Configuration & Security)

#### ⚠️ 1. 密钥配置潜在风险
- **问题描述**: `AuthStrategy` (`libs/base/src/modules/auth/auth.strategy.ts`) 在初始化时仅使用了 `secretOrKey: authConfig.secret`。
- **风险**: 如果系统配置为使用 RSA 非对称加密 (`publicKey` / `privateKey`)，`passport-jwt` 需要正确接收公钥。当前代码可能在 RSA 模式下错误地使用了 `secret` 字段，导致验证失败或回退到对称加密（如果 `secret` 被设置）。
- **建议**: 在 `AuthStrategy` 中根据配置动态选择 `secretOrKey` (优先使用 `publicKey`)。

#### ⚠️ 2. 开发环境 Redis 模拟
- **问题描述**: `libs/base/src/modules/cache/cache.module.ts` 在开发环境 (`isDevelopment()`) 使用内存 (`CacheableMemory`) 模拟 Redis。
- **风险**: 如果开发环境涉及多实例或重启，Token 黑名单会丢失。虽然生产环境使用了 Redis，但需确保生产环境配置正确。

### 2.3 功能实现 (Functional Implementation)

#### ✅ 1. 生成与刷新 (Generation & Refresh)
- `AuthService.generateTokens`: 逻辑正确，生成 Access/Refresh 密钥对，支持 RSA 和 HMAC。
- `AuthService.refreshAccessToken`: 实现了 Token 轮换 (Rotation)，刷新时会将旧的 Refresh Token 加入黑名单，安全性较好。

#### ✅ 2. 黑名单机制 (Blacklist)
- `JwtBlacklistService`: 使用 Redis 存储失效的 JTI，设置了 TTL，逻辑正确。
- `Logout`: 登出时同时拉黑 Access 和 Refresh Token。

#### ✅ 3. 防重放攻击 (Replay Attack)
- 依赖 `jti` 唯一标识和黑名单机制。
- 结合 Token 极短有效期 (默认 4h Access) 和 Redis 检查，具备基础防护能力。

---

## 3. 建议修复方案 (Recommendations)

### 3.1 修复 Admin-API 认证
1.  **实现 AdminTokenStorageService**:
    - 参考 `AppTokenStorageService`，为 Admin 用户实现类似的 Token 存储逻辑（或决定 Admin 使用无状态 Token，但需修改/适配 `AuthStrategy`）。
    - 建议：为保持一致性，建议在 `AdminUser` 关联表中添加 Token 记录，实现 `ITokenStorageService`。
2.  **注册 AuthStrategy**:
    - 在 `apps/admin-api/src/modules/auth/auth.module.ts` 中提供 `AuthStrategy` 和 `ITokenStorageService` 实现。

### 3.2 完善 CORS 配置
- 在 `libs/base/src/bootstrap/app.setup.ts` 中添加 `app.enableCors()` 配置，支持通过环境变量配置允许的 Origin。

### 3.3 优化 AuthStrategy 密钥处理
- 修改 `libs/base/src/modules/auth/auth.strategy.ts`，在构造函数中判断：如果 `authConfig.publicKey` 存在，则将其赋值给 `secretOrKey`，并指定算法为 `RS256`。

### 3.4 增强安全性
- **强制 HTTPS**: 确保生产环境 Cookie 和 Token 传输仅通过 HTTPS。
- **Token 绑定**: 当前 `AppTokenStorageService` 记录了 IP 和 UserAgent，建议在 `AuthStrategy` 验证时增加 IP/UA 一致性检查（可选，视安全级别要求而定）。

---

## 4. 待确认事项 (Questions for Consensus)

1.  **Admin 端 Token 策略**: 是否需要像 App 端一样将 Admin Token 持久化到数据库？(推荐: 是，以便审计和管理后台强制下线功能)。
2.  **CORS 策略**: 允许的域名范围是？(建议: 暂时配置为 `*` 或从环境变量读取，后续收紧)。
3.  **RSA 密钥强制性**: 是否计划强制迁移到 RSA 签名？(当前代码兼容 HMAC 和 RSA，建议生产环境强制 RSA)。

请审阅以上报告。确认后，我将按照建议方案进行修复和优化。
