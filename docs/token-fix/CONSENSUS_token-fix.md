# 最终共识：修复 Token 服务相关问题

## 1. 需求描述
用户要求检查并修复 `TokenStorageService` 及相关服务的问题。经排查发现核心问题在于 Token 刷新流程中缺失了 Token 持久化步骤，导致刷新后的 Token 无效。此外，过期 Token 清理逻辑也不够完整。

## 2. 核心问题与解决方案

### 问题 1: Token 刷新后无效 (Critical Bug)
- **现象**：调用 `refreshToken` 接口获取新 Token 后，使用新 Token 访问受保护接口会返回 401 Unauthorized。
- **原因**：`AuthService.refreshToken` 方法仅生成了 JWT 字符串，但未调用 `TokenStorageService` 将新 Token 记录写入数据库。`AuthStrategy` 依赖数据库中的记录来验证 Token 有效性。
- **方案**：
  1. 在 `AuthService.refreshToken` 中，获取新生成的 Access/Refresh Token。
  2. 解码 Token 获取 `jti`、`exp` 等元数据。
  3. 调用 `TokenStorageService.createTokens` 将新 Token 对存入数据库。
  4. 保持原有逻辑（将旧 Refresh Token 加入黑名单）。

### 问题 2: 过期 Token 清理不完整
- **现象**：`cleanupExpiredTokens` 仅清理 `tokenType: 'REFRESH'` 的过期数据。
- **原因**：代码中显式添加了过滤条件。
- **方案**：移除 `tokenType` 过滤条件，清理所有过期的 `AppUserToken` 记录。

## 3. 任务边界
- 本次任务仅修复上述两个明确的技术问题。
- 不涉及 `lastUsedAt` 字段的数据库结构变更（沿用 `createdAt` 作为替代的现有逻辑）。

## 4. 验收标准
- [ ] `AuthService.refreshToken` 成功存储新 Token，且包含正确的设备信息（从请求中获取或继承）。
- [ ] `TokenStorageService.cleanupExpiredTokens` 方法中无 `tokenType` 限制。
- [ ] 现有测试（如果有）通过，或者手动验证逻辑正确。
