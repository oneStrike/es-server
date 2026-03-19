# Controller / Route / Swagger 全量审查报告（2026-03-19）

## 1. 审查范围与方法

本次审查覆盖以下范围：

- `apps/admin-api/src/modules/**`
- `apps/app-api/src/modules/**`
- `libs/platform/src/modules/health/**`

审查方式：

- 全量扫描 `*.controller.ts` 与 `*.module.ts`
- 结合 `main.ts`、`app.module.ts`、`setupApp`、Swagger bootstrap 还原真实路由入口
- 结合仓库内现有文档 `task_module_design.md` 提炼项目已显式写下的接口规范

盘点结果：

| 维度 | 数量 |
| --- | ---: |
| controller 文件数 | 54 |
| controller 类数量 | 55 |
| HTTP 路由数量 | 333 |
| admin-api controller 类 | 39 |
| app-api controller 类 | 15 |
| platform controller 类 | 1 |

按应用拆分：

| 应用 | controller 文件 | controller 类 | 路由数 | 说明 |
| --- | ---: | ---: | ---: | --- |
| `admin-api` | 38 | 39 | 255 | 管理端接口最多，存在明显历史并存痕迹 |
| `app-api` | 15 | 15 | 76 | 客户端接口整体更扁平，但局部命名不统一 |
| `platform` | 1 | 1 | 2 | 健康检查路由 |

本报告中的“实际访问路径”均默认带全局前缀 `/api`。例如 `@Controller('admin/task') + @Get('page')` 的实际路径为 `/api/admin/task/page`。

## 2. 审查基线

项目内能明确作为基线使用的规则主要来自两部分：

- `task_module_design.md:37-45`
  - 全局前缀 `/api`
  - 路由约定：`/api/admin/xxx`、`/api/app/xxx`
  - Swagger 统一使用 `ApiDoc / ApiPageDoc`
- 当前代码中的普遍写法
  - controller 尽量只做入参接收与 service 转发
  - 领域逻辑主要下沉到 `libs/*`
  - 管理端与客户端按应用拆分

需要特别说明的是：

- 仓库里没有一份“全项目 controller / route 命名规范”文档。
- 当前项目实际风格更偏向“RPC over HTTP”，不是严格 RESTful。
- 因为缺少全局统一规范，很多结论只能基于“项目显式文档 + 当前主流写法 + 明显异常点”综合判断。

## 3. 总体结论

| 维度 | 结论 | 说明 |
| --- | --- | --- |
| controller 梳理完整性 | 良好 | 已可完整盘点，边界清楚 |
| 标准统一程度 | 偏低 | 存在多套并行命名/路径风格 |
| 模块划分合理性 | 中等 | 宏观合理，局部存在重复与跨层并存 |
| 接口地址规范性 | 中等偏低 | 大量动作型路由，少数路径直接异常 |
| 命名规范性 | 偏低 | `page/list`、`detail/detail-by-*`、`rules-*`、`my-page`、`update-isRecommended` 并存 |
| 冗余接口情况 | 明显存在 | 至少存在别名接口、重复接口族、重复语义接口 |
| 文件目录规范性 | 中等 | 宏观结构清晰，局部目录与路由/模块边界不一致 |
| Swagger 模块划分 | 中等偏低 | 应用级已拆分，但 tag 与响应模型标准不统一 |

一句话结论：

项目在“应用级拆分”和“controller 薄封装”上做得是对的，但在“管理端内容域的历史并存”、“路由命名统一性”、“冗余接口收口”、“Swagger 标签与响应模型统一”这四件事上还没有收干净。

## 4. 做得比较好的地方

- `admin-api` 与 `app-api` 分应用拆分是合理的，职责边界清楚。
- 多数 controller 只负责参数接收和 service 调用，领域逻辑主要放在 `libs/*`，方向正确。
- `PlatformModule` 统一承载了全局验证、拦截器、限流、健康检查等基础能力，基础设施边界较清楚。
- 大多数模块都具备“module -> controller -> service”完整链路，可维护性基础是有的。

## 5. 高优先级问题

### P0-1. 阅读历史路由前缀错误，污染客户端根路由空间

证据：

- `apps/app-api/src/modules/reading-history/reading-history.controller.ts:15`

当前实现：

- `@Controller('app/')`
- 暴露出的实际路径是：
  - `GET /api/app/my`
  - `POST /api/app/delete`
  - `POST /api/app/clear`

