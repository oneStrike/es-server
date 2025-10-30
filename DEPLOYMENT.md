# 🚀 Docker 部署指南

## 快速开始

### 1. 环境准备

```bash
# 复制环境变量模板
cp .env.production.example .env

# 编辑 .env 文件，修改以下必要配置：
# - POSTGRES_PASSWORD（数据库密码）
# - ADMIN_JWT_SECRET（管理端 JWT 密钥）
# - ADMIN_JWT_REFRESH_SECRET（管理端刷新令牌密钥）
# - CLIENT_JWT_SECRET（客户端 JWT 密钥）
# - CLIENT_JWT_REFRESH_SECRET（客户端刷新令牌密钥）
```

生成强随机密钥：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. RSA 密钥准备

```bash
# 创建 RSA 密钥目录
mkdir -p rsa

# 生成 Admin RSA 密钥对
openssl genrsa -out rsa/admin_private.key 2048
openssl rsa -in rsa/admin_private.key -pubout -out rsa/admin_public.key

# 生成 Client RSA 密钥对
openssl genrsa -out rsa/client_private.key 2048
openssl rsa -in rsa/client_private.key -pubout -out rsa/client_public.key

# 设置权限（Linux/Mac）
chmod 600 rsa/*.key
```

### 3. 启动服务

```bash
# 使用 Docker Compose 启动所有服务
pnpm docker:up

# 查看应用日志
pnpm docker:logs

# 停止服务
pnpm docker:down
```

### 4. 数据库迁移（首次部署）

```bash
# 进入应用容器
docker exec -it akaiito-app sh

# 运行迁移
npm run prisma:migrate:deploy

# 退出容器
exit
```

## 访问地址

- **应用**: http://localhost:3000
- **API 文档**: http://localhost:3000/api/docs
- **健康检查**: http://localhost:3000/api/health
- **Nginx（如启用）**: http://localhost

## 生产部署检查清单

- [ ] 修改所有默认密码和密钥
- [ ] 配置 SSL/TLS 证书（Nginx）
- [ ] 设置防火墙规则
- [ ] 配置日志收集系统
- [ ] 设置自动备份（数据库、上传文件）
- [ ] 配置监控告警
- [ ] 禁用 Swagger 文档（生产环境）
- [ ] 启用 Redis 密码认证
- [ ] 配置 CDN（静态资源）

## 常用命令

```bash
# 重启应用容器
pnpm docker:restart

# 查看所有容器状态
docker-compose ps

# 进入应用容器
docker exec -it akaiito-app sh

# 查看数据库日志
docker-compose logs -f postgres

# 清理所有容器和数据卷（危险操作！）
docker-compose down -v
```

## 故障排查

### 容器启动失败
```bash
# 查看详细日志
docker-compose logs app

# 检查环境变量
docker-compose config
```

### 数据库连接失败
```bash
# 检查数据库是否就绪
docker-compose exec postgres pg_isready -U postgres

# 进入数据库
docker-compose exec postgres psql -U postgres -d akaiito
```

### 健康检查失败
```bash
# 手动测试健康检查
curl http://localhost:3000/api/health
```

## 性能优化建议

1. **生产环境禁用 HMR**：确保 `NODE_ENV=production`
2. **启用 Nginx 缓存**：配置静态资源缓存策略
3. **数据库连接池**：调整 Prisma 连接池大小
4. **Redis 持久化**：根据需求配置 AOF/RDB
5. **日志输出优化**：生产环境使用 `info` 级别

## 安全加固

1. **非 root 运行**：容器已配置 `nestjs` 用户
2. **最小权限原则**：RSA 密钥只读挂载
3. **安全头配置**：Nginx 已配置标准安全头
4. **限流保护**：应用层已集成 `@nestjs/throttler`
5. **CSRF 保护**：已启用 `@fastify/csrf-protection`

## 监控指标

推荐监控以下指标：
- 容器 CPU/内存使用率
- 应用响应时间
- 数据库连接数
- Redis 内存使用
- 请求错误率
- 日志错误频率
