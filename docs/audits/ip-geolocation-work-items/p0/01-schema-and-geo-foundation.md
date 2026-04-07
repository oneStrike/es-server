# P0-01 收口 Schema 与 Geo 基础能力

## 目标

- 为本轮 `6` 张目标表补齐统一属地字段。
- 在 `libs/platform` 内建立唯一的 Geo 解析能力与客户端属地上下文模型。

## 范围

- `db/schema/forum/forum-topic.ts`
- `db/schema/app/user-comment.ts`
- `db/schema/app/app-user-token.ts`
- `db/schema/admin/admin-user-token.ts`
- `db/schema/system/request-log.ts`
- `db/schema/forum/forum-user-action-log.ts`
- `libs/platform/src/modules/geo/*`
- `libs/platform/src/utils/requestParse.ts`
- `libs/platform/src/utils/request-parse.types.ts`
- `libs/platform/src/utils/index.ts`
- `db/comments/generated.sql`
- `package.json`

## 当前代码锚点

- 当前请求解析统一入口：`libs/platform/src/utils/requestParse.ts`
- 当前客户端上下文类型：`libs/platform/src/utils/request-parse.types.ts`
- 当前 token 表已经有 `deviceInfo/ipAddress/userAgent`：
  - `db/schema/app/app-user-token.ts`
  - `db/schema/admin/admin-user-token.ts`
- 当前请求审计表已具备 `ip/userAgent/device`：
  - `db/schema/system/request-log.ts`
- 当前论坛主题、评论、操作日志表尚未具备属地字段：
  - `db/schema/forum/forum-topic.ts`
  - `db/schema/app/user-comment.ts`
  - `db/schema/forum/forum-user-action-log.ts`

## 非目标

- 不在本任务中打通具体业务写入链路。
- 不在本任务中新增后台属地筛选能力。
- 不引入 `jsonb` 地理快照字段。
- 不处理历史数据回填，也不为旧记录设计读路径补算属地。
- 不接入 `db/schema/app/app-agreement.ts` 与 `db/schema/app/user-browse-log.ts`。

## 主要改动

- 为目标 schema 统一新增以下字段，并补齐字段注释：
  - `geoCountry`
  - `geoProvince`
  - `geoCity`
  - `geoIsp`
  - `geoSource`
- 为 `geoSource` 明确固定语义，落库值统一为 `ip2region`。
- 统一属地字段的可空语义，仅要求新写入记录尽力写入；旧记录保持空值。
- 引入 `ip2region.js` 依赖，并确定离线数据文件的仓库路径和加载方式。
- 在 `libs/platform/src/modules/geo/` 下新增统一 Geo 能力 owner：
  - Geo 结果类型
  - `ip2region` 查询封装
  - 组装客户端属地上下文的公共入口
- 目标 schema 新增字段后同步更新 `db/comments/generated.sql`，保证注释产物与表定义一致。
- 明确 Geo 上下文与请求上下文的边界，避免把异步 Geo 查询回塞到纯同步 request parse helper。

## 完成标准

- `6` 张目标表的 schema 字段命名、可空语义和注释完全一致。
- Geo 结果结构在平台层只有一套 owner 定义，不存在业务域自定义重复类型。
- `geoSource` 在平台层固定输出 `ip2region`。
- `db/comments/generated.sql` 已同步更新，`pnpm db:comments:check` 可通过。
- 历史记录无需兼容改造；旧记录 `geo*` 为空值的语义已明确。
- `pnpm db:generate` 的前置修改已准备完成，等待用户执行生成迁移。

## 完成后同步文档

- 更新 [execution-plan.md](../execution-plan.md) 中 `P0-01` 的状态。
- 更新 [development-plan.md](../development-plan.md) 中的实际 Geo owner 路径与数据文件路径。
- 在 [final-acceptance-checklist.md](../checklists/final-acceptance-checklist.md) 记录 schema 与迁移证据。

## 排期引用

- 排期、波次、依赖与状态以 [execution-plan.md](../execution-plan.md) 中的 `P0-01` 为唯一事实源。