问题：

- 该模块目录名是 `reading-history`，但 controller 没有占用自己的资源前缀。
- 它直接把 `my/delete/clear` 暴露到了 `/api/app/*` 根级空间，极易与其他模块冲突。
- 这与 `task_module_design.md:39-41` 中“`/api/app/xxx` 由模块自身占位”的约定明显不一致。

结论：

- 这是当前全项目最不规范的路由定义之一，建议优先修正为 `app/reading-history` 或等价资源前缀。

### P0-2. 管理端公告分页接口被显式公开，存在越权暴露风险

证据：

- `apps/admin-api/src/modules/app-content/announcement/announcement.controller.ts:37-45`
- `libs/app-content/src/announcement/announcement.service.ts:76-104`

当前实现：

- 管理端接口 `GET /api/admin/announcement/page`
- 被标记为 `@Public()`
- 底层服务支持基于 `isPublished`、`isPinned`、`priorityLevel`、`pageId` 等管理字段做全量查询

问题：

- 这是管理端路由，却绕过了全局 JWT 守卫。
- 如果外部可直接访问，会暴露管理视角下的公告筛选能力，未必只限已发布数据。
- 同类管理端分页接口中，只有这里是公开的，口径明显不统一。

结论：

- 除非这是刻意保留的后台公开查询入口，否则应视为安全与权限边界异常。

## 6. 重要问题

### P1-1. 管理端内容域存在两套并行 controller 体系，模块边界重复

证据：

- `apps/admin-api/src/modules/admin.module.ts:17,31,36`
- `apps/admin-api/src/modules/content/content.module.ts:1-23`
- `apps/admin-api/src/modules/work/work.module.ts:1-18`
- `apps/admin-api/src/modules/work/work.controller.ts`
- `apps/admin-api/src/modules/content/comic/core/comic.controller.ts`
- `apps/admin-api/src/modules/content/novel/novel.controller.ts`

现状：

- `AdminModule` 同时引入了 `ContentModule` 和 `WorkModule`
- `WorkModule` 提供泛作品/泛章节/泛内容接口
- `ContentModule` 又提供漫画/小说分支接口

典型重复：

- 泛作品：`/api/admin/work/*`
- 漫画作品：`/api/admin/work/comic/*`
- 小说作品：`/api/admin/work/novel/*`
- 泛章节：`/api/admin/work/chapter/*`
- 漫画章节：`/api/admin/work/comic-chapter/*`
- 小说章节：`/api/admin/work/novel-chapter/*`
- 泛内容：`/api/admin/work/content/comic-content/*`、`/api/admin/work/content/novel-content/*`
- 分支内容：`/api/admin/work/chapter-content/*`、`/api/admin/work/novel-content/*`

问题：

- 同一业务域存在“泛接口族”和“按内容类型拆开的接口族”并行。
- controller 层面已经重复，Swagger 层也会重复。
- 文件目录和聚合模块也被拆成了 `content/*` 与 `work/*` 两块，不利于长期维护。

结论：

- 这是当前管理端最明显的“历史并存未收口”问题。
- 应选定一套为主线，另一套做兼容期后下线。

### P1-2. 泛章节 controller 的语义与实现不一致

证据：

- `apps/admin-api/src/modules/work/work-chapter.controller.ts:15-29`

当前实现：

- 路由前缀：`admin/work/chapter`
- 接口语义：创建“作品章节”
- 实际实现：`createChapter({ ...body, workType: ContentTypeEnum.COMIC })`

问题：

- 路由与文案表达的是“泛作品章节”。
- 实现却把 `workType` 写死为 `COMIC`。
- 这意味着该接口并不是泛章节接口，而是漫画章节接口。

结论：

- 这会误导调用方，也说明 `work/*` 体系和 `content/*` 体系已经发生语义漂移。

### P1-3. 系统配置存在重复别名接口

证据：

- `apps/admin-api/src/modules/system/config/system-config.controller.ts:18-38`

当前实现：

- `GET /api/admin/system/config-detail`
- `GET /api/admin/system/config`

两个接口都返回 `findMaskedConfig()`。

问题：

- 这属于明显的别名型冗余接口。
- 从维护角度看，需要同时维护两个文档入口、两个测试入口、两个调用口径。
- controller 注释里还写了“兼容任务清单要求”，说明项目内标准本身已经发生偏移。

结论：

