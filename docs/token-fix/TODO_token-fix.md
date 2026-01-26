# 待办事项：Token 服务后续优化

## 1. 测试补充
- [ ] 为 `AuthService.refreshToken` 添加单元测试，Mock `baseJwtService` 和 `tokenStorageService`，验证存储逻辑被调用。
- [ ] 添加 E2E 测试，模拟完整的 "登录 -> 获取 Token -> 刷新 Token -> 使用新 Token" 流程。

## 2. 监控与运维
- [ ] 配置定时任务监控，观察 `cleanupExpiredTokens` 的执行效果和删除数量。
- [ ] 监控 Token 刷新接口的延迟，确保存储操作不会显著拖慢响应速度。

## 3. 代码优化
- [ ] 考虑在 `BaseAuthService` 中统一返回 Token 的元数据 (exp, jti)，避免在 `AuthService` 中二次解码。
