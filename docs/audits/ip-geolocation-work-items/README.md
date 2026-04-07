# IP 属地接入工作包

## 文档职责

- 本目录承载 `ip2region` 开源版接入的工作包文档集。
- 排期、依赖、状态仅在 [execution-plan.md](./execution-plan.md) 维护。
- 单任务文档只描述本任务的目标、范围、改动和完成标准，不维护第二套排序。
- 验收结论与证据统一沉淀到 [final-acceptance-checklist.md](./checklists/final-acceptance-checklist.md)。

## 阅读顺序

1. [execution-plan.md](./execution-plan.md)
2. [development-plan.md](./development-plan.md)
3. `p0/`、`p1/` 目录下的单任务文档
4. [final-acceptance-checklist.md](./checklists/final-acceptance-checklist.md)

## 已确认业务口径

- 数据源限定为 `ip2region` 开源版离线库，不引入商业版字段。
- 属地字段统一采用普通列，不使用 `jsonb`。
- 统一字段集固定为：
  - `geoCountry`
  - `geoProvince`
  - `geoCity`
  - `geoIsp`
  - `geoSource`
- `geoSource` 固定写死为 `ip2region`。
- 本轮只覆盖新写入数据，不兼容历史数据。
- 不做历史数据回填，不在读路径按现存 IP 反查补算属地；旧记录缺少 `geo*` 字段时按空值处理。
- 论坛主题需要在 app 端现有列表接口与详情接口中返回归属地字段。
- 评论属地按全站评论能力收口：凡复用评论列表、回复列表、目标评论列表 DTO 的 app 端现有接口，本轮统一返回归属地字段。
- 后台审计日志页面、论坛操作日志页面本轮不开放属地筛选条件。
- 后台若因现有查询实现或共享 DTO 复用而被动返回只读属地字段，不视为范围扩散；本轮仍不新增基于属地的查询、排序或业务判断。

## 本轮范围

- 目标表共 `6` 张：
  - `db/schema/forum/forum-topic.ts`
  - `db/schema/app/user-comment.ts`
  - `db/schema/app/app-user-token.ts`
  - `db/schema/admin/admin-user-token.ts`
  - `db/schema/system/request-log.ts`
  - `db/schema/forum/forum-user-action-log.ts`
- 目标链路：
  - Geo 平台能力封装
  - auth 登录态持久化
  - 审计请求日志
  - 论坛主题创建与 app 端列表 / 详情返回
  - 评论创建 / 回复与全站 app 端评论能力返回
  - 论坛主题相关操作日志写入

## 非本轮范围

- `db/schema/app/app-agreement.ts`
- `db/schema/app/user-browse-log.ts`
- 商业版 `ip2region` 字段建模
- 历史数据回填与读路径补算属地
- 后台审计日志页面、论坛操作日志页面的属地筛选能力
- 新增 app 端评论 detail 路由

## 目录说明

- [p0](./p0)：高优先级任务单
- [p1](./p1)：次优先级任务单
- [checklists](./checklists)：验收清单与证据记录