- 需要确定唯一标准路径，旧路径作为兼容入口时应明确标记 deprecated。

### P1-4. 论坛标签模块存在重复语义接口

证据：

- `apps/admin-api/src/modules/forum/tag/forum-tag.controller.ts:46-62`
- `libs/forum/src/tag/forum-tag.service.ts:382-392`

当前实现：

- `GET /api/admin/forum/tags/system`
- `GET /api/admin/forum/tags/user`

两个接口都调用 `forumTagService.getEnabledTags()`。

问题：

- controller 语义是“系统标签”和“用户标签”。
- service 实现并没有做区分，返回结果完全一致。
- 如果业务上确实需要区分，这里实现是不完整的；如果不需要区分，这里就是冗余接口。

结论：

- 当前接口设计与实现语义不一致，应二选一：补齐区分逻辑，或直接合并。

### P1-5. 任务模块实现与仓库内设计文档不一致

证据：

- 设计文档：`task_module_design.md:160-210`
- 管理端实现：`apps/admin-api/src/modules/task/task.controller.ts:24-97`
- 客户端实现：`apps/app-api/src/modules/task/task.controller.ts:16-79`

设计文档中定义：

- 管理端分页列表：`GET /api/admin/task/list`
- 管理端领取记录分页：`GET /api/admin/task/assignment/list`
- 客户端可领取任务：`GET /api/app/task/list`
- 客户端我的任务：`GET /api/app/task/my`

当前实现却是：

- 管理端：`GET /api/admin/task/page`
- 管理端：`GET /api/admin/task/assignment/page`
- 客户端：`GET /api/app/task/page`
- 客户端：`GET /api/app/task/my-page`

问题：

- 同一个仓库里，“设计文档标准”和“代码实现标准”已经分叉。
- 这会直接影响前后端对齐、Swagger 预期、后续新增模块的命名参考。

结论：

- 当前项目不是“没有标准”，而是“标准未统一到当前实现”。

### P1-6. 健康检查实际路径与 README 不一致

证据：

- 文档：`README.md:167-170`
- 实现：`libs/platform/src/modules/health/health.controller.ts:11,18,48`

README 写的是：

- `GET /api/health`
- `GET /api/ready`

实际实现是：

- `GET /api/system/health`
- `GET /api/system/ready`

问题：

- 这不是简单文案问题。
- 健康检查路径常用于 K8s probe、网关探针、监控配置。
- 文档与代码不一致时，运维配置很容易直接出错。

结论：

- 需要统一 README、部署文档与实际 controller 路径。

### P1-7. 空 controller 已被挂入模块与 Swagger

证据：

- `apps/admin-api/src/modules/content/novel/novel-chapter-comment.controller.ts:1-6`
- `apps/admin-api/src/modules/content/novel/novel.module.ts:9-14`

当前实现：

- `NovelChapterCommentController` 只有 `@Controller` 与 `@ApiTags`
- 没有任何路由方法
- 但已注册到 `NovelModule`

问题：

- 这会制造“有模块名但无接口”的 Swagger 噪音。
- 也会误导后续维护者以为该能力已经落地。

结论：

- 要么补齐接口，要么移出模块与文档。

## 7. 中优先级问题

### P2-1. 路由风格并未统一，当前至少存在四种命名方言

统计结果：

- 333 个路由里，243 个最后一个 path segment 是明显动作词或动作组合
- 149 个方法级路由装饰器使用了前导斜杠
- 12 个 controller 基础路径使用了前导斜杠

当前同时存在的风格：

1. `page/detail/create/update/delete`
   - 例如：`admin/task`、`admin/work/tag`
2. `rules-page/rules-detail/rules-create`
   - 例如：`admin/growth/experience-rules`
3. 资源名后再接动作
   - 例如：`profile/update`、`notification/read-all`、`badges/assign`
4. 根路径或特例路径
   - 例如：`POST /api/app/report`
   - 例如：`GET /api/app/my`

额外不统一点：

- `page` 与 `list` 并存
- `detail` 与 `detail-by-id/detail-by-code` 并存
- `update-status`、`update-enabled`、`update-isRecommended` 并存
- `GET works` / `POST chapter` 这类资源维度也未统一

典型异常：

- `apps/admin-api/src/modules/content/author/author.controller.ts:90`
- 路由为 `POST /api/admin/work/author/update-isRecommended`
- 这里把 camelCase 混进了 path segment，明显不应继续扩散

