# Controller / Route / Swagger 整改方案（2026-03-19）

## 0. 当前实施进展（截至 2026-03-19）

### 已完成

- Phase A 已落地：
  - 阅读历史路由已从错误的 `app/` 根路径收口到 `app/reading-history`
  - 管理端公告分页接口已移除 `@Public()`
  - 管理员公开注册入口已关闭，改为受保护的后台能力
  - 健康检查正式路径已统一到 `/api/health`、`/api/ready`
- Phase B 已部分落地：
  - 已清理 controller / 方法级 path 的前导斜杠
  - `my-page` 已改为 `my/page`
  - `config-detail` 已删除
  - `forum/tags/system`、`forum/tags/user` 已收口为 `enabled`
  - 空的 `NovelChapterCommentController` 已移除并删除文件
  - `update-isRecommended` 已改为 `update-recommended`
  - `rules-page`、`records-page`、`detail-by-*` 已按统一口径收口
  - `batch-delete` 已收口为 `delete`
  - `user-stats` 已收口为 `stats`
- Phase C 已部分落地：
  - 已确认正式保留 `modules/content`，直接删除 `modules/work`
  - `apps/admin-api/src/modules/work/*` 已从 admin 模块移除并删除
  - 正式内容路由已统一切到 `admin/content/*`
  - 正式章节内容路由已改为：
    - `admin/content/comic-chapter-content/*`
    - `admin/content/novel-chapter-content/*`
- Phase D 收口已完成：
  - `app/system/page/list` 已改为普通列表 Swagger 描述，不再误标为分页返回
  - `admin/content/comic/third-party` 已修正为与功能匹配的正式路径：
    - `detail`
    - `chapter/list`
    - `chapter-content/detail`
  - 第三方漫画章节与章节内容接口的 query DTO、service 调用参数、Swagger 描述已同步对齐
  - `app/dictionary/items` 已统一为 `app/dictionary/item/list`
  - `admin/upload/upload-file` 已统一为 `admin/upload/file/upload`
- Swagger 已开始统一：
  - app-api 的模块 tag 已收口为扁平分组
  - admin-api 中 `认证与账号/*`、`论坛管理/*`、`系统管理/*` 已完成首轮统一
  - `forum-tag`、`growth/experience` 等模块的输出 DTO 误用已修正
  - 已新增项目级 controller 规范文档：`.trae/rules/CONTROLLER_SPEC.md`

### 当前校验结果

- `pnpm exec tsc -p apps/admin-api/tsconfig.app.json --noEmit` 通过
- `pnpm exec tsc -p apps/app-api/tsconfig.app.json --noEmit` 通过
- 根级 `pnpm exec tsc -p tsconfig.json --noEmit` 仍有仓库既存问题，主要位于：
  - `apps/app-api/test/*`
  - `db/seed/*`
- 以上根级报错不是本轮 controller / route / Swagger 整改引入的问题

## 1. 本轮决策前提

本方案按以下前提执行：

1. 不做 REST 化，继续沿用当前项目的 RPC over HTTP 风格
2. 不做历史兼容，旧路由允许直接删除
3. 不保留 compat / legacy controller
4. 不新增 e2e 测试
5. 本轮目标是“标准化与收口”，不是“重写业务逻辑”

这意味着本轮整改的基本策略是：

- 直接删除错误、冗余、空壳和重复路由
- 直接统一命名、目录与 Swagger 口径
- 用静态检查与人工回归替代 e2e 建设

## 2. 本轮目标

整改目标聚焦四件事：

1. 修正明确错误与安全风险
2. 删除冗余接口和重复 controller 族
3. 统一当前 RPC 风格下的命名与目录
4. 统一 Swagger 标签与响应模型描述

## 3. 约束与边界

### 3.1 不做的事情

- 不把现有接口整体改造成纯 RESTful
- 不为了接口改名去重写 `libs/*` 领域服务
- 不做兼容层、别名层、灰度层
- 不补 e2e 测试体系

### 3.2 可以直接做的事情

- 直接删旧接口
- 直接删空 controller
- 直接删重复别名路由
- 直接重命名不规范 path
- 直接收紧错误的 `@Public()`
- 直接更新 README 和设计文档

## 4. 整改后的统一标准

## 4.1 路由标准

继续采用 RPC 风格，但统一成一套写法：

- controller 基础路径不写前导斜杠
- controller 基础路径不写尾部斜杠
- 方法级路径不写前导斜杠
- path segment 一律使用 `kebab-case`
- path 中禁止出现 camelCase
- 路由前缀继续保留：
  - `/api/admin/*`
  - `/api/app/*`

### 4.1.1 命名标准

建议固定为：

