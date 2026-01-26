# 鉴权与用户模块排查与修复共识文档

## 1. 需求回顾
用户要求对鉴权（Auth）和用户（User）相关代码进行多维度排查，重点关注：
- DTO与数据表字段映射问题
- 业务逻辑漏洞（如验证码校验缺失）
- 性能与安全性问题
- 代码冗余与规范性问题

## 2. 问题排查总结

### 2.1 安全漏洞（已修复）
1.  **注册接口 (`AuthService.register`)**: 验证码校验逻辑被注释，导致任意验证码均可注册。
    *   **修复**: 恢复验证码校验逻辑，并增加异常处理。
2.  **重置密码接口 (`AuthService.resetPassword`)**: 仅通过 RSA 解密密码，未校验短信验证码，存在重大安全隐患。
    *   **修复**: 增加 `smsService.checkVerifyCode` 调用，确保用户持有验证码。
3.  **DTO 定义错误**: `ForgotPasswordDto` 中 `code` 定义为 `number`，但底层短信服务及其他 DTO 均期望 `string`。
    *   **修复**: 修改 `ForgotPasswordDto.code` 为 `string` 类型。

### 2.2 数据一致性与规范性（已修复）
1.  **DTO 与实体不匹配**: `BaseAppUserDto` 包含 `isSignedIn` 字段，但数据库实体 `AppUser` 无此字段。
    *   **现状**: `AuthService` 和 `UserService` 返回用户信息时未包含该字段，导致前端可能获取到 `undefined`。
    *   **修复**: 在 `sanitizeUser` 方法中显式设置 `isSignedIn: false`，并标记 TODO 待后续实现具体签到逻辑。
2.  **Seed 数据错误**: `client-user.ts` 包含不存在的 `isSignedIn` 字段，可能导致 Seed 脚本运行失败。
    *   **修复**: 从 Seed 数据中移除该字段。
3.  **代码冗余**: `AuthService` 和 `UserService` 均包含 `sanitizeUser` 私有方法，且实现简单粗暴（使用 `any` 类型）。
    *   **修复**: 增强 `sanitizeUser` 的健壮性，确保返回结构符合 DTO 定义，并去除未使用变量警告。

## 3. 遗留问题与建议（TODO）
1.  **签到功能 (`isSignedIn`)**: 目前统一返回 `false`。需确认业务需求：是否需要独立的签到表（如 `AppPointRecord` 中的签到类型）或在 `AppUser` 中增加字段。
2.  **DTO 结构重构**: `ForgotPasswordDto` 目前被用于"发送验证码"（推测）和"重置密码"，职责不清。建议拆分为 `SendVerifyCodeDto` 和 `ResetPasswordDto`。
3.  **类型安全**: `sanitizeUser` 仍使用 `any` 作为输入类型。建议引入 `@prisma/client` 的 `AppUser` 类型进行强类型约束。
4.  **`AuthService.forgotPassword`**: 该方法目前逻辑仅为"检查账号是否存在"，未实际发送验证码，需确认其用途。

## 4. 验收标准
- [x] 注册接口必须校验验证码。
- [x] 重置密码接口必须校验验证码。
- [x] `ForgotPasswordDto` 的 `code` 字段类型为 `string`。
- [x] 用户信息接口返回的 JSON 结构中包含 `isSignedIn` 字段（值为 `false`）。
- [x] 项目编译无类型错误。

## 5. 结论
核心安全漏洞已修复，数据结构不一致问题已通过临时方案（默认值）解决。建议后续迭代中完善签到业务逻辑并重构 DTO 体系。