结论：

- 项目整体并不是“统一的 RPC 风格”，而是多种 RPC 命名习惯混用。

### P2-2. Swagger 分组策略在 admin 与 app 内部都没有完全统一

现状：

- 应用级 Swagger 已拆成两份文档，这一点是合理的
- `setupSwagger` 直接对整个应用生成文档，没有按模块额外拆文档

统计结果：

- admin 侧 tag：34 个分层标签、5 个扁平标签
- app 侧 tag：1 个分层标签、14 个扁平标签

admin 侧不统一示例：

- 分层：`APP管理/页面管理`、`内容管理/分类管理`、`论坛模块/标签管理`
- 扁平：`系统配置`、`字典管理`、`任务管理`、`管理端用户模块`

app 侧不统一示例：

- 扁平：`用户`、`消息中心`、`认证模块`
- 分层：`作品模块/章节`

问题：

- tag 结构本身就是 Swagger 分组入口。
- 如果 tag 层级规则不统一，文档导航体验会比较割裂。
- 另外，空 controller 和冗余路由也会直接污染 Swagger。

结论：

- 应用级拆分是合理的，但模块级 tag 规则需要收敛。

### P2-3. Swagger 响应模型在部分 controller 中不准确

明确示例 1：

- `apps/admin-api/src/modules/forum/tag/forum-tag.controller.ts:19-68`
- 列表、详情、热门、系统、用户、主题标签等多个查询接口，Swagger `model` 都写成了 `CreateForumTagDto`

问题：

- `CreateForumTagDto` 是入参 DTO，不是输出 DTO。
- 用它描述查询响应会导致字段缺失或字段语义错误。

明确示例 2：

- `apps/admin-api/src/modules/growth/experience/experience.controller.ts:71-105`
- `add`、`records-page`、`records-detail`、`user-stats` 等接口都使用 `BaseUserExperienceRuleDto` 作为响应模型

问题：

- “经验规则 DTO” 并不等于“经验记录 DTO”或“用户经验统计 DTO”
- 这会直接降低 Swagger 的可用性和可信度

结论：

- 当前 Swagger 不只是“标签不统一”，还存在“响应模型描述不准确”的问题。

### P2-4. 目录结构在宏观上合理，但局部映射不够顺

宏观上合理：

- `apps/admin-api` / `apps/app-api` / `libs/*` 三级结构成立
- 大部分业务 service 下沉到 `libs/*`

局部问题：

- 同一业务域被拆到 `content/*` 与 `work/*` 两套目录
- `content/comic/core` 与 `content/novel/*` 的层级深度不对称
- `app-content/*` 目录对应的路由并没有保留 `app-content` 概念，而是直接打平到 `admin/agreement`、`admin/announcement`、`admin/app-page`
- `apps/admin-api/src/modules/work/work-content.controller.ts` 一个文件里定义了两个 controller 类，而项目其他大多数 controller 文件是一文件一类

结论：

- 目录结构“可读”，但还没有达到“可作为统一范式复制”的程度。

## 8. 各维度结论

### 8.1 controller 与模块划分

结论：

- 宏观合理，局部重复明显。

判断依据：

- 应用级拆分没问题。
- 业务逻辑放在 `libs/*` 没问题。
- 管理端内容域重复最严重。
- 增长域 controller 命名体系也没有完全对齐。

### 8.2 接口地址是否标准

结论：

- 当前不是严格 RESTful，而是偏 RPC；这本身不是错误，但“RPC 规范”没有统一。

主要表现：

- 分页有 `page`、`list`、`rules-page`
- 详情有 `detail`、`detail-by-id`、`detail-by-code`
- 状态更新有 `update-status`、`update-enabled`、`update-isRecommended`
- 同一项目里还混入了 `POST /api/app/report` 这种更接近 REST 的写法

### 8.3 命名是否标准

结论：

- 不完全标准，且存在明显不统一。

主要问题：

- path segment 出现 camelCase：`update-isRecommended`
- singular / plural 混用：`admin/task`、`admin/app-users`、`admin/forum/tags`
- tag 文案有的带“模块”，有的不带“模块”
- admin 与 app 的 Swagger tag 体系也不同步

### 8.4 是否存在冗余接口

结论：

- 存在，而且不止一处。

已确认的冗余或高度疑似冗余：

