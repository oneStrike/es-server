# 任务分解：Token 服务修复

## 1. 任务清单

### Task 1: 修复 AuthController 路由配置
- **文件**: `apps/app-api/src/modules/auth/auth.controller.ts`
- **内容**:
  - 为 `refreshToken` 添加 `@Post('refresh-token')`。
  - 注入 `req` 对象。
- **验证**: 检查代码中装饰器是否存在。

### Task 2: 修复 AuthService 刷新逻辑
- **文件**: `apps/app-api/src/modules/auth/auth.service.ts`
- **内容**:
  - 更新 `refreshToken` 方法签名。
  - 实现 Token 解析和存储逻辑。
- **依赖**: Task 1 (参数传递)

### Task 3: 优化 TokenStorageService 清理逻辑
- **文件**: `apps/app-api/src/modules/auth/token-storage.service.ts`
- **内容**:
  - 修改 `cleanupExpiredTokens` 查询条件。

## 2. 依赖关系
Task 1 -> Task 2
Task 3 (独立)

## 3. 验收检查
- 路由可访问。
- 刷新 Token 后数据库有新记录。
- 过期 Access Token 能被清理。
