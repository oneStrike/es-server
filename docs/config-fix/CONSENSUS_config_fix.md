# 配置修复与隔离方案共识文档

## 1. 核心变更
我们已达成共识，采用 **"环境变量前缀 + Docker Compose 映射"** 的方案来解决配置校验报错及环境隔离问题。

### 1.1 校验逻辑修复
修正 `libs/base/src/config/validation.config.ts`，为以下配置项添加默认值（与代码逻辑对齐），避免因 `.env` 缺失导致的启动失败：
- 数据库分页参数 (`DB_PAGINATION_*`)
- Redis 命名空间 (`REDIS_NAMESPACE`)
- JWT 默认配置 (`JWT_*`)
- 上传配置 (`UPLOAD_*`)
- 应用基础配置 (`APP_*`)

### 1.2 配置隔离策略
通过 `docker-compose.yml` 将带前缀的环境变量映射为容器内标准变量：

- **Admin 端**: 使用 `ADMIN_` 前缀变量 (e.g., `ADMIN_JWT_EXPIRATION_IN` -> `JWT_EXPIRATION_IN`)
- **App 端**: 使用 `APP_` 前缀变量 (e.g., `APP_JWT_EXPIRATION_IN` -> `JWT_EXPIRATION_IN`)

## 2. 涉及文件
- `libs/base/src/config/validation.config.ts`
- `docker-compose.yml`
- `.env.example`

## 3. 验收标准
1.  服务启动时不再报 `Config validation error`。
2.  Admin 和 App 容器内能正确获取到各自隔离的配置值（如 JWT 过期时间）。
3.  `.env.example` 包含新的配置结构说明。
