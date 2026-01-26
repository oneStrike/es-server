# 项目排查与修复计划：Token 服务相关问题

## 1. 项目上下文分析
- **项目类型**：NestJS 后端服务
- **核心模块**：`AuthModule` (认证模块)
- **关键文件**：
    - `apps/app-api/src/modules/auth/token-storage.service.ts`: Token 存储与管理
    - `apps/app-api/src/modules/auth/auth.service.ts`: 认证业务逻辑
    - `libs/base/src/modules/auth/auth.strategy.ts`: JWT 认证策略
    - `libs/base/src/database/prisma-client/models/AppUserToken.ts`: Token 数据模型

## 2. 需求理解与确认
- **原始需求**：检查 `TokenStorageService` 及其相关服务，排查所有潜在问题。
- **发现的问题**：
    1.  **Token 刷新流程中断 (Bug)**：
        - `AuthService.refreshToken` 调用 `BaseAuthService.refreshAccessToken` 生成新 Token，但**未将新 Token 存储到数据库**。
        - `AuthStrategy` 依赖 `TokenStorageService.isTokenValid`，后者会查询数据库。如果 Token 不在数据库中，会被视为无效。
        - **后果**：刷新 Token 后获取的新 Token 无法通过认证，导致用户被迫重新登录。
    2.  **过期 Token 清理不完整**：
        - `TokenStorageService.cleanupExpiredTokens` 目前仅清理 `REFRESH` 类型的过期 Token。
        - 数据库中同时也存储了 `ACCESS` 类型的 Token，它们过期后也应该被清理，否则会造成数据堆积。
    3.  **lastUsedAt 字段语义变更**：
        - `AppUserToken` 模型中移除了 `lastUsedAt` 字段。
        - 代码中使用 `createdAt` 代替 `lastUsedAt`。
        - 鉴于 Token 轮换（Rotation）机制存在，每次刷新都会创建新记录，因此 `createdAt` 确实代表了该 Token 的"启用时间"，在轮换频繁的情况下，可以近似作为"最后活跃时间"。这一点在当前架构下是可接受的，但需要明确注释。

## 3. 智能决策策略
- **修复 Token 刷新 Bug**：
    - 修改 `AuthService.refreshToken`，在生成新 Token 后，调用 `tokenStorageService.createTokens` 或 `storeTokens` 将其持久化。
    - 需要解析新生成的 Token 获取过期时间等信息（`BaseAuthService.refreshAccessToken` 返回的是字符串，需要解码）。
- **优化过期清理**：
    - 修改 `TokenStorageService.cleanupExpiredTokens`，移除 `tokenType: 'REFRESH'` 的限制，清理所有过期 Token。

## 4. 待确认事项
- 无。逻辑已非常清晰，通过代码静态分析已确认 Bug 路径。

## 5. 最终共识
- **目标**：修复 Token 刷新无法使用的问题，并优化 Token 清理逻辑。
- **验收标准**：
    1. `AuthService.refreshToken` 代码中包含存储 Token 的逻辑。
    2. `TokenStorageService.cleanupExpiredTokens` 清理所有类型的过期 Token。