- `GET /api/admin/system/config-detail`
- `GET /api/admin/system/config`
- `GET /api/admin/forum/tags/system`
- `GET /api/admin/forum/tags/user`
- `admin/work/*` 与 `admin/work/comic/*` / `admin/work/novel/*` 两套接口族
- `admin/work/content/comic-content/*` 与 `admin/work/chapter-content/*` 两套漫画内容接口族

### 8.5 Swagger 模块划分是否合理

结论：

- 应用级合理，模块级一般。

合理点：

- admin 与 app 分开出 Swagger 文档，这是对的。

不合理点：

- tag 规则不统一
- 空 controller 进入 Swagger
- 别名与冗余接口进入 Swagger
- 部分响应模型与实际返回不一致

## 9. 建议采用的统一标准

### 9.1 短期建议：先统一“当前 RPC 风格”

考虑到项目已有 333 个路由，短期更现实的做法不是一次性全面改成纯 RESTful，而是先把当前主流风格收敛成一套统一规范：

- controller 基础路径不写前导斜杠
- 方法路径不写前导斜杠
- path segment 全部使用 kebab-case
- 一个资源只保留一套命名体系
- 分页统一：二选一固定为 `page` 或 `list`
- 详情统一：固定为 `detail`
- 批量/状态更新统一：例如 `update-status`、`update-enabled`
- 禁止出现 `update-isRecommended` 这类混合风格
- 禁止出现 `@Controller('app/')` 这种根级占位

### 9.2 中期建议：收口重复 controller 族

建议优先处理顺序：

1. 修正 `reading-history` 根路由问题
2. 移除或收口管理端 `work/*` 旧接口族
3. 为系统配置保留一个唯一查询路径
4. 合并论坛标签重复语义接口
5. 移除空 controller

### 9.3 Swagger 统一建议

建议分应用分别收敛：

- admin 侧：全部使用分层 tag
  - 例如：`系统管理/*`、`APP管理/*`、`内容管理/*`、`论坛管理/*`、`用户成长/*`
- app 侧：全部使用扁平 tag，或全部使用统一两级 tag，但不要混用
- Swagger `model` 必须使用输出 DTO，禁止复用 create/update DTO 充当响应模型
- 冗余/兼容接口应显式标记 deprecated

## 10. 附录：Controller 与路由清单

### 10.1 admin-api

- `/admin/app-users` | `AppUserController` | `apps/admin-api/src/modules/app-user/app-user.controller.ts`
  routes: `GET page` ; `GET detail` ; `POST update-profile` ; `POST update-enabled` ; `POST update-status` ; `GET points/stats` ; `GET points/records` ; `POST points/add` ; `POST points/consume` ; `GET experience/stats` ; `GET experience/records` ; `POST experience/add` ; `GET badges` ; `POST badges/assign` ; `POST badges/revoke`
- `/admin/dictionary` | `DictionaryController` | `apps/admin-api/src/modules/dictionary/dictionary.controller.ts`
  routes: `GET page` ; `GET detail` ; `POST create` ; `POST update` ; `POST delete` ; `POST update-status` ; `GET items` ; `GET all-items` ; `POST create-item` ; `POST update-item` ; `POST update-item-status` ; `POST delete-item` ; `POST /item-order`
- `/admin/forum/config` | `ForumConfigController` | `apps/admin-api/src/modules/forum/config/config.controller.ts`
  routes: `GET get` ; `POST update` ; `POST reset` ; `GET history` ; `POST restore` ; `POST delete`
- `/admin/forum/moderators` | `ModeratorController` | `apps/admin-api/src/modules/forum/moderator/moderator.controller.ts`
  routes: `GET list` ; `POST add` ; `POST update` ; `POST remove` ; `POST section-assign`
- `/admin/forum/section-groups` | `ForumSectionGroupController` | `apps/admin-api/src/modules/forum/section-group/forum-section-group.controller.ts`
  routes: `GET page` ; `GET detail` ; `POST create` ; `POST update` ; `POST delete` ; `POST update-enabled` ; `POST swap-sort-order`
- `/admin/forum/sections` | `ForumSectionController` | `apps/admin-api/src/modules/forum/section/forum-section.controller.ts`
  routes: `GET page` ; `GET detail` ; `GET tree` ; `POST create` ; `POST update` ; `POST delete` ; `POST update-enabled` ; `POST swap-sort-order`
