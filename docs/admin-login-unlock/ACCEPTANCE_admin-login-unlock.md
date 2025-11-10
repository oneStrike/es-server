# 阶段 5: Automate（执行与验收）

## 完成情况记录

- 已新增 `src/config/auth.config.ts`，提供策略配置。
- 已在 `AdminAuthService.login` 中实现自动解锁逻辑。
- 已将锁定阈值改为配置驱动。

## 验收标准

- 当 `isLocked=true` 且 `now - loginFailAt >= lockDurationMs`：再次登录应自动重置锁定并进入正常登录流程。
- 当 `isLocked=true` 且未过期：记录失败日志并拒绝登录。
- 失败计数达到 `maxFailCount` 时锁定账户。
- 配置缺失时使用安全默认值（5 次、30 分钟）。

## 测试建议

- 单元测试：模拟不同 `loginFailAt` 与 `isLocked` 状态，验证自动解锁与拒绝分支。
- 集成测试：调用 `/api/admin/login`，覆盖验证码通过与失败密码场景。
