# 任务：提取公共登录锁定服务 (LoginGuardService)

## 1. 需求分析
- **现状**：
  - `apps/app-api` 已实现 Redis 登录锁。
  - `apps/admin-api` 计划改造为 Redis 登录锁。
  - 两者逻辑高度相似（检查锁、记录失败、锁定、清理），仅 Key 前缀和配置参数（可能）不同。
- **目标**：
  - 将核心锁定逻辑封装到 `libs/base` 中，避免代码重复。
  - 提供统一的 `LoginGuardService`。

## 2. 架构设计

### 2.1 新增公共服务
在 `libs/base/src/modules/auth` 下新增 `LoginGuardService`。

**接口定义预览**：
```typescript
@Injectable()
export class LoginGuardService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * 检查是否被锁定
   * @param key 业务唯一的 Key（如 `auth:login:lock:123`）
   * @throws BadRequestException 如果被锁定，抛出包含剩余时间的异常
   */
  async checkLock(key: string): Promise<void>

  /**
   * 记录失败并检查锁定
   * @param keyPrefix 业务 Key 前缀（如 `auth:login`）
   * @param identifier 用户标识（如 userId）
   * @param config 配置项 { maxAttempts, ttl, lockTtl }
   * @throws BadRequestException 抛出密码错误提示（含剩余次数）或锁定提示
   */
  async recordFail(
    keyPrefix: string,
    identifier: string | number,
    config: { maxAttempts: number; failTtl: number; lockTtl: number }
  ): Promise<void>

  /**
   * 清除失败记录
   */
  async clearHistory(keyPrefix: string, identifier: string | number): Promise<void>
}
```

### 2.2 模块调整
- 修改 `libs/base/src/modules/auth/auth.module.ts`，注册并导出 `LoginGuardService`。

### 2.3 应用层改造
- **App API (`apps/app-api`)**:
  - 注入 `LoginGuardService`。
  - 替换原有的 `checkIsLocked`, `incrementLoginAttempts`, `clearLoginAttempts` 私有方法。
  - 调用公共服务方法。
- **Admin API (`apps/admin-api`)**:
  - 注入 `LoginGuardService`。
  - 实现基于 Redis 的锁定逻辑，调用公共服务。

## 3. 优势
1.  **复用性**：逻辑集中，修改一处即可同步到所有应用。
2.  **规范性**：强制统一了 Key 的生成规则（通过参数约束）和锁定行为。
3.  **可维护性**：应用层代码更简洁，专注于业务流程。

## 4. 实施步骤
1.  **创建公共服务**：在 `libs/base` 中实现 `LoginGuardService`。
2.  **导出服务**：更新 `BaseAuthModule`。
3.  **重构 App API**：使用新服务替换旧逻辑。
4.  **重构 Admin API**：使用新服务实现锁定逻辑。

## 5. 待确认事项
- 异常消息是否需要在公共层统一？建议在公共层抛出特定异常或错误码，由应用层捕获处理消息，或者允许传入自定义错误消息生成器。
  - *建议方案*：公共服务抛出标准异常，但消息内容尽量通用，或者支持传入自定义消息模板。为简单起见，可以先使用通用的“账号已锁定”消息，因为这在两端都是通用的。

## 6. 结论
强烈建议进行封装。这是符合 DRY (Don't Repeat Yourself) 原则的最佳实践。
