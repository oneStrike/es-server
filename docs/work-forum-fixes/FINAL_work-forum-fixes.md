# Work Forum Fixes Final

## 交付摘要

本次已完成作品模块与论坛模块联动问题的集中修复，并同步补齐 app/admin 两侧的 DTO 与接口契约文档。

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
  - forum reply 触发的 topic/section/profile 计数与最近活跃字段同步修复
- 契约链路：
  - 修复 `WorkDetailDto`、`WorkForumSectionDto`
  - 删除 `app/work/forum-topic/page` 旧兼容入口
  - 删除 like/favorite 列表的 `work` 兼容字段，仅保留 `targetDetail`
  - 修复 admin forum topic detail 的 Swagger 文档与真实返回结构不一致问题

## 验证结果

- app-api TypeScript 编译通过
- admin-api TypeScript 编译通过

## 产出文档

- `docs/work-forum-fixes/ALIGNMENT_work-forum-fixes.md`
- `docs/work-forum-fixes/CONSENSUS_work-forum-fixes.md`
- `docs/work-forum-fixes/DESIGN_work-forum-fixes.md`
- `docs/work-forum-fixes/TASK_work-forum-fixes.md`
- `docs/work-forum-fixes/ACCEPTANCE_work-forum-fixes.md`
- `docs/work-forum-fixes/FINAL_work-forum-fixes.md`
- `docs/work-forum-fixes/TODO_work-forum-fixes.md`
