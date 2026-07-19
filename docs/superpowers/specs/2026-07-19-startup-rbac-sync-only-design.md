# 启动期 RBAC 同步作为唯一初始化路径

## 决策

管理端 RBAC 的唯一初始化与收敛路径是 `admin-api` 中
`AdminRbacSyncService.onApplicationBootstrap()`：应用在监听端口前扫描已注册
Controller 的 `@AdminPermission` 元数据，并调用 `AdminRbacService` 在同一事务中
初始化 RBAC 基线、同步权限、停用已移除权限并刷新 revision。

离线 reference bootstrap 不再保留。管理员账号的创建与认证不属于 RBAC reference
初始化职责；现有登录流程可以继续由管理员账号服务处理。

## 删除边界

- 删除 `db/bootstrap/` 及其冻结权限清单。
- 删除仅为该清单服务的生成脚本和 `package.json` 命令。
- 删除 Docker 构建阶段的清单生成。
- 将 README 和 Drizzle 规则改为描述启动期 RBAC 同步；migration 与 demo seed 仍保持
  显式、受控运行。

## 运行顺序

```text
db:migrate
  -> admin-api 启动
    -> Controller metadata 扫描
      -> RBAC 同步事务
        -> app.listen
```

demo seed 不负责创建 RBAC 基线；在需要 demo seed 时，先完成一次 `admin-api` 启动。

## 约束与风险

- 应用启动不执行 migration、reset 或 demo seed。
- 同库管理端滚动发布应避免新旧版本长期并行，以免旧版本将新权限误判为已移除权限。
- 账号认证与角色授权保持独立职责；当前登录响应仍读取 RBAC 快照，因此必须先完成
  启动期同步以确保 revision 可用。
