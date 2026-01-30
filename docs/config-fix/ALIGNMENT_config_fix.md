# 配置修复与隔离方案对齐文档

## 1. 项目背景与问题分析

### 1.1 问题描述
用户在启动 `app-api` 服务时遇到 `Config validation error`，提示缺少多个环境变量：
- 数据库相关: `DB_MAX_QUERY_LIST_LIMIT`, `DB_PAGINATION_PAGE_SIZE`, `DB_PAGINATION_PAGE_INDEX`
- Redis相关: `REDIS_NAMESPACE`
- JWT相关: `JWT_EXPIRATION_IN`, `JWT_REFRESH_EXPIRATION_IN`, `JWT_JWT_ISSUER`
- 上传相关: `UPLOAD_DIR`, `UPLOAD_MAX_FILE_SIZE`
- 应用相关: `APP_PORT`, `APP_VERSION`, `APP_FILE_URL_PREFIX`

### 1.2 原因分析
1.  **校验过于严格 (Strict Validation)**: `libs/base/src/config/validation.config.ts` 中的 Joi 校验规则将上述字段定义为 `.required()`，但对应的配置加载文件 (如 `db.config.ts`, `auth.config.ts`) 中实际上提供了默认值。这导致即使代码能处理缺失值，启动时的校验层也会报错。
2.  **配置隔离需求 (Configuration Isolation)**: Admin 和 App 端目前共享同一套 `.env` 和校验逻辑。用户明确指出这两端的某些配置（JWT、上传、APP基础信息）可能不同，需要一种合理的隔离方案。

## 2. 解决方案建议

### 2.1 修复校验逻辑 (Fix Validation)
**策略**: 将 Joi 校验规则与代码中的默认值对齐。
- 对于代码中有默认值的配置项（如 `DB_PAGINATION_PAGE_SIZE`），在 Joi 中使用 `.default()` 或 `.optional()`，避免因 `.env` 缺失而报错。
- 确保 Joi 提供的默认值与 `*.config.ts` 中的默认值保持一致。

### 2.2 配置隔离方案 (Configuration Isolation Strategy)
**策略**: 采用 **"环境变量前缀 + Docker Compose 映射"** 的方式。

这种方案的优点是：
- **统一管理**: 仍然只需要维护一个 `.env` 文件。
- **明确隔离**: 通过前缀（`ADMIN_` / `APP_`）清晰区分两端配置。
- **代码无侵入**: 容器内部代码依然读取标准的 `JWT_EXPIRATION_IN`，无需修改业务代码。

#### 具体实施计划

1.  **更新 `.env` 文件结构**:
    定义公共配置和特定配置。

    ```ini
    # === 公共配置 (Shared) ===
    DB_HOST=postgres
    REDIS_HOST=redis
    ...

    # === Admin 特定配置 (Admin Specific) ===
    ADMIN_JWT_EXPIRATION_IN=4h
    ADMIN_UPLOAD_DIR=./uploads/admin
    ADMIN_APP_PORT=8080

    # === App 特定配置 (App Specific) ===
    APP_JWT_EXPIRATION_IN=7d
    APP_UPLOAD_DIR=./uploads/app
    APP_APP_PORT=8081
    ```

2.  **修改 `docker-compose.yml`**:
    在 `services` 中通过 `environment` 显式映射变量。

    **Admin Service:**
    ```yaml
    admin-server:
      environment:
        - JWT_EXPIRATION_IN=${ADMIN_JWT_EXPIRATION_IN:-4h}
        - UPLOAD_DIR=${ADMIN_UPLOAD_DIR:-./uploads/admin}
        - APP_PORT=${ADMIN_API_PORT:-8080}
        # ... 其他映射
    ```

    **App Service:**
    ```yaml
    app-server:
      environment:
        - JWT_EXPIRATION_IN=${APP_JWT_EXPIRATION_IN:-7d}
        - UPLOAD_DIR=${APP_UPLOAD_DIR:-./uploads/app}
        - APP_PORT=${APP_API_PORT:-8081}
        # ... 其他映射
    ```

### 2.3 待确认的关键配置项

需要确认以下配置是否需要拆分：

| 配置类别 | 变量名 | 建议处理方式 | 备注 |
| :--- | :--- | :--- | :--- |
| **JWT** | `JWT_EXPIRATION_IN` | **拆分** (ADMIN_/APP_) | 用户已确认 |
| **JWT** | `JWT_REFRESH_EXPIRATION_IN` | **拆分** (ADMIN_/APP_) | 用户已确认 |
| **JWT** | `JWT_JWT_ISSUER` | **拆分** (ADMIN_/APP_) | 用户已确认 |
| **JWT** | `JWT_JWT_AUD` | 拆分 | 建议拆分 |
| **Upload** | `UPLOAD_DIR` | **拆分** | 建议物理隔离存储目录 |
| **Upload** | `UPLOAD_MAX_FILE_SIZE` | **拆分** | Admin通常允许更大文件 |
| **App** | `APP_VERSION` | **拆分** | 两端版本号可能不同步 |
| **App** | `APP_FILE_URL_PREFIX` | **拆分** | 访问前缀可能不同 |
| **Redis** | `REDIS_NAMESPACE` | **拆分** | 建议拆分以隔离缓存 (如 `ADMIN:`, `APP:`) |

## 3. 下一步行动 (Action Plan)

1.  **用户确认**: 请确认上述"前缀+映射"方案是否符合您的预期。
2.  **执行修复**:
    - 修改 `libs/base/src/config/validation.config.ts`，放宽校验。
    - 修改 `docker-compose.yml`，添加环境变量映射。
    - 更新 `.env.example` (及提示用户更新本地 `.env`)。

---

**请确认是否同意采用上述方案进行修复和重构？**