- `/admin/forum/tags` | `ForumTagController` | `apps/admin-api/src/modules/forum/tag/forum-tag.controller.ts`
  routes: `GET list` ; `GET detail` ; `GET popular` ; `GET system` ; `GET user` ; `GET topic-tags` ; `POST add` ; `POST update` ; `POST remove` ; `POST assign` ; `POST remove-tag`
- `/admin/growth/badges` | `UserBadgeController` | `apps/admin-api/src/modules/growth/badge/badge.controller.ts`
  routes: `GET page` ; `GET detail` ; `POST create` ; `POST update` ; `POST delete` ; `POST update-status` ; `POST assign` ; `POST revoke` ; `GET users` ; `GET statistics`
- `/admin/growth/experience-rules` | `ExperienceController` | `apps/admin-api/src/modules/growth/experience/experience.controller.ts`
  routes: `GET rules-page` ; `GET rules-detail` ; `POST rules-create` ; `POST rules-update` ; `POST rules-delete` ; `POST add` ; `GET records-page` ; `GET records-detail` ; `GET user-stats`
- `/admin/growth/level-rules` | `LevelRuleController` | `apps/admin-api/src/modules/growth/level-rule/level-rule.controller.ts`
  routes: `GET page` ; `GET detail` ; `POST create` ; `POST update` ; `POST delete` ; `GET user-level-info` ; `POST check-permission` ; `GET statistics`
- `/admin/growth/points-rules` | `PointController` | `apps/admin-api/src/modules/growth/point/point.controller.ts`
  routes: `GET rules-page` ; `GET rules-detail` ; `POST rules-create` ; `POST rules-update`
- `/admin/work` | `WorkController` | `apps/admin-api/src/modules/work/work.controller.ts`
  routes: `POST /create` ; `GET page` ; `GET detail` ; `POST /update` ; `POST /update-status` ; `POST /update-recommended` ; `POST /update-hot` ; `POST /update-new` ; `POST /delete`
- `admin/agreement` | `AgreementController` | `apps/admin-api/src/modules/app-content/agreement/agreement.controller.ts`
  routes: `POST /create` ; `POST /update` ; `POST /update-status` ; `POST /delete` ; `GET /page` ; `GET /detail`
- `admin/announcement` | `AppAnnouncementController` | `apps/admin-api/src/modules/app-content/announcement/announcement.controller.ts`
  routes: `POST /create` ; `GET /page` ; `GET /detail` ; `POST /update` ; `POST update-status` ; `POST /delete`
- `admin/app-config` | `AppConfigController` | `apps/admin-api/src/modules/app-content/config/config.controller.ts`
  routes: `GET /active` ; `POST /update`
- `admin/app-page` | `AppPageController` | `apps/admin-api/src/modules/app-content/page/page.controller.ts`
  routes: `POST /create` ; `GET /page` ; `GET /detail-by-id` ; `GET /detail-by-code` ; `POST /update` ; `POST /batch-delete`
- `admin/audit` | `AuditController` | `apps/admin-api/src/modules/system/audit/audit.controller.ts`
  routes: `GET /page`
- `admin/auth` | `AuthController` | `apps/admin-api/src/modules/auth/auth.controller.ts`
  routes: `GET captcha` ; `POST login` ; `POST logout` ; `POST refresh-token` ; `GET public-key`
- `admin/forum/sensitive-word` | `SensitiveWordController` | `apps/admin-api/src/modules/forum/sensitive-word/sensitive-word.controller.ts`
  routes: `GET /page` ; `POST /create` ; `POST /update` ; `POST /delete` ; `POST /update-status` ; `POST /detect` ; `GET /statistics` ; `GET /statistics/full` ; `POST /replace` ; `POST /detect/highest-level` ; `GET /detect/status` ; `GET /count`
- `admin/forum/topic` | `ForumTopicController` | `apps/admin-api/src/modules/forum/topic/topic.controller.ts`
  routes: `GET /page` ; `GET /detail` ; `POST /create` ; `POST /update` ; `POST /delete` ; `POST /update-pinned` ; `POST /update-featured` ; `POST /update-locked` ; `POST /update-hidden` ; `POST /update-audit-status` ; `POST /increment-view-count`
- `admin/message` | `MessageController` | `apps/admin-api/src/modules/message/message.controller.ts`
  routes: `GET monitor/summary` ; `GET monitor/ws-summary`
- `admin/system` | `SystemConfigController` | `apps/admin-api/src/modules/system/config/system-config.controller.ts`
  routes: `GET config-detail` ; `GET config` ; `POST config-update`
