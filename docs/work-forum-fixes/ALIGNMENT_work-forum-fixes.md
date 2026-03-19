# Work Forum Fixes Alignment

## 原始需求

- 修复作品模块与论坛模块联动中的全部问题。
- 排查维度包括可维护性、性能、安全、代码质量、接口完整性、入参合理性、回参与 DTO 一致性。
- 执行过程需遵循 `.trae/rules/DTO_SPEC.md`、`.trae/rules/drizzle-guidelines.md`、`.trae/rules/project_rules.md`。

## 任务范围

- 范围内：
  - 作品与论坛板块/主题联动逻辑
  - app/admin 两侧相关接口与 DTO 契约
  - forum topic 与 interaction(comment/like/favorite/browse/report) 的可见性和计数闭环
  - 必要的本地文档更新
- 范围外：
  - 底层表结构变更
  - 与作品/论坛无关的现有脏工作区改动
  - 无明确证据的问题扩散式重构

## 现状理解

- `docs/audit/WORK_FORUM_联动多维审查报告_2026-03-19.md` 已列出当前静态审查发现。
- 主要风险集中在：
  - 发布状态与论坛板块启停不同步
  - forum topic 删除时按 `targetId` 误删其他目标评论
  - app 侧对未发布作品、隐藏主题、未审核主题的可见性约束不足
  - forum topic 更新 DTO 允许越权修改 `sectionId/userId`
  - forum 回复计数、最近回复、section 最近发帖信息缺少闭环
  - app 侧接口能力与 DTO 返回契约不完整

## 项目约束对齐

- DTO：
  - apps 层 DTO 必须优先基于 libs 层 `BaseXxxDto` 组合。
  - Service 层不直接依赖 apps DTO。
  - 新增或修正的响应 DTO 必须与真实返回结构一致。
- Drizzle：
  - 统一经由 `DrizzleService` 访问数据库。
  - 写操作统一 `withErrorHandling`。
  - 需要保证资源存在的 update/delete 必须 `assertAffectedRows`。
  - 分页统一 `drizzle.ext.findPagination`。
- 文档：
  - 需补齐本任务的 alignment / consensus / design / task / acceptance / final / todo 文档。

## 关键假设

- 当前用户目标是直接修复，不是只做方案评审。
- forum public 可见性以“未删除、审核通过、未隐藏、所属 section 启用”为准。
- app 侧作品详情/列表不应暴露未发布作品。
- forum topic 的 app 侧能力至少需要覆盖 public page/detail 与用户 create/update/delete。

## 风险与关注点

- 工作区已有较多未提交改动，必须避免误覆盖。
- forum comment 计数修复需要同时兼顾 topic、section、profile 三层数据。
- DTO 契约修复可能影响现有前端兼容性，需要尽量采用“补充字段 + 兼容保留”的方式收敛。
