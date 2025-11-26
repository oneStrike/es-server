# Dockerfile和PM2配置文件拆分 - ALIGNMENT文档
## 项目上下文分析

### 现有项目结构
- 这是一个基于NestJS的monorepo项目
- 包含两个独立的API服务：`admin-api` 和 `client-api`
- 两个服务都位于 `apps/` 目录下
- 使用webpack进行构建，支持多项目构建
- 使用PM2作为进程管理器
- 使用Prisma作为ORM

### 技术栈
- Node.js 22 + Alpine Linux
- NestJS框架
- Fastify平台
- Prisma ORM
- PM2进程管理
- Webpack构建工具
- PNPM包管理器

### 现有配置分析
- 根目录有统一的Dockerfile，构建整个项目
- 根目录有统一的ecosystem.config.cjs，管理单个应用实例
- 构建脚本支持分别构建admin-api和client-api
- 当前Dockerfile复制整个项目，但只运行一个服务

## 需求理解确认

### 原始需求
- 将Dockerfile和PM2配置文件拆分到对应的admin-api和client-api项目文件夹中
- 创建两个独立的镜像
- 每个服务有独立的配置

### 边界确认
- ✅ 需要为admin-api创建独立的Dockerfile和PM2配置
- ✅ 需要为client-api创建独立的Dockerfile和PM2配置
- ✅ 需要更新构建和部署脚本
- ❌ 不需要修改应用代码逻辑
- ❌ 不需要修改数据库配置
- ❌ 不需要修改共享依赖

### 需求理解
当前项目是一个monorepo，但admin-api和client-api是两个独立的服务，应该有独立的部署配置。现在的配置会导致：
1. 每个镜像都包含两个服务的代码，浪费空间
2. 无法独立部署和扩展
3. 配置文件耦合，难以维护

### 疑问澄清
1. 两个服务是否使用相同的端口配置？
   - 当前都使用8080端口，但部署时应该不同
2. 两个服务是否有不同的健康检查端点？
   - admin-api使用 `/api/ready`
   - client-api可能需要不同的端点
3. 是否需要保持相同的构建缓存策略？
   - 是的，应该保持相同的缓存优化
4. 是否需要不同的环境变量配置？
   - 是的，每个服务可能有不同的配置需求

## 智能决策策略

### 架构决策
1. **Dockerfile策略**：每个服务独立的Dockerfile，只复制该服务的代码
2. **PM2配置策略**：每个服务独立的ecosystem配置，独立的环境变量
3. **构建策略**：保持现有的webpack构建配置，但分别构建
4. **部署策略**：支持独立部署，每个服务有自己的镜像和配置

### 技术约束
1. 保持现有的Node.js版本和依赖
2. 保持现有的PM2配置特性（日志轮转、健康检查等）
3. 保持现有的安全配置（非root用户、权限设置等）
4. 保持现有的缓存优化策略

### 实现方案
1. 在 `apps/admin-api/` 下创建 `Dockerfile` 和 `ecosystem.config.cjs`
2. 在 `apps/client-api/` 下创建 `Dockerfile` 和 `ecosystem.config.cjs`
3. 更新根目录的package.json脚本，支持分别构建和部署
4. 删除根目录的旧配置文件

## 最终共识

基于以上分析，我将创建两个独立的服务配置，每个服务都有：
- 独立的Dockerfile，只包含该服务的代码和依赖
- 独立的PM2配置，支持独立的环境变量和端口配置
- 保持现有的安全性和性能优化特性
- 支持独立部署和扩展
