# Admin Auth Fix Acceptance Report

## 1. 任务概述
修复 Admin 模块认证策略，使其与 `libs/base` 中的 `AuthStrategy` 对齐，实现基于数据库的 Token 存储和验证机制。

## 2. 完成情况

### 2.1 数据库 Schema
- [x] 创建 `AdminUserToken` 模型 (`prisma/models/admin/admin-user-token.prisma`)
- [x] 更新 `AdminUser` 模型关联 (`prisma/models/admin/admin-user.prisma`)
- [x] 执行 `prisma generate` 更新客户端

### 2.2 服务实现
- [x] 实现 `AdminTokenStorageService` (`apps/admin-api/src/modules/auth/admin-token-storage.service.ts`)
  - 实现 `createToken` / `createTokens`
  - 实现 `findByJti`
  - 实现 `isTokenValid`
  - 实现 `revokeByJti`
- [x] 更新 `AuthModule` (`apps/admin-api/src/modules/auth/auth.module.ts`)
  - 注册 `AuthStrategy`
  - 注册 `AdminTokenStorageService`
  - 提供 `ITokenStorageService` 接口实现

### 2.3 业务逻辑集成
- [x] 更新 `AuthService` (`apps/admin-api/src/modules/auth/auth.service.ts`)
  - `login`: 生成 Token 后存储到数据库，记录设备信息和 IP
  - `logout`: 登出时撤销数据库中的 Token
  - `refreshToken`: 刷新时存储新的 Token，并记录新的设备信息
- [x] 更新 `AuthController` (`apps/admin-api/src/modules/auth/auth.controller.ts`)
  - `refreshToken` 增加 `req` 参数以获取客户端信息

## 3. 验证结果
- 代码编译通过
- Prisma Client 生成成功
- 接口依赖注入配置正确

## 4. 遗留问题
无阻塞性问题。