- `admin/system-user` | `AdminUserController` | `apps/admin-api/src/modules/admin-user/admin-user.controller.ts`
  routes: `POST register` ; `POST update-info` ; `GET info` ; `GET info-by-id` ; `GET page` ; `POST change-password` ; `POST reset-password` ; `POST unlock`
- `admin/task` | `TaskController` | `apps/admin-api/src/modules/task/task.controller.ts`
  routes: `POST /create` ; `POST /update` ; `POST /update-status` ; `POST /delete` ; `GET /page` ; `GET /detail` ; `GET /assignment/page`
- `admin/upload` | `UploadController` | `apps/admin-api/src/modules/system/upload/upload.controller.ts`
  routes: `POST /upload-file`
- `admin/work/author` | `WorkAuthorController` | `apps/admin-api/src/modules/content/author/author.controller.ts`
  routes: `POST /create` ; `GET /page` ; `GET /detail` ; `POST /update` ; `POST /update-status` ; `POST /update-isRecommended` ; `POST /delete`
- `admin/work/category` | `WorkCategoryController` | `apps/admin-api/src/modules/content/category/category.controller.ts`
  routes: `POST /create` ; `GET /page` ; `GET /detail` ; `POST /update` ; `POST /update-status` ; `POST /delete` ; `POST /order`
- `admin/work/chapter` | `WorkChapterController` | `apps/admin-api/src/modules/work/work-chapter.controller.ts`
  routes: `POST /create` ; `GET /page` ; `GET /detail` ; `POST /update` ; `POST /delete` ; `POST /swap-sort-order`
- `admin/work/chapter-content` | `ChapterContentController` | `apps/admin-api/src/modules/content/comic/chapter-content/chapter-content.controller.ts`
  routes: `GET /list` ; `POST /add` ; `POST /update` ; `POST /delete` ; `POST /move` ; `POST /clear`
- `admin/work/comic` | `ComicController` | `apps/admin-api/src/modules/content/comic/core/comic.controller.ts`
  routes: `POST /create` ; `GET /page` ; `GET /detail` ; `POST /update` ; `POST /update-status` ; `POST /update-recommended` ; `POST /update-hot` ; `POST /update-new` ; `POST /delete`
- `admin/work/comic-chapter` | `ComicChapterController` | `apps/admin-api/src/modules/content/comic/chapter/comic-chapter.controller.ts`
  routes: `POST /create` ; `GET /page` ; `GET /detail` ; `POST /update` ; `POST /delete` ; `POST /swap-sort-order`
- `admin/work/comic/third-party` | `ComicThirdPartyController` | `apps/admin-api/src/modules/content/comic/third-party/third-party.controller.ts`
  routes: `GET /platform` ; `GET /search` ; `GET /detail` ; `GET /chapter` ; `GET /chapter-content`
- `admin/work/content/comic-content` | `ComicContentController` | `apps/admin-api/src/modules/work/work-content.controller.ts`
  routes: `GET /list` ; `POST /add` ; `POST /update` ; `POST /delete` ; `POST /move` ; `POST /clear`
- `admin/work/content/novel-content` | `NovelContentController` | `apps/admin-api/src/modules/work/work-content.controller.ts`
  routes: `GET /list` ; `POST /add` ; `POST /delete`
- `admin/work/novel` | `NovelController` | `apps/admin-api/src/modules/content/novel/novel.controller.ts`
  routes: `POST /create` ; `GET /page` ; `GET /detail` ; `POST /update` ; `POST /update-status` ; `POST /update-recommended` ; `POST /update-hot` ; `POST /update-new` ; `POST /delete`
- `admin/work/novel-chapter` | `NovelChapterController` | `apps/admin-api/src/modules/content/novel/novel-chapter.controller.ts`
  routes: `POST /create` ; `GET /page` ; `GET /detail` ; `POST /update` ; `POST /delete` ; `POST /swap-sort-order`
- `admin/work/novel-chapter-comment` | `NovelChapterCommentController` | `apps/admin-api/src/modules/content/novel/novel-chapter-comment.controller.ts`
  routes: `(none)`
- `admin/work/novel-content` | `NovelContentController` | `apps/admin-api/src/modules/content/novel/novel-content.controller.ts`
  routes: `GET /content` ; `POST /upload` ; `POST /delete`
