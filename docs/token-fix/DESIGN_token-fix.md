# 架构设计：Token 服务修复与优化

## 1. 整体架构
保持现有分层架构，仅修正逻辑断点和补全缺失的装饰器。

## 2. 核心组件变更

### 2.1 AuthController (`apps/app-api/src/modules/auth/auth.controller.ts`)
- **变更点**：
  - `refreshToken` 方法缺失 HTTP 方法装饰器，需添加 `@Post('refresh-token')`。
  - 方法签名变更，增加 `@Req() req: FastifyRequest` 参数，用于传递给 Service 层以获取设备信息。

### 2.2 AuthService (`apps/app-api/src/modules/auth/auth.service.ts`)
- **变更点**：
  - `refreshToken` 方法签名变更：`refreshToken(refreshToken: string, req: FastifyRequest)`。
  - **核心逻辑增强**：
    1. 调用 `baseJwtService.refreshAccessToken` 获取新 Token 对。
    2. 解析新 Access Token 和 Refresh Token 的 Payload (获取 `jti`, `exp`, `sub` 等)。
    3. 解析 `req` 获取 IP 和 UserAgent。
    4. 组装 `AppUserToken` 数据。
    5. 调用 `tokenStorageService.createTokens` 持久化新 Token。
    6. 返回新 Token 对。

### 2.3 TokenStorageService (`apps/app-api/src/modules/auth/token-storage.service.ts`)
- **变更点**：
  - `cleanupExpiredTokens`：移除 `where` 条件中的 `tokenType: 'REFRESH'`，改为清理所有过期 Token。

## 3. 数据流向
1. **客户端** -> `POST /app/auth/refresh-token` (带旧 RefreshToken)
2. **AuthController** -> 提取 IP/UA -> `AuthService.refreshToken`
3. **AuthService** -> `BaseAuthService.refreshAccessToken` (验证旧 Token，加入黑名单，生成新 Token)
4. **AuthService** -> 解析新 Token -> `TokenStorageService.createTokens` (写入 DB)
5. **AuthService** -> 返回新 Token
6. **客户端** -> 收到新 Token -> 下次请求带上新 AccessToken -> `AuthStrategy` 验证 (查 DB 存在) -> 通过

## 4. 接口契约
- `POST /app/auth/refresh-token`
  - Request: `{ refreshToken: string }`
  - Response: `{ accessToken: string, refreshToken: string }`
