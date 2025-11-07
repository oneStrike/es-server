# PM2 运行与运维指南

本项目在 Docker 中采用 `pm2-runtime` 管理 Node 进程，配置文件位于 `ecosystem.config.mjs`。

## 启动方式

- 本地（生产模拟）：`pnpm run start:pm2`
- 本地（开发）：`pnpm run pm2:start`，然后 `pnpm run pm2:logs`
- Docker：镜像内默认 `CMD ["pm2-runtime", "ecosystem.config.mjs"]`

## 关键环境项

- `PM2_INSTANCES`: 进程实例数，默认 `1`（容器中推荐单进程）。设置为 `max` 或具体数字启用多实例。
- `PM2_EXEC_MODE`: 执行模式，`fork`（默认）或 `cluster`。
- `PM2_MAX_MEMORY`: 超过该内存自动重启，默认 `512M`。

## 日志策略

- 标准输出：`logs/app-out.log`
- 错误输出：`logs/app-error.log`
- 已启用 `merge_logs: true` 便于多实例合并查看。
- 轮转通过 `pm2-logrotate` 插件实现（镜像内已安装）：
  - 大小：`max_size=50M`
  - 保留：`retain=7`（保留 7 份）
  - 压缩：`compress=true`
  - 时间格式：`YYYY-MM-DD_HH-mm-ss`
  - 轮转间隔：`0 */6 * * *`（每 6 小时）

如果需要在本地安装或调整，执行：

```
pnpm run pm2:install-logrotate
```

## 健康检查

- 存活：`GET /api/health` 返回 `200` 表示进程健康。
- 就绪：`GET /api/ready` 包含数据库与缓存检查，`200`/`503` 表示就绪/未就绪。
- Dockerfile 已配置 `HEALTHCHECK` 指向 `/api/ready`。

## 部署与迁移

- `docker-compose.yml` 在启动前执行 Prisma migration 与 seed，然后以 `pm2-runtime` 启动服务。

## 监控与告警建议

- 基础：`pnpm run pm2:status`、`pnpm run pm2:logs`、`pnpm run pm2:flush`。
- 实时：`pm2 monit` 可查看 CPU/内存/事件。
- 更高级监控：接入 PM2.io（Keymetrics）。
  - 参考 https://pm2.keymetrics.io/docs/usage/use-pm2-with-cloud-providers/
  - 支持应用指标、告警、异常追踪与性能分析。
- 告警建议：
  - 进程重启频繁（指数退避触发次数过多）。
  - 内存超过 `PM2_MAX_MEMORY`。
  - `/api/ready` 返回 `503` 连续超过 N 次。

## 故障恢复测试

1. 本地启动：`pnpm run start:pm2`
2. 模拟崩溃：向进程发送 `SIGTERM` 或引入抛错（在某路由中暂时抛出异常）。
3. 观察：`pm2 status` 中应看到自动重启；`pm2 logs` 中可查看崩溃与重启记录。

## 参考

- Docker 集成官方文档：https://pm2.keymetrics.io/docs/usage/docker-pm2-nodejs/
- Ecosystem 配置：https://pm2.keymetrics.io/docs/usage/application-declaration/