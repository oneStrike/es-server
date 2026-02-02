# TODO: app-api Dockerfile 后续事项

## 1. 待办事项
- [ ] **验证构建**: 在本地或 CI 环境运行 `docker build` 验证镜像能否成功构建。
- [ ] **验证运行**: 启动容器，检查应用能否正常连接数据库并提供服务。
- [ ] **优化依赖**: 考虑整理 `package.json`，分离 `dependencies` 和 `devDependencies`，以减小镜像体积。

## 2. 缺少配置
- 无。
