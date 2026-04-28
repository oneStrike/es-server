# Forum Moderator Domain Breaking Re-architecture

## Summary

本次变更把 forum moderator 相关能力从“按表拆目录 + 治理链未接入”重构为单一 moderator domain：

- `moderator` 与 `moderator-application` 不再作为两个平级 runtime 模块存在；
- moderator roster、application、governance、action log 全部收口到统一 owner；
- topic/comment 的 moderator 治理动作正式接入 moderator 权限与作用域判定；
- `forum_moderator_action_log` 从“只有 schema 与 seed 示例数据”升级为正式运行时写链路。

## Breaking Changes

### Runtime Module Boundary

- `@libs/forum/moderator-application/*` 运行时 owner 被收回 `@libs/forum/moderator/*`。
- 旧的 lib 层双模块边界不再保留 compat。

### App Governance Entry

- app 侧新增 `app/forum/moderator/*` 治理入口。
- moderator 不再只有申请能力，也可以直接执行 forum topic/comment 的治理动作。

### Topic / Comment Governance Chain

- topic 的置顶、加精、锁定、删除、移动板块、隐藏、审核状态更新改为可走 moderator governance 主链。
- forum comment 的删除、隐藏、审核状态更新改为可走 moderator governance 主链。
- admin 与 moderator 共享事实写入 service，但权限来源不同：
  - admin：直接放行
  - moderator：按板块作用域与 permission 校验

### Moderator Action Log Contract

- `forum_moderator_action_log.actionType` 现收敛为：
  - `1=置顶主题`
  - `2=取消置顶主题`
  - `3=加精主题`
  - `4=取消加精主题`
  - `5=锁定主题`
  - `6=取消锁定主题`
  - `7=删除主题`
  - `8=移动主题`
  - `9=审核主题`
  - `10=删除评论`
  - `11=隐藏主题`
  - `12=取消隐藏主题`
  - `13=审核评论`
  - `14=隐藏评论`
  - `15=取消隐藏评论`
- `targetType` 现收敛为：
  - `1=论坛主题`
  - `2=论坛评论`

## Migration / Historical Data

- 本轮没有为 moderator/application 主表增加新字段，也不保留运行时 fallback。
- `forum_moderator_action_log` 通过 migration 增加闭集约束，并在正式启用 `7/8/10` 运行时写链前清理旧 seed-only 历史行。
- 历史数据处理只通过数据库 migration 进行，不在 service 主链做兼容映射或启动时修补。
- 旧版 `forum_moderator_action_log.actionType` 中的 `7=删除主题`、`8=移动主题`、`10=删除回复` 相关历史载荷不再视为可信事实源；切换 migration 会直接清除这些旧行。

## No Compatibility Layer

- 不保留 `@libs/forum/moderator-application/*` 的 compat runtime 路径。
- 不保留“旧治理入口失败后回退旧链路”的双路径 dispatch。
- 不保留 action log 的 seed-only 语义；新治理动作必须走正式写链。

## Verification Focus

- admin moderator `detail` 已暴露。
- app moderator governance 入口已可用。
- topic/comment moderator 权限已接入业务链，`DELETE/MOVE` 不再是空合同。
- `forum_moderator_action_log` 已具备正式运行时写入。
- `db/comments/generated.sql` 已刷新并通过检查。
