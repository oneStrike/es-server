# 项目 Controller 规范

适用范围：本仓库所有 `apps/admin-api`、`apps/app-api` 的 Controller、Module、Swagger 暴露层。
本文件是仓库内唯一 Controller 规范来源。

## 1. 目标与原则

- **RPC over HTTP**：接口继续采用 RPC 风格，不做 REST 化改造。
- **路径表达语义**：路由路径必须直接表达接口功能，禁止含糊命名。
- **单一正式入口**：同一业务语义只保留一套路由。
- **低耦合**：Controller 只负责入参接收、权限控制、Swagger 注解与调用 Service。
- **统一标准**：命名、目录、Swagger、权限口径必须一致。

## 2. 范围与边界

### 2.1 覆盖范围

- `apps/admin-api/src/modules/**`
- `apps/app-api/src/modules/**`
- 对应的 Swagger 标签、响应模型、模块目录与 controller 组织方式

### 2.2 非目标

- 不改动领域 Service 的核心业务逻辑。
- 不在本规范内讨论 DTO 与数据库实现细节。
- 不为历史路径维护并行的正式暴露层。

说明：

- DTO 规范参考 [.trae/rules/DTO_SPEC.md](D:/code/es/es-server/.trae/rules/DTO_SPEC.md)
- Drizzle 规范参考 [.trae/rules/drizzle-guidelines.md](D:/code/es/es-server/.trae/rules/drizzle-guidelines.md)

## 3. Controller 职责边界

### 3.1 Controller 必须负责

- 接收 `Query`、`Body`、`Param`、`Header`
- 使用鉴权、审计、上下文类装饰器
- 调用上层 Service
- 声明 Swagger 文档

### 3.2 Controller 禁止负责

- 拼装复杂业务逻辑
- 编写数据库查询
- 在 Controller 内定义大段业务转换逻辑
- 为同一能力保留多套正式入口

## 4. 模块与目录规范

### 4.1 模块边界

- 管理端内容域正式入口统一使用 `modules/content/*`。
- 不新增或恢复 `modules/work/*` 作为正式内容暴露层。
- 同一资源禁止并存两套正式 controller。

### 4.2 文件组织

- 一个 controller 文件只允许一个 controller 类。
- 一个 module 文件只负责组装 `imports/controllers/providers/exports`。
- controller 类名、module 类名必须与当前业务域一致。
- 正式命名以当前业务域目录为准，禁止继续使用历史别名作为新入口命名。

### 4.3 推荐目录形式

- `apps/admin-api/src/modules/content/comic/*`
- `apps/admin-api/src/modules/content/novel/*`
- `apps/admin-api/src/modules/content/author/*`
- `apps/admin-api/src/modules/content/category/*`
- `apps/admin-api/src/modules/content/tag/*`

## 5. 路由规范

### 5.1 基础规则

- 路由前缀固定：
  - admin：`/api/admin/*`
  - app：`/api/app/*`
- `@Controller()` 与方法级装饰器禁止前导斜杠。
- 基础路径禁止尾部斜杠。
- path segment 一律使用 `kebab-case`。
- 禁止 camelCase、PascalCase、下划线混用。

### 5.2 通用命名标准

| 场景 | 标准写法 | 示例 |
| --- | --- | --- |
| 分页列表 | `page` | `GET /api/admin/task/page` |
| 非分页列表 | `list` | `GET /api/admin/forum/config/history/list` |
| 单条详情 | `detail` | `GET /api/admin/content/comic/detail` |
| 当前用户分页列表 | `my/page` | `GET /api/app/task/my/page` |
| 创建 | `create` | `POST /api/admin/forum/tags/create` |
| 更新 | `update` | `POST /api/admin/system/update` |
| 删除 | `delete` | `POST /api/admin/content/tag/delete` |
| 状态变更 | `update-status` | `POST /api/admin/content/novel/update-status` |
| 启用禁用 | `update-enabled` | `POST /api/admin/app-users/update-enabled` |
| 统计 | `stats` | `GET /api/admin/growth/badges/stats` |
| 排序交换 | `swap-sort-order` | `POST /api/admin/content/category/swap-sort-order` |

### 5.3 嵌套路由标准

对二级资源，统一使用“资源名 + 标准动作”写法：

- `item/page`
- `item/list`
- `item/create`
- `item/update`
- `item/delete`
- `item/update-status`
- `item/swap-sort-order`
- `record/page`
- `record/detail`
- `history/list`
- `history/restore`
- `history/delete`

示例：

- `GET /api/admin/dictionary/item/page`
- `GET /api/admin/growth/experience-rules/record/page`
- `GET /api/admin/forum/config/history/list`

### 5.4 当前用户场景标准

- 当前用户资料：`profile`
- 当前用户资料更新：`profile/update`
- 当前用户分页集合：`my/page`
- 当前用户子资源分页：`points/record/page`、`experience/record/page`

### 5.5 特殊查询标准

当“详情”存在多个稳定查询键时，允许使用：

- `detail/<lookup-key>`

示例：

