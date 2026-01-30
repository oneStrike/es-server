# 部署配置对齐与分析文档

## 1. 项目上下文分析

### 1.1 项目结构
- **类型**: NestJS Monorepo (pnpm workspace)
- **应用**:
  - `apps/admin-api`: 管理端 API
  - `apps/app-api`: 用户端 API
- **基础设施**:
  - PostgreSQL (数据库)
  - Redis (缓存)
  - Docker & Docker Compose (容器化部署)

### 1.2 现有 `docker-compose.yml` 分析
- **服务包含**:
  - `postgres`: 数据库服务
  - `redis`: 缓存服务
  - `admin-server`: 管理端后端
  - `app-server`: 用户端后端
  - `admin`: 前端静态资源服务 (推测)
- **网络**: 统一使用 `app-network`。
- **持久化**: 定义了 `postgres-data`, `redis-data`, `uploads-data`, `logs-data`。

### 1.3 发现的问题
1.  **环境变量冗余与冲突**:
    - `postgres` 服务同时使用了 `env_file` 和 `environment` 定义 `POSTGRES_*` 变量。
    - 多个服务重复定义数据库连接串构建逻辑。
2.  **硬编码值**:
    - 用户 ID `1001:1001` 被硬编码，可能导致权限问题。
    - 密钥路径硬编码。
3.  **配置不完整**:
    - 根目录 `.env.example` 缺失大量关键配置。
    - `app-server` 需要阿里云相关配置，但在 `docker-compose.yml` 中未明确体现（可能通过 `.env` 传递，但需确认）。
4.  **端口映射**:
    - 端口映射直接硬编码（如 `8080:8080`），建议参数化以避免冲突。

## 2. 环境变量清单整理 (已验证)

以下是基于代码审查 (`libs/base/src/config/*.ts`, `prisma.config.ts`) 整理的完整环境变量清单。

### 2.1 必需配置 (Required)
缺失这些配置将导致服务无法启动或核心功能（数据库、缓存）失效。

| 变量名 | 示例值 | 说明 | 来源 |
| :--- | :--- | :--- | :--- |
| `DB_HOST` | localhost / postgres | 数据库主机 | `db.config.ts` |
| `DB_PORT` | 5432 | 数据库端口 | `db.config.ts` |
| `DB_USER` | postgres | 数据库用户 | `db.config.ts` |
| `DB_PASSWORD` | - | 数据库密码 | `db.config.ts` |
| `DB_NAME` | es_db | 数据库名 | `db.config.ts` |
| `DATABASE_URL` | postgresql://... | Prisma 连接串 (需与上述一致) | `prisma.config.ts` |
| `REDIS_HOST` | localhost / redis | Redis 主机 | `redis.config.ts` |
| `REDIS_PORT` | 6379 | Redis 端口 | `redis.config.ts` |
| `REDIS_PASSWORD` | - | Redis 密码 | `redis.config.ts` |

### 2.2 推荐配置 (Recommended)
通常需要设置，但代码中有默认回退值。

| 变量名 | 代码默认值 | 说明 |
| :--- | :--- | :--- |
| `NODE_ENV` | production | 环境 (development/production) |
| `APP_PORT` | 8080 | 应用内部监听端口 |
| `APP_NAME` | admin-api / app-api | 应用名称 |
| `TZ` | - | 时区 (Docker容器推荐设置 Asia/Shanghai) |

### 2.3 可选配置 (Optional)
有明确默认值，仅需自定义时修改。

**认证 (Auth)**
| 变量名 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `JWT_EXPIRATION_IN` | 4h | Access Token 有效期 |
| `JWT_REFRESH_EXPIRATION_IN` | 7d | Refresh Token 有效期 |
| `JWT_JWT_ISSUER` | es | 发签人 |
| `JWT_JWT_AUD` | es | 受众 |
| `JWT_STRATEGY_KEY` | jwt | 策略键名 |

**日志 (Logger)**
| 变量名 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `LOG_LEVEL` | warn(prod)/info(dev) | 日志级别 |
| `LOG_PATH` | ./logs | 日志路径 |
| `LOG_MAX_SIZE` | 20m | 单个日志文件大小 |
| `LOG_RETAIN_DAYS` | 7d | 日志保留天数 |

**文件上传 (Upload)**
| 变量名 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `UPLOAD_DIR` | ./uploads | 上传目录 |
| `UPLOAD_MAX_FILE_SIZE` | 100MB | 最大文件限制 |

**数据库调优**
| 变量名 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `DB_PAGINATION_PAGE_SIZE` | 15 | 默认分页大小 |
| `DB_MAX_QUERY_LIST_LIMIT` | 500 | 最大查询列表限制 |

**RSA 密钥**
| 变量名 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `RSA_PUBLIC_KEY_PATH` | ./jwt_public.key | 公钥路径 (Docker下建议映射到 /app/secrets) |
| `RSA_PRIVATE_KEY_PATH` | ./jwt_private.key | 私钥路径 (Docker下建议映射到 /app/secrets) |
| `RSA_PUBLIC_KEY` | - | 公钥内容 (覆盖文件) |
| `RSA_PRIVATE_KEY` | - | 私钥内容 (覆盖文件) |

**PM2 进程管理 (仅生产环境/Docker)**
| 变量名 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `PM2_INSTANCES` | 1 | 实例数量 (设置为 max 可利用多核) |
| `PM2_EXEC_MODE` | fork | 执行模式 (cluster 为集群模式) |
| `PM2_MAX_MEMORY` | 512M | 内存上限重启阈值 |

### 2.4 功能特性配置 (Feature Flags)

**阿里云短信 (仅当使用短信功能时必需)**
| 变量名 | 说明 |
| :--- | :--- |
| `ALIYUN_SMS_ENDPOINT` | 短信服务 Endpoint |
| `ALIYUN_SMS_SIGN_NAME` | 签名名称 |
| `ALIBABA_CLOUD_ACCESS_KEY_ID` | AccessKey ID |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | AccessKey Secret |

## 3. 改进方案建议

### 3.1 优化 `docker-compose.yml`
- **移除冗余配置**: 清理 `postgres` 服务中重复的环境变量定义。
- **参数化端口**: 使用 `${ADMIN_API_PORT:-8080}` 形式。
- **统一环境变量**: 确保所有服务都能从 `.env` 读取必要配置，移除硬编码。
- **权限修复**: 建议移除 `user: '1001:1001'` 或提供更灵活的 UID/GID 配置方式，防止挂载卷权限错误。

### 3.2 完善 `.env.example`
- 在根目录创建一个完整的 `.env.example`，包含所有服务所需的变量，并附带详细注释。

### 3.3 验证计划
1.  修改配置文件。
2.  使用 `docker-compose config` 验证语法。
3.  (可选) 本地启动测试。

## 4. 待确认事项
1.  是否同意移除 `user: '1001:1001'` 配置？通常在容器内以 root 运行或由基础镜像指定用户更为通用，除非有特定宿主机权限要求。
2.  是否需要保留 `.admin-server.env` 和 `.app-server.env` 这种多文件模式，还是倾向于统一管理？建议统一管理以减少维护成本。
