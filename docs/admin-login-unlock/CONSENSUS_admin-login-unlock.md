# 阶段 1: 最终共识

## 明确的需求与验收标准

- 当账号被锁定且锁定已超过配置的时长（默认 30 分钟）时，用户再次发起登录应触发自动解锁并继续登录流程。
- 锁定阈值与锁定时长可通过环境变量配置且有合理默认值。

## 技术实现方案

- 新增 `src/config/auth.config.ts` 读取环境变量，提供 `ADMIN_LOGIN_POLICY`。
- 修改 `AdminAuthService.login`：
  - 在检测到 `user.isLocked` 时，依据 `loginFailAt` 与策略时长判断是否过期；过期则重置锁定信息并继续，未过期则拒绝并记录失败。
- 修改 `updateLoginFailInfo`：使用策略中的 `maxFailCount` 替换硬编码的 `5`。

## 技术约束与集成方案

- 不新增数据库字段，兼容当前 Prisma 模型。
- 不改变现有日志与验证码流程。
- 环境变量：`ADMIN_LOGIN_LOCK_COUNT`、`ADMIN_LOGIN_LOCK_DURATION_MIN`（可选）。

## 任务边界与验收

- 仅涉及后端登录逻辑与配置文件新增。
- 构建和测试可通过现有流程进行。

## 不确定性确认

- 当前选择在锁定期内的尝试继续累加失败计数，保留为后续优化项；本次不改动此行为。
