# 账号锁定功能任务分解 (TASK)

## 任务清单

### 1. 基础设施准备
- [ ] **Task 1.1**: 定义常量
  - 文件: `apps/app-api/src/modules/auth/auth.constant.ts`
  - 内容: Redis Key 前缀、时间配置、错误消息模板。

### 2. 核心逻辑实现
- [ ] **Task 2.1**: 实现 Redis 操作辅助方法
  - 文件: `apps/app-api/src/modules/auth/auth.service.ts`
  - 方法: 
    - `checkIsLocked(userId)`
    - `incrementLoginAttempts(userId)`
    - `clearLoginAttempts(userId)`
- [ ] **Task 2.2**: 集成到登录流程
  - 文件: `apps/app-api/src/modules/auth/auth.service.ts`
  - 修改 `login` 方法，在密码验证前后插入上述逻辑。

### 3. 验证与交付
- [ ] **Task 3.1**: 验证测试
  - 手动模拟错误 5 次，验证锁定。
  - 验证锁定后无法登录。
  - 验证 TTL 过期后恢复。
- [ ] **Task 3.2**: 清理与文档更新
  - 更新 `ACCEPTANCE` 文档。