- `admin/work/tag` | `WorkTagController` | `apps/admin-api/src/modules/content/tag/tag.controller.ts`
  routes: `POST /create` ; `GET /page` ; `GET /detail` ; `POST /update` ; `POST /update-status` ; `POST /delete` ; `POST /order`

### 10.2 app-api

- `app/` | `ReadingHistoryController` | `apps/app-api/src/modules/reading-history/reading-history.controller.ts`
  routes: `GET my` ; `POST delete` ; `POST clear`
- `app/auth` | `AuthController` | `apps/app-api/src/modules/auth/auth.controller.ts`
  routes: `POST send-verify-code` ; `GET public-key` ; `POST login` ; `POST logout` ; `POST refresh-token` ; `POST forgot-password` ; `POST change-password`
- `app/comment` | `CommentController` | `apps/app-api/src/modules/comment/comment.controller.ts`
  routes: `POST post` ; `POST reply` ; `POST delete` ; `GET my` ; `GET replies`
- `app/dictionary` | `DictionaryController` | `apps/app-api/src/modules/dictionary/dictionary.controller.ts`
  routes: `GET items`
- `app/download` | `DownloadController` | `apps/app-api/src/modules/download/download.controller.ts`
  routes: `GET works` ; `GET work-chapters` ; `POST chapter`
- `app/favorite` | `FavoriteController` | `apps/app-api/src/modules/favorite/favorite.controller.ts`
  routes: `POST favorite` ; `POST cancel` ; `GET status` ; `GET my`
- `app/like` | `LikeController` | `apps/app-api/src/modules/like/like.controller.ts`
  routes: `POST like` ; `POST cancel` ; `GET status` ; `GET my`
- `app/message` | `MessageController` | `apps/app-api/src/modules/message/message.controller.ts`
  routes: `GET notification/list` ; `GET notification/unread-count` ; `POST notification/read` ; `POST notification/read-all` ; `POST chat/direct/open` ; `GET chat/conversation/list` ; `GET chat/conversation/messages` ; `GET inbox/summary` ; `GET inbox/timeline`
- `app/purchase` | `PurchaseController` | `apps/app-api/src/modules/purchase/purchase.controller.ts`
  routes: `GET works` ; `GET work-chapters` ; `POST chapter`
- `app/report` | `ReportController` | `apps/app-api/src/modules/report/report.controller.ts`
  routes: `POST (root)`
- `app/system` | `SystemController` | `apps/app-api/src/modules/system/system.controller.ts`
  routes: `GET /config` ; `GET /page` ; `GET /announcement` ; `GET /agreement` ; `GET /agreement-detail`
- `app/task` | `TaskController` | `apps/app-api/src/modules/task/task.controller.ts`
  routes: `GET /page` ; `GET /my-page` ; `POST /claim` ; `POST /progress` ; `POST /complete`
- `app/user` | `UserController` | `apps/app-api/src/modules/user/user.controller.ts`
  routes: `GET profile` ; `POST profile/update` ; `GET profile/forum` ; `POST profile/forum-update` ; `GET center` ; `GET status` ; `GET assets/summary` ; `GET growth/summary` ; `GET points/stats` ; `GET points/records` ; `GET experience/stats` ; `GET experience/records` ; `GET badges`
- `app/work` | `WorkController` | `apps/app-api/src/modules/work/work.controller.ts`
  routes: `GET hot` ; `GET new` ; `GET recommended` ; `GET page` ; `GET detail` ; `GET forum-section` ; `GET forum-topics`
- `app/work/chapter` | `WorkChapterController` | `apps/app-api/src/modules/work/work-chapter.controller.ts`
  routes: `GET page` ; `GET detail` ; `GET previous-detail` ; `GET next-detail` ; `GET comic-content` ; `GET novel-content`

### 10.3 platform

- `system` | `HealthController` | `libs/platform/src/modules/health/health.controller.ts`
  routes: `GET health` ; `GET ready`

## 11. 最终判断

如果只看“能不能工作”，当前 controller / route 体系是可运行的。

但如果看“是否规范、是否统一、是否适合继续扩展”，当前答案是：

- 宏观结构可用
- 局部标准不统一
- 已出现重复接口族
- Swagger 质量不稳定
- 需要一次面向 controller / route / tag 的规范收口

建议把这次报告作为后续整改基线，优先做“路由错误修正 + 重复接口收口 + Swagger tag/response 收敛”三件事。
