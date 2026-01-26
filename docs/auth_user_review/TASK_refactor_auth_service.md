# 鉴权模块重构任务：消除代码冗余

## 1. 任务背景
在排查 `auth.service.ts` 文件时，发现存在多处代码冗余和潜在的逻辑不一致问题。为了提高代码的可维护性和健壮性，需要对该文件进行重构。

## 2. 识别到的冗余与问题
1.  **验证码校验逻辑重复**: `register`、`login`、`resetPassword` 方法中均包含相同的 try-catch 块来调用 `smsService.checkVerifyCode` 并处理异常。
2.  **登录后处理逻辑重复且不一致**:
    *   `login` 方法执行了 `updateUserLoginInfo`、`generateTokens`、`storeTokens` 并返回结果。
    *   `register` 方法执行了 `generateTokens` 并返回结果，但**遗漏**了 `updateUserLoginInfo` 和 `storeTokens`，导致注册后的用户状态与登录后不一致（如缺少登录记录、Token 未入库）。
3.  **方法命名混淆**: `findUserByAccount` 实际是通过手机号查找，应命名为 `findUserByPhone`。
4.  **用户信息脱敏重复**: `sanitizeUser` 方法在本类及 `UserService` 中重复存在。

## 3. 重构计划
1.  **提取 `validateVerifyCode` 方法**: 统一验证码校验与异常处理逻辑。
2.  **提取 `handleLoginSuccess` 方法**: 封装登录/注册成功后的所有操作（更新登录信息、生成 Token、存储 Token、返回结果）。
3.  **重命名 `findUserByAccount`**: 改为 `findUserByPhone`。
4.  **应用重构**: 更新 `register`、`login`、`resetPassword` 等方法使用新提取的私有方法。

## 4. 预期收益
- 减少约 30-50 行重复代码。
- 修复 `register` 接口缺少 Token 存储和登录日志记录的隐性 Bug。
- 提高代码可读性和一致性。