| 场景 | 标准写法 | 示例 |
| --- | --- | --- |
| 分页列表 | `page` | `GET /api/admin/task/page` |
| 非分页列表 | `list` | `GET /api/admin/forum/tags/list` |
| 单条详情 | `detail` | `GET /api/admin/task/detail` |
| 当前用户分页列表 | `my/page` | `GET /api/app/task/my/page` |
| 统计信息 | `stats` | `GET /api/admin/growth/experience-rules/stats` |
| 创建 | `create` | `POST /api/admin/task/create` |
| 更新 | `update` | `POST /api/admin/task/update` |
| 删除 | `delete` | `POST /api/admin/task/delete` |
| 状态变更 | `update-status` | `POST /api/admin/task/update-status` |
| 启用禁用 | `update-enabled` | `POST /api/admin/app-users/update-enabled` |
| 排序调整 | `reorder` 或 `swap-sort-order` | 选一套固定，不再混用 |

### 4.1.2 明确禁止的写法

- `@Controller('app/')`
- `@Controller('/admin/xxx')`
- `@Get('/page')`、`@Post('/create')`
- `update-isRecommended`
- `rules-page`、`records-page`、`my-page`
- `detail-by-id`、`detail-by-code`

## 4.2 目录与 controller 标准

- 一个 controller 文件只放一个 controller 类
- 目录结构必须表达正式模块边界，不表达历史兼容关系
- 聚合模块只负责 `imports`
- 空 controller 不允许进入 module
- controller 只负责：
  - DTO 接收
  - 权限装饰器
  - service 调用
  - Swagger 注解

## 4.3 Swagger 标准

### admin-api

建议统一为两级分组：

- `系统管理/*`
- `APP管理/*`
- `内容管理/*`
- `论坛管理/*`
- `用户成长/*`
- `认证与账号/*`
- `任务管理/*`
- `消息中心/*`

### app-api

建议统一为一级扁平分组：

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

### 响应模型规则

- `ApiDoc / ApiPageDoc` 必须使用输出 DTO
- 禁止把 `CreateXxxDto`、`UpdateXxxDto` 当作响应模型
- 空 controller 不进入 Swagger
- 删除掉的旧接口不出现在 Swagger 中

## 5. 分阶段整改方案

## Phase A：先修风险与明显错误

预计优先级：最高

### A1. 修正阅读历史根路由污染

当前问题：

- `apps/app-api/src/modules/reading-history/reading-history.controller.ts`
- `@Controller('app/')`
- 实际占用了客户端根路径：
  - `GET /api/app/my`
  - `POST /api/app/delete`
  - `POST /api/app/clear`

整改方案：

- 正式路由直接改为：
  - `GET /api/app/reading-history/page`
  - `POST /api/app/reading-history/delete`
  - `POST /api/app/reading-history/clear`
- 直接删除旧根路径写法，不保留别名

涉及文件：

- `apps/app-api/src/modules/reading-history/reading-history.controller.ts`
- `apps/app-api/src/modules/reading-history/reading-history.module.ts`

### A2. 收紧管理端公告分页接口权限

当前问题：

- `apps/admin-api/src/modules/app-content/announcement/announcement.controller.ts`
- `GET /api/admin/announcement/page` 当前带 `@Public()`

整改方案：

- 直接删除 `@Public()`
- 保持走管理端全局 JWT 守卫

涉及文件：

- `apps/admin-api/src/modules/app-content/announcement/announcement.controller.ts`

### A3. 收紧管理员创建入口

当前问题：

- `apps/admin-api/src/modules/admin-user/admin-user.controller.ts`
- `POST /api/admin/system-user/register` 当前是 `@Public()`
- `apps/admin-api/src/modules/admin-user/admin-user.service.ts` 没有“仅首次初始化可用”限制

整改方案：

推荐顺序：

1. 先直接删除 `@Public()`
2. 如果后台页面仍需要“创建管理员”能力，则保留该接口但要求超级管理员权限
3. 如果项目并不需要 HTTP 创建管理员入口，则直接删除 controller 路由，只保留 service 或脚本能力

本轮建议：

- 默认按“受保护的后台管理能力”处理
- 不再保留公开管理员注册入口

涉及文件：

- `apps/admin-api/src/modules/admin-user/admin-user.controller.ts`
- `apps/admin-api/src/modules/admin-user/admin-user.service.ts`

### A4. 统一健康检查正式路径

当前问题：

- README 写的是：
  - `/api/health`
  - `/api/ready`
- 实际 controller 是：
  - `/api/system/health`
  - `/api/system/ready`

整改方案：

- 直接把正式路径改成：
  - `GET /api/health`
  - `GET /api/ready`
- 直接删除 `/api/system/health`、`/api/system/ready`

涉及文件：

- `libs/platform/src/modules/health/health.controller.ts`
- `README.md`

