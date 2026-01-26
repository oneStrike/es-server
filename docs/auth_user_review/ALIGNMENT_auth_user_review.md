# Auth & User Module Review - Alignment Document

## 1. 项目上下文分析 (Project Context Analysis)

### 现有架构
- **Modules**: `auth`, `user` in `apps/app-api`.
- **Entities**: `AppUser` defined in Prisma schema (`libs/base/src/database/prisma-client/models/AppUser.ts`).
- **DTOs**: Defined in `apps/app-api/src/modules/auth/dto/auth.dto.ts`.
- **Service Layer**: `AuthService`, `UserService` extending `BaseService`.
- **Authentication**: JWT based (Access/Refresh tokens).

### 业务域
- 用户注册、登录 (密码/验证码)、忘记密码、重置密码、个人信息获取。

## 2. 问题排查与发现 (Issues & Findings)

### 2.1 安全性问题 (Security Vulnerabilities) - **CRITICAL**
1.  **注册接口缺少验证码校验**: `AuthService.register` 方法中，验证码校验逻辑被注释掉 (`// if (body.code) ...`)。这意味着任何人都可以使用任意手机号注册，无需验证拥有权。
2.  **重置密码接口缺少验证码校验**: `AuthService.resetPassword` 方法仅根据手机号查找用户并重置密码，**完全忽略了 DTO 中的验证码字段**。这是一个极其严重的漏洞，允许攻击者重置任意用户的密码。
3.  **忘记密码接口逻辑缺失**: `AuthService.forgotPassword` 仅检查用户是否存在并返回提示信息，未实际触发发送验证码的逻辑（虽然前端可能先调用 `send-verify-code`，但后端接口命名存在误导）。
4.  **密码生成随机性**: `generateSecureRandomPassword` 使用 `Math.random()` 和简单的排序打乱，虽然对非加密场景尚可，但建议使用更安全的随机源（如 `crypto` 模块）。

### 2.2 DTO 与实体映射问题 (DTO vs Entity Mismatches)
1.  **字段不匹配**:
    -   `BaseAppUserDto` 定义了 `isSignedIn` (是否签到)，但 `AppUser` 实体无此字段，且 `UserService.getUserProfile` 和 `AuthService.login` 返回的用户对象中均未计算此字段，导致前端获取到的该字段可能为 `undefined` 或不准确。
    -   `BaseAppUserDto` 包含 `levelId`，实体也有，但 `sanitizeUser` 只是简单地移除 `password`，未做字段转换或空值处理。
2.  **类型安全缺失**:
    -   `sanitizeUser` 方法接收 `any` 返回 `any`，绕过了 TypeScript 的类型检查。
    -   Controller 直接返回 Service 的结果，而 Service 返回的是 `sanitized` 对象（去除了密码的 Entity），并非严格的 `BaseAppUserDto` 实例。这会导致 Swagger 文档与实际响应不一致。

### 2.3 业务逻辑与代码质量 (Business Logic & Code Quality)
1.  **代码冗余**: `AuthService` 和 `UserService` 中都存在 `sanitizeUser` 私有方法，违反 DRY 原则。
2.  **DTO 定义混乱**:
    -   `ForgotPasswordDto` 同时被用于 `/forgot-password` (通常仅需手机号) 和 `/reset-password` (需要手机号、验证码、新密码)。
    -   存在 `ResetPasswordDto` 但未被 Controller 使用。
    -   `ForgotPasswordDto` 包含 `password` 字段，对于“请求重置”阶段是不必要的。
3.  **错误处理**: 使用了通用的 `Error` 抛出错误 (在 `UserService` 中)，而非 NestJS 的 `HttpException` (如 `NotFoundException`)，导致 HTTP 状态码不准确（可能返回 500 而非 404）。

### 2.4 性能问题 (Performance)
1.  **同步操作**: `extractIpAddress` 和 `parseDeviceInfo` 是同步的，这通常没问题，但如果在高并发下涉及复杂正则可能会有轻微影响。
2.  **数据库查询**: 目前未发现明显的 N+1 问题，因为主要基于单表查询。

## 3. 修复计划 (Remediation Plan)

### 阶段 1: 修复高危安全漏洞 (Fix Critical Security Issues)
- [ ] 恢复 `AuthService.register` 中的验证码校验逻辑。
- [ ] 在 `AuthService.resetPassword` 中增加验证码校验逻辑。

### 阶段 2: 规范化 DTO 与实体映射 (Standardize DTO Mapping)
- [ ] 移除冗余的 `sanitizeUser`，使用 `class-transformer` 的 `plainToInstance` 或创建统一的转换工具。
- [ ] 实现 `isSignedIn` 逻辑（检查用户今日是否有签到记录，如果暂无签到功能，则明确设为 `false` 或移除该字段）。
- [ ] 确保 Service 返回的数据严格符合 DTO 定义。

### 阶段 3: 重构与优化 (Refactor & Optimize)
- [ ] 统一 `ForgotPasswordDto` 和 `ResetPasswordDto` 的使用。
- [ ] 优化错误处理，使用标准的 NestJS 异常。
- [ ] 完善 `sanitizeUser` 的类型定义。

## 4. 待确认事项 (Questions)
- `isSignedIn` 的具体业务逻辑是什么？是否已有签到表？（根据搜索结果，似乎暂无明确的签到表，建议暂时设为 false 或检查 `AppPointRecord` 是否有签到类型的记录）。
