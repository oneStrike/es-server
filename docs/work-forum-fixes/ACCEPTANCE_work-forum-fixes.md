# Work Forum Fixes Acceptance

## 验收结果

- [x] 作品发布状态更新时同步 forum section 启停
- [x] 删除 forum topic 时仅软删 `targetType=FORUM_TOPIC` 的评论
- [x] app 侧未发布作品详情/作品论坛入口不可见
- [x] app 侧 forum topic 的点赞/收藏/评论/浏览/举报统一收口到公开可见主题
- [x] forum topic 更新 DTO 仅允许修改标题与内容
- [x] forum comment 的 topic/section/profile 计数与最近活跃字段形成闭环
- [x] app 侧补齐 forum topic page/detail/create/update/delete 接口
- [x] work/forum/like/favorite/admin forum detail 的 DTO/Swagger 与真实返回结构对齐
- [x] `getWorkPage` 支持 DTO 暴露的筛选条件，并优化作者/标签过滤查询方式
- [x] moderator 创建/更新/分配板块统一走真实作用域同步，`sectionIds` 不再静默丢失
- [x] moderator 超级版主权限改为显式白名单，admin controller 返回契约与 Swagger 对齐
- [x] `BaseForumProfileDto` 回归 `forum_profile` 表结构，admin topic detail 不再读取不存在的 `forumProfile.points/levelId/status`
- [x] forum profile 状态更新链路补齐 `banUntil` 入参并在 service 中持久化
- [x] forum topic 的 like/favorite resolver 同事务联动维护 `forum_profile.likeCount/favoriteCount`
- [x] 下线 `forum_config` / `forum_config_history` 两张表及 admin/forum/config 全链路，论坛主题审核策略改为仅依赖 `forum_section.topicReviewPolicy`
- [x] forum section 的 `userLevelRuleId` 约束接入公开主题详情/列表、发帖、回帖与公开搜索，并补齐板块更新时的等级规则校验
- [x] `forum_topic.sensitiveWordHits` 改为结构化 JSON 写入，`BaseForumTopicDto` 与 admin detail 返回补齐 `auditAt/commentCount/version/sensitiveWordHits`
- [x] forum search 补齐 admin/app controller，对 topic/comment/all 三类搜索统一返回 `ForumSearchResultDto`，并限制 comment 仅搜索 `FORUM_TOPIC`
- [x] forum notification / moderator application 补齐 service、module 与 admin/app controller，版主申请审核可直接落地创建板块版主
- [x] `libs/forum` DTO 分层已重新收敛：libs 仅保留 `BaseXxxDto`，controller 使用的 Create/Update/Query/Response DTO 全部下沉到 apps 侧组合
- [x] `libs/forum` 内部 service 已移除对业务 DTO 的直接依赖，`action-log / section / section-group / tag` 改为领域 `*.type.ts` 入参

## 实际验证

- 已执行：
  - `pnpm type-check`
- 未执行：
  - 单元测试/集成测试代码新增与运行

## 说明

- 根据当前任务约束，项目处于开发阶段，允许必要重构。
- 根据用户要求，本次未补测试相关代码，仅做最小编译验证。
