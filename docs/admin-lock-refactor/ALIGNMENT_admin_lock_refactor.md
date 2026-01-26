# 任务：重构 Admin API 登录锁定机制

## 1. 项目上下文分析
- **当前状态**：
  - `apps/admin-api` 目前使用数据库字段 (`AdminUser` 表的 `isLocked`, `loginFailCount`, `loginFailAt`) 来实现登录失败锁定。
  - `apps/app-api` (C端用户) 刚刚实现了基于 Redis 的无侵入式锁定机制。
- **需求**：
  - 分析 `admin-api` 是否可以改造成与 `app-api` 相同的 Redis 机制。
  - 提供方案供确认。

## 2. 需求理解与确认
- **目标**：将 Admin 端的登录锁定逻辑从 "数据库驱动" 迁移到 "Redis 缓存驱动"。
- **核心变更**：
  - 停止使用 `AdminUser` 表中的锁定相关字段进行逻辑判断和更新。
  - 引入 Redis 缓存来存储失败计数和锁定状态。
  - 保持锁定策略一致：5次失败锁定30分钟（参考 App 端配置，或沿用 Admin 端现有逻辑）。
  - *注：Admin 端现有逻辑也是 5 次失败锁定 30 分钟。*

## 3. 现有逻辑 vs 目标逻辑

| 特性 | 现有逻辑 (Database) | 目标逻辑 (Redis) |
| :--- | :--- | :--- |
| **状态存储** | 数据库字段 (`isLocked`, `loginFailCount`) | Redis Key (`admin:auth:login:fail:{id}`, `lock:{id}`) |
| **失败处理** | 每次失败更新数据库记录 (+1 count) | 每次失败更新 Redis 计数器 (TTL 5min) |
| **锁定判断** | 查库判断 `isLocked` 且检查时间 | 查 Redis 是否存在 Lock Key |
| **性能影响** | 攻击时产生大量数据库写操作 | 攻击时仅产生 Redis 写操作，保护数据库 |
| **解锁方式** | 登录成功重置 / 过期自动逻辑判断 | 过期自动失效 (Redis TTL) |

## 4. 实施方案建议

### 步骤 1: 常量定义
在 `apps/admin-api/src/modules/auth/auth.constant.ts` 中添加：
- `AuthConstants`: 定义最大尝试次数 (5) 和 锁定时间 (30min)。
- `AuthRedisKeys`: 定义 Redis Key 生成函数。
- `AuthErrorMessages`: 定义统一的错误提示。

### 步骤 2: 服务改造
修改 `apps/admin-api/src/modules/auth/auth.service.ts`:
1. **注入 CacheManager**。
2. **新增私有方法**：
   - `checkIsLocked(userId: number)`
   - `incrementLoginAttempts(userId: number)`
   - `clearLoginAttempts(userId: number)`
3. **修改 `login` 方法**：
   - 移除原有的 `user.isLocked` 检查逻辑。
   - 移除原有的 `updateLoginFailInfo` 调用。
   - 移除原有的数据库重置逻辑。
   - 插入新的 Redis 检查和更新逻辑。

### 步骤 3: 清理（可选）
- `updateLoginFailInfo` 方法如果不再被其他地方引用，可以删除或标记为废弃。
- 数据库字段暂时保留，避免 Schema 变更带来的风险，但不再维护其值。

## 5. 待确认事项
1. 是否同意停止维护数据库中的 `isLocked` 等字段？（这意味着直接查数据库将无法看到用户的锁定状态，需查 Redis）
2. 是否保持 5 次失败、30 分钟锁定的策略？

## 6. 结论
完全可以改造。改造后架构更统一，且能更好地防御暴力破解攻击（减轻数据库压力）。