## Phase B：统一命名，删除冗余接口

预计优先级：高

### B1. 去掉前导斜杠与 path 混用

当前问题：

- 12 个 controller 基础路径写了前导斜杠
- 149 个方法路径写了前导斜杠
- 存在 `update-isRecommended` 这类混合命名

整改方案：

- 全量移除 `@Controller('/xxx')`
- 全量移除 `@Get('/xxx')`、`@Post('/xxx')`
- 把 `update-isRecommended` 统一改成 `update-recommended`

涉及重点文件：

- `apps/admin-api/src/modules/content/author/author.controller.ts`
- `apps/admin-api/src/modules/task/task.controller.ts`
- `apps/app-api/src/modules/task/task.controller.ts`
- `apps/app-api/src/modules/system/system.controller.ts`
- `apps/admin-api/src/modules/app-content/*/*.controller.ts`
- 其余所有存在前导斜杠的 controller

### B2. 统一 task 命名

当前问题：

- 当前代码存在 `/api/app/task/my-page`
- 当前正式标准已收口为 `/api/app/task/my/page`

整改方案：

- 直接改成：
  - `GET /api/app/task/page`
  - `GET /api/app/task/my/page`
- 直接删除 `my-page`
- 同步更新 `task_module_design.md`
- 同步把设计文档中的 `list` 口径统一到当前标准 `page`

涉及文件：

- `apps/app-api/src/modules/task/task.controller.ts`
- `task_module_design.md`

### B3. 删除系统配置别名接口

当前问题：

- `GET /api/admin/system/config-detail`
- `GET /api/admin/system/config`
- 两个接口返回完全相同的数据

整改方案：

- 只保留 `GET /api/admin/system/config`
- 直接删除 `config-detail`
- `POST /api/admin/system/config-update` 暂时保留，后续再视整体命名是否改成 `update`

涉及文件：

- `apps/admin-api/src/modules/system/config/system-config.controller.ts`

### B4. 删除论坛标签重复语义接口

当前问题：

- `GET /api/admin/forum/tags/system`
- `GET /api/admin/forum/tags/user`
- 两个接口底层都调用 `getEnabledTags()`

整改方案：

- 正式路径统一为：
  - `GET /api/admin/forum/tags/enabled`
- 直接删除：
  - `GET /api/admin/forum/tags/system`
  - `GET /api/admin/forum/tags/user`

涉及文件：

- `apps/admin-api/src/modules/forum/tag/forum-tag.controller.ts`
- `libs/forum/src/tag/forum-tag.service.ts`

### B5. 删除空 controller

当前问题：

- `apps/admin-api/src/modules/content/novel/novel-chapter-comment.controller.ts`
- 已注册进 module，但没有任何路由

整改方案：

- 直接从 `NovelModule` 中移除
- 如无短期实现计划，直接删除该 controller 文件

涉及文件：

- `apps/admin-api/src/modules/content/novel/novel.module.ts`
- `apps/admin-api/src/modules/content/novel/novel-chapter-comment.controller.ts`

## Phase C：重构内容域 controller 边界

预计优先级：高

这是本轮最核心的收口工作。

### C1. 明确 `admin/work` 与 `admin/content/*` 的正式关系

当前问题：

- 管理端同时存在：
  - `apps/admin-api/src/modules/work/*`
  - `apps/admin-api/src/modules/content/*`
- 两套 controller 族已经发生明显重复

整改目标：

- 最终只能保留一套正式内容管理入口

最终取舍：

- 已正式选择 `content/*` 作为唯一内容管理入口
- 已直接删除 `apps/admin-api/src/modules/work/*`
- 不再保留 `admin/work/page`、`admin/work/detail` 这类聚合兼容入口

涉及文件：

- `apps/admin-api/src/modules/admin.module.ts`
- `apps/admin-api/src/modules/content/content.module.ts`

### C2. 删除伪泛化章节写接口

当前问题：

- `apps/admin-api/src/modules/work/work-chapter.controller.ts`
- 路由语义是“作品章节”
- 实现却把 `create` 写死成 `ContentTypeEnum.COMIC`

整改结果：

- 已直接删除泛章节 controller
- 漫画章节正式路径统一为：
  - `/api/admin/content/comic-chapter/*`
- 小说章节正式路径统一为：
  - `/api/admin/content/novel-chapter/*`

涉及文件：

- `apps/admin-api/src/modules/content/comic/chapter/comic-chapter.controller.ts`
- `apps/admin-api/src/modules/content/novel/novel-chapter.controller.ts`

### C3. 章节内容路由统一显式带类型

当前问题：

- 漫画内容同时存在：
  - `/api/admin/work/content/comic-content/*`
  - `/api/admin/work/chapter-content/*`
