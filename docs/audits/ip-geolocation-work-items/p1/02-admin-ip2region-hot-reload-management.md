# P1-02 打通管理端 xdb 上传与当前进程热切换

## 目标

- 为管理端提供专用的 `ip2region_v4.xdb` 上传入口。
- 让接收上传请求的当前 API 进程在上传成功后立即切换到新的 `xdb` 查询库。

## 范围

- `apps/admin-api/src/modules/system/ip2region/*`
- `apps/admin-api/src/modules/admin.module.ts`
- `libs/platform/src/modules/geo/*`
- `libs/platform/src/config/validation.config.ts`
- `.env.example`

## 当前代码锚点

- `GeoService` 当前只在进程内懒加载一次查询器，不支持运行时重载：
  - `libs/platform/src/modules/geo/geo.service.ts`
- `GeoModule` 当前仅暴露查询能力，没有状态查询或管理接口：
  - `libs/platform/src/modules/geo/geo.module.ts`
  - `libs/platform/src/modules/geo/index.ts`
- admin 端当前只有通用文件上传接口，不适合承载运行时 `xdb` 资产：
  - `apps/admin-api/src/modules/system/upload/upload.controller.ts`
  - `libs/platform/src/modules/upload/upload.service.ts`
  - `libs/platform/src/config/upload.config.ts`
- 当前环境变量校验中未定义 `ip2region` 专用存储目录：
  - `libs/platform/src/config/validation.config.ts`
  - `.env.example`

## 非目标

- 不复用现有通用上传模块，也不把 `xdb` 暴露为静态访问文件。
- 不在本任务中接入 `ip2region_v6.xdb` 或 IPv6 管理能力。
- 不在本任务中实现自动下载上游 `xdb`、定时更新或版本同步任务。
- 不在本任务中提供可视化回滚页面；仅保留历史版本文件，供后续回滚使用。
- 不处理跨 API 进程或跨实例的广播重载；若 `admin-api` 与 `app-api` 分离运行，本任务只保证接收上传请求的当前进程立即生效。

## 主要改动

- 新增 admin 专用 `ip2region` 管理模块与接口：
  - `POST /admin/system/ip2region/upload`
  - `GET /admin/system/ip2region/status`
- 为 `GeoService` 增加受控热切换能力：
  - 校验上传文件名、扩展名、大小与 `xdb` 结构
  - 基于新文件创建查询器
  - 在新查询器创建成功后原子替换当前实例
  - 替换完成后关闭旧查询器
- 增加 `ip2region` 专用本地存储目录约定，区分：
  - `tmp`
  - `versions`
  - `active`
- 增加当前活动库元信息与状态查询输出，便于排障与验收。
- 为上传与切换过程补充审计与结构化日志，明确记录操作人、文件名、文件大小与切换结果。
- 约束并发上传行为：同一时刻只允许一个重载流程执行，避免查询器状态互相覆盖。

## 完成标准

- 管理端可以上传合法的 `ip2region_v4.xdb` 文件，并让当前进程立即切换到新库。
- 上传损坏文件、非法文件名或非法扩展名时，接口返回明确错误，当前在线查询能力不受影响。
- `GET /admin/system/ip2region/status` 可以返回当前生效文件路径、文件名、大小与生效时间等状态信息。
- 服务重启后优先加载 `active` 目录下最后一次生效的 `xdb` 文件。
- `xdb` 文件不复用通用上传链路，也不会落到公开静态目录。
- 若存在并发上传请求，后续请求会被明确拒绝，避免热切换过程出现状态竞争。

## 完成后同步文档

- 更新 [execution-plan.md](../execution-plan.md) 中 `P1-02` 的状态。
- 更新 [development-plan.md](../development-plan.md) 中热切换影响模块、验证重点与部署边界说明。
- 在 [final-acceptance-checklist.md](../checklists/final-acceptance-checklist.md) 记录管理端上传、热切换与状态查询证据。

## 排期引用

- 排期、波次、依赖与状态以 [execution-plan.md](../execution-plan.md) 中的 `P1-02` 为唯一事实源。
