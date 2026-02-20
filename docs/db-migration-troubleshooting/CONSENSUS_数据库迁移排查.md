## 结论概览
- 迁移执行依赖 migrator 容器，其镜像与拉取策略存在导致迁移未更新的高风险
- migrator 使用的镜像可能并非最新构建版本，导致最新迁移文件未进入容器
- 迁移命令依赖 Prisma CLI，但运行时镜像只安装生产依赖，存在命令不可用的风险
- 已确认 migrator 执行正常但仅识别 11 个迁移，本地为 13 个，存在迁移文件差异或镜像内容滞后

## 证据与定位
- migrator 使用 es/app/server 镜像并设置 pull_policy: always，存在被远程旧镜像覆盖的风险（docker-compose.yml L60-L68）
- 部署脚本仅构建并启动 app/admin 服务，migrator 依赖镜像是否更新取决于 compose 拉取策略（scripts/auto-deploy.sh L143-L221）
- Dockerfile 运行时阶段只安装生产依赖，而 prisma CLI 位于 devDependencies（Dockerfile L33-L72，package.json L97-L125）

## 可能根因（优先级从高到低）
1. migrator 拉取到旧镜像或构建缓存未更新，容器内 prisma/migrations 数量少于本地
2. 本地新增迁移未进入镜像构建上下文或被忽略，导致容器内迁移目录缺失
3. 服务器 .env 或 DATABASE_URL 指向了非预期数据库

## 建议的验证步骤
- 查看 migrator 日志确认执行成功与迁移数量统计
- 检查 migrator 使用的镜像 ID 与构建时间，确认是否为最新
- 进入 migrator 容器核对 /app/prisma/migrations 的目录数量与本地一致
- 查询数据库 _prisma_migrations 表，核对最新迁移名称与本地一致
- 校验服务器 .env 中 DATABASE_URL 与实际环境一致

## 修复方向（待确认后执行）
- 将 migrator 的 pull_policy 调整为 never 或显式使用本地构建镜像
- 将 prisma CLI 放入生产依赖或为 migrator 使用含 prisma 的专用镜像
- 在部署流程中显式构建并更新 migrator 镜像