- `GET /api/admin/app-page/detail`
- `GET /api/admin/app-page/detail/code`

禁止使用：

- `detail-by-id`
- `detail-by-code`

### 5.6 业务动作型路由

当 CRUD 无法准确表达语义时，允许使用动作型路径，但必须满足：

- 动词准确
- 路径直接体现功能
- 优先使用命名空间形式而不是连字符堆叠

推荐动作：

- `grant`
- `consume`
- `assign`
- `revoke`
- `restore`
- `reset`
- `detect`
- `replace`
- `upload`
- `unlock`

推荐命名空间形式：

- `token/refresh`
- `key/public`
- `password/change`
- `password/reset`
- `password/forgot`
- `verify-code/send`
- `permission/check`
- `monitor/outbox/summary`
- `monitor/ws/summary`

### 5.7 功能与路径必须匹配

- 返回分页结构的接口，路径必须以 `page` 结尾。
- 返回列表结构但不分页的接口，路径必须以 `list` 结尾。
- 返回详情的接口，路径必须含 `detail`。
- 返回统计结果的接口，路径必须含 `stats`。
- 上传接口，路径必须含 `upload`。
- 刷新令牌接口，路径必须含 `refresh`。
- 公钥接口，路径必须含 `key/public`。

## 6. 禁止写法

禁止出现以下模式：

- `@Controller('/admin/xxx')`
- `@Get('/page')`
- `@Post('/create')`
- `detail-by-id`
- `detail-by-code`
- `rules-page`
- `records-page`
- `my-page`
- `config-update`
- `update-isRecommended`
- `admin/work/*`

## 7. Swagger 规范

### 7.1 标签规范

admin-api 使用两级分组：

- `系统管理/*`
- `APP管理/*`
- `内容管理/*`
- `论坛管理/*`
- `用户成长/*`
- `认证与账号/*`
- `任务管理/*`
- `消息中心/*`

app-api 使用一级分组：

- `认证`
- `用户`
- `任务`
- `作品`
- `阅读记录`
- `评论`
- `点赞`
- `收藏`
- `消息`
- `下载`
- `购买`
- `系统`
- `举报`
- `字典`

### 7.2 响应模型规范

- `ApiDoc`、`ApiPageDoc` 必须使用输出 DTO 或基础类型作为响应模型。
- 禁止用 `CreateXxxDto`、`UpdateXxxDto` 作为输出模型。
- 当现有领域 DTO 无法准确表达返回结构时，必须在 apps 层补充专用响应 DTO。
- 使用 `ApiPageDoc` 的接口必须真实返回分页结构。

### 7.3 变更类接口返回规范

- 对 `create`、`update`、`delete`、`update-status`、`update-enabled`、`swap-sort-order` 等增删改接口，除非存在明确业务需求，否则 Controller 统一只返回 `boolean` 状态。
- 对应的 Service 方法默认也只返回 `boolean` 或 `Promise<boolean>`，禁止为了形式统一额外包装无意义的成功对象。
- 当写操作只需要判断是否成功时，禁止无意义使用 Drizzle 的 `returning()`；只有确实需要返回新增/更新后的数据，或需要依赖返回值继续完成后续业务处理时才允许使用。

## 8. 权限与审计规范

- admin-api 默认受保护，除认证与明确公开能力外，禁止使用 `@Public()`。
- 变更类 admin 接口优先补齐审计装饰器。
- `@Public()` 必须与接口语义相符，不能因为调试方便开放后台接口。

## 9. 维护规则

- 正式路由只保留一套入口，不维护 `compat`、`legacy` controller。
- 设计文档、Swagger、实际代码必须同步更新。
- 新增接口前先检查是否已存在同语义路径或同职责 controller。

## 10. 实现检查顺序

1. 先确认资源是否已有正式入口。
2. 确认接口属于分页、列表、详情、统计还是业务动作。
3. 选择对应的标准路径与 tag。
4. 确认输入 DTO、输出 DTO、Swagger 文档匹配。
5. 确认 admin 接口权限与审计装饰器正确。
6. 对增删改接口确认是否可以收敛为 `boolean` 返回，并检查 Service 与数据库写操作未引入无意义 `returning()`。
7. 变更后执行类型检查，并复扫路径语义是否一致。

## 11. 验收清单

- [ ] 不存在 `admin/work/*` 正式路由。
- [ ] 不存在前导斜杠写法。
- [ ] 分页接口统一以 `page` 结尾。
- [ ] 非分页列表统一以 `list` 结尾。
- [ ] 详情接口统一使用 `detail`。
- [ ] 当前用户分页集合统一使用 `my/page`。
- [ ] 统计接口统一使用 `stats`。
- [ ] Swagger 未使用输入 DTO 作为输出模型。
- [ ] 增删改接口在无特殊需求时统一返回 `boolean`，对应 Service 方法同步收敛。
- [ ] 数据写操作未为“仅返回成功状态”而无意义使用 Drizzle `returning()`。
- [ ] admin 公开接口均经过明确确认。
- [ ] `apps/admin-api` 与 `apps/app-api` 的类型检查通过。
