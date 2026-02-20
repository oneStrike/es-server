## 原始需求
- 数据库迁移服务在服务器上运行后出现数据库不匹配问题
- 先排查问题并生成本地文档，确认后再修复

## 任务边界
- 仅做现状排查与根因分析，不做任何修复性改动
- 输出可操作的排查结论与验证步骤
- 文档生成到本地，待确认后进入修复阶段

## 现有项目理解
- 使用 Prisma 迁移，迁移文件在 prisma/migrations
- docker-compose 中包含 migrator 服务，执行 prisma migrate deploy
- 镜像构建由 scripts/auto-deploy.sh 触发，使用根目录 Dockerfile

## 关键假设
- 服务器通过 docker compose 进行部署和重启
- 数据库不匹配表现为应用运行时找不到表/字段或版本不一致

## 当前不确定性
- 服务器上 migrator 容器的实际日志与退出码
- 服务器数据库中 _prisma_migrations 的最新记录
- 服务器镜像来源（本地构建还是远程拉取）