- 小说内容同时存在：
  - `/api/admin/work/content/novel-content/*`
  - `/api/admin/work/novel-content/*`

整改结果：

- 正式路径已统一为：
  - `/api/admin/content/comic-chapter-content/*`
  - `/api/admin/content/novel-chapter-content/*`
- 旧的四套路由已直接删除
- `work-content.controller.ts` 已删除
- 正式 controller 保持一文件一类

涉及文件：

- `apps/admin-api/src/modules/content/comic/chapter-content/chapter-content.controller.ts`
- `apps/admin-api/src/modules/content/novel/novel-content.controller.ts`
- `apps/admin-api/src/modules/content/content.module.ts`

### C4. 目录层级收口建议

当前已经按下列方向收口：

- `modules/content/comic/*`
- `modules/content/novel/*`
- `modules/content/common/*`

当前不再保留：

- `modules/compat/*`
- `modules/work`
- 同一资源两套 controller 并行
- 一个文件中定义多个正式 controller

## Phase D：Swagger 与文档收口

预计优先级：中高

### D1. 统一 Swagger tag

admin-api：

- `论坛模块/*` -> `论坛管理/*`
- `管理端认证模块`、`管理端用户模块` -> `认证与账号/*`
- `系统配置` -> `系统管理/系统配置`
- `任务管理`、`消息中心/监控` 等统一到既定分组体系

app-api：

- `认证模块` -> `认证`
- `系统模块` -> `系统`
- `点赞模块` -> `点赞`
- `作品模块/章节` 并入 `作品`

### D2. 修正响应模型

优先修复：

1. `apps/admin-api/src/modules/forum/tag/forum-tag.controller.ts`
   - 不再使用 `CreateForumTagDto` 作为查询返回模型
2. `apps/admin-api/src/modules/growth/experience/experience.controller.ts`
   - 规则、记录、统计分别使用对应输出 DTO
3. `apps/admin-api/src/modules/growth/point/point.controller.ts`
   - 补齐详情、删除等输出模型
4. 其余所有把输入 DTO 误用为输出 DTO 的 controller

### D3. README 与设计文档同步

需要同步的文档：

- `README.md`
- `task_module_design.md`
- 后续新增的统一规范文档

## 6. 验收方式

本轮不做 e2e。

验收方式改为：

### 6.1 静态验收

- 重新扫描 controller 清单，确认不存在：
  - `@Controller('app/')`
  - 空 controller
  - 重复别名路由
  - `update-isRecommended`
  - 前导斜杠路径
- 确认不存在错误公开接口：
  - `admin/announcement/page`
  - `admin/system-user/register`

### 6.2 人工回归

- admin 前端关键菜单能正常进入
- app 端阅读历史、任务、消息、作品详情链路正常
- Swagger 中不再出现空壳模块、重复分组、明显错误的响应模型

### 6.3 文档回归

- README 的健康检查路径与代码一致
- `task_module_design.md` 的 task 路由与代码一致

## 7. 推荐实施顺序

建议拆成四个批次：

### 批次 A：风险修复

- 阅读历史路由修正
- 公告分页去 `@Public()`
- 管理员公开注册入口关闭
- 健康检查正式路径统一

### 批次 B：低风险规范化

- 去掉前导斜杠
- `my-page` -> `my/page`
- 删除 `config-detail`
- `forum/tags/system|user` -> `enabled`
- 删除空 controller

### 批次 C：内容域收口

- 保留 `modules/content`
- 删除 `modules/work`
- 内容路由统一为 `admin/content/*`
- 删除旧内容路由

### 批次 D：Swagger 与文档收口

- tag 统一
- 输出 DTO 统一
- README / task 设计文档同步

## 8. 我建议的最终取舍

如果只保留一条主线，我的建议是：

1. 不做 REST 化
2. 不做历史兼容
3. 直接删除旧路由和重复 controller
4. 先修风险，再收口内容域，再清 Swagger

也就是说，本轮最推荐的正式标准是：

- `page / list / detail / my/page / create / update / delete / update-status`
- `kebab-case`
- 无前导斜杠
- admin 两级 tag，app 一级 tag
- 直接删旧，不保留 compat

## 9. 最终产出建议

本轮整改完成后，建议至少有这些结果：

1. 一组已经收口的 controller 与路由
2. 一份更新后的 README
3. 一份更新后的 `task_module_design.md`
4. 一份可持续复用的 controller / route / Swagger 规范文档

## 10. 下一步建议

建议直接按下面顺序开始实施：

1. 批次 A：先修风险
2. 批次 B：再统一命名
3. 批次 C：最后收口内容域重复 controller

如果需要，我下一步可以直接按这份新版方案开始实施“批次 A”。
