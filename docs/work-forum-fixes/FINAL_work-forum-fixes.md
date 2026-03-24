# Work Forum Fixes Final

## 交付摘要

本次已完成作品模块与论坛模块联动问题的集中修复，并同步补齐 app/admin 两侧的 DTO 与接口契约文档。
本轮新增完成论坛审查报告中的两项 P0、forum profile 的点赞/收藏计数闭环、用户确认后的 forum config 模块整体下线，以及剩余 4 项论坛 P1 整改收口。

## 主要改动

- 作品链路：
  - 管理端发布状态更新改为走 `WorkService.updateStatus`
  - 作品创建/更新时同步 forum section 的 `isEnabled/name/description`
  - app 侧作品详情、作品论坛入口、作品列表统一限制为已发布作品
  - `getWorkPage` 补齐筛选条件并优化作者/标签过滤
- forum topic 链路：
  - 收窄更新 DTO
  - 删除 topic 时修复误删评论问题
  - 新增公开 topic page/detail 与用户态 create/update/delete
  - forum comment 触发的 topic/section/profile 计数与最近活跃字段同步修复
  - forum topic 的 like/favorite resolver 改为同事务联动更新 topic 计数与作者 `forum_profile` 计数
- forum moderator / profile 链路：
  - moderator service 改为领域类型入参，创建/更新/assign-section 统一同步 `forum_moderator_section`
  - 超级版主权限改为显式枚举白名单，避免数值枚举反射写入字符串脏值
  - admin moderator controller 的 delete / assign-section 返回模型与真实返回对齐
  - `BaseForumProfileDto` 收回到 `forum_profile` 真实字段，用户状态与积分信息改回 `app_user` / `level` 组合映射
  - admin forum topic detail 改为从 `topic.user` / `topic.user.level` 读取 `points/levelId/status/ban*`
  - forum profile 状态更新补齐 `banUntil`
- forum config 链路：
  - 删除 `forum_config`、`forum_config_history` schema 与 Drizzle relations
  - 删除 `libs/forum/src/config` 与 `apps/admin-api/src/modules/forum/config` 整条链路
  - `ForumTopicService` 不再依赖全局 forum config，主题审核策略改为直接读取 `forum_section.topicReviewPolicy`
  - 新增迁移 `db/migration/20260319080920_drop_forum_config_tables`
- forum rule / search / notification 链路：
  - 新增 `ForumPermissionService`，将 `forum_section.userLevelRuleId` 真实接入主题公开访问、发帖、回帖与公开搜索
  - `ForumSectionService.updateSection` 补齐 `userLevelRuleId` 更新校验，避免无效规则 ID 落库
  - `forum_topic.sensitiveWordHits` 改为结构化 JSON 写入，`CreateForumTopicDto` 移除不合理的 `commentCount/version/sensitiveWordHits/auditAt` 入参
  - forum search 补齐 admin/app controller，统一 topic/comment/all 返回结构，并修复 comment 搜索未限制 `FORUM_TOPIC` 的问题
  - 新增 forum notification 的 admin/app 查询、创建、删除、已读接口
  - 新增 forum moderator application 的 app 申请/查询/删除与 admin 审核/查询/删除接口，审核通过可直接创建板块版主
  - 追加完成 `libs/forum` DTO 规范收敛：libs 层仅保留 `BaseXxxDto`，apps 层本地组装 Create/Update/Query/Response DTO
  - `action-log / section / section-group / tag` 新增 `*.type.ts`，forum service 层不再直接依赖 DTO
- 契约链路：
  - 修复 `WorkDetailDto`、`WorkForumSectionDto`
  - 删除 `app/work/forum-topic/page` 旧兼容入口
  - 删除 like/favorite 列表的 `work` 兼容字段，仅保留 `targetDetail`
  - 修复 admin forum topic detail 的 Swagger 文档与真实返回结构不一致问题

## 验证结果

- `pnpm type-check` 通过

## 产出文档

- `docs/work-forum-fixes/ALIGNMENT_work-forum-fixes.md`
- `docs/work-forum-fixes/CONSENSUS_work-forum-fixes.md`
- `docs/work-forum-fixes/DESIGN_work-forum-fixes.md`
- `docs/work-forum-fixes/TASK_work-forum-fixes.md`
- `docs/work-forum-fixes/ACCEPTANCE_work-forum-fixes.md`
- `docs/work-forum-fixes/FINAL_work-forum-fixes.md`
- `docs/work-forum-fixes/TODO_work-forum-fixes.md`
