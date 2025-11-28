# 修改构建流程：将依赖安装和打包移至CI/CD

## 1. 项目分析
- 项目是使用NestJS的monorepo，包含admin-api和client-api两个应用
- 当前使用多阶段Dockerfile，在builder阶段进行依赖安装和打包
- CI/CD使用GitHub Actions，直接调用docker build命令
- 使用pnpm作为包管理器

## 2. 修改目标
- 将依赖安装和打包步骤从Dockerfile移至CI/CD流程
- Dockerfile仅负责从构建上下文复制打包后的文件
- 保持原有功能不变

## 3. 修改内容

### 3.1 修改CI/CD配置文件（.gitea/workflows/ci.yml）
在docker-build作业中添加以下步骤：
1. 安装pnpm包管理器
2. 使用pnpm安装项目依赖
3. 执行打包命令构建所有应用
4. （可选）执行pnpm prune --prod仅保留生产依赖

### 3.2 修改admin-api Dockerfile
- 移除builder阶段
- 直接从构建上下文复制打包后的文件：
  - node_modules目录
  - dist/apps/admin-api目录
  - package.json
  - prisma目录及相关文件
  - ecosystem.config.cjs

### 3.3 修改client-api Dockerfile
- 移除builder阶段
- 直接从构建上下文复制打包后的文件：
  - node_modules目录
  - dist/apps/client-api目录
  - package.json
  - prisma目录及相关文件
  - ecosystem.config.cjs

## 4. 预期效果
- CI/CD流程负责依赖安装和打包
- Docker镜像构建速度更快，因为不需要在容器内执行构建步骤
- 构建过程更加透明，便于调试
- 保持原有功能不变

## 5. 风险评估
- 需要确保CI/CD环境与Docker构建环境的一致性
- 需要确保打包后的文件路径正确
- 需要测试修改后的流程是否能正常构建和运行
