# 常量治理改进计划

生成时间：2026-03-18T10:08:33.763Z

## 基线与约束

- 本次扫描覆盖 48 个 `*.constant.ts` 文件，发现跨域常量依赖 9 条、疑似未使用导出 28 个。
- 参考约定：Google TypeScript Style Guide（命名一致性、显式导出、注释最小充分）、Airbnb JavaScript/TypeScript 风格（避免 magic values、模块边界清晰）、Microsoft TypeScript 指南（优先只读数据结构、限制共享可变状态）。
- 项目现状要求：继续保持命名导出、避免 default export、优先通过 `@libs/*` 别名导入，但必须补上域边界约束与只读常量策略。

## 主要问题归纳

- 重复导出 / 命名冲突：
- `AdminUserRoleEnum`：apps/admin-api/src/modules/admin-user/admin-user.constant.ts、libs/platform/src/constant/user.constant.ts
- `AuditRoleEnum`：libs/forum/src/topic/forum-topic.constant.ts、libs/platform/src/constant/audit.constant.ts
- `AuditStatusEnum`：libs/forum/src/topic/forum-topic.constant.ts、libs/platform/src/constant/audit.constant.ts
- `AuthConstants`：apps/admin-api/src/modules/auth/auth.constant.ts、apps/app-api/src/modules/auth/auth.constant.ts、libs/platform/src/modules/auth/auth.constant.ts
- `AuthDefaultValue`：apps/app-api/src/modules/auth/auth.constant.ts、libs/platform/src/modules/auth/auth.constant.ts
- `AuthRedisKeys`：apps/admin-api/src/modules/auth/auth.constant.ts、apps/app-api/src/modules/auth/auth.constant.ts
- `BusinessModuleEnum`：libs/platform/src/constant/business.constant.ts、libs/platform/src/constant/content.constant.ts
- `ForumReviewPolicyEnum`：libs/forum/src/config/forum-config.constant.ts、libs/forum/src/section/forum-section.constant.ts
- `getGrowthRuleTypeName`：libs/growth/src/growth-rule.constant.ts、libs/growth/src/point/point.constant.ts
- `GrowthRuleTypeEnum`：libs/growth/src/experience/experience.constant.ts、libs/growth/src/growth-rule.constant.ts、libs/growth/src/point/point.constant.ts
- `GrowthRuleTypeNames`：libs/growth/src/growth-rule.constant.ts、libs/growth/src/point/point.constant.ts
- 典型跨域耦合：
- `apps/admin-api/src/modules/auth/auth.constant.ts` -> `libs/platform/src/modules/auth/auth.constant.ts`（AuthConstants, createAuthRedisKeys）
- `apps/app-api/src/modules/auth/auth.constant.ts` -> `libs/platform/src/modules/auth/auth.constant.ts`（AuthConstants, AuthDefaultValue, createAuthRedisKeys）
- `libs/content/src/work/core/work.constant.ts` -> `libs/platform/src/constant/content.constant.ts`（ContentTypeEnum）
- `libs/forum/src/topic/forum-topic.constant.ts` -> `libs/platform/src/constant/audit.constant.ts`（AuditRoleEnum, AuditStatusEnum）
- `libs/interaction/src/browse-log/browse-log.constant.ts` -> `libs/growth/src/growth-rule.constant.ts`（GrowthRuleTypeEnum）
- `libs/interaction/src/comment/comment.constant.ts` -> `libs/growth/src/growth-rule.constant.ts`（GrowthRuleTypeEnum）
- 重点问题集中在 `libs/interaction` 重复维护目标类型、`libs/growth` 暴露核心奖励规则、多个名称映射对象缺少只读保护。

## 分类分层方案

1. 建立三级常量层。
业务常量：保留在各业务域内，只允许描述本域私有状态，例如 `task-status.constant.ts`、`report-status.constant.ts`。
平台常量：迁入 `libs/platform/src/constants` 或新建 `libs/core-constants/src/platform`，承载跨域目标类型、支付方式、权限 key、通用状态码。
第三方/配置常量：迁入 `libs/config/src/constants`，统一管理供应商 key、系统配置键、缓存 key 前缀。
2. 统一目录与前缀。
建议目录：`libs/core-constants/src/business`、`libs/core-constants/src/platform`、`libs/core-constants/src/integration`。
建议前缀：业务私有常量用 `<Domain><Entity>`，跨域常量用 `<Layer><Entity>`，第三方键统一以 `<Provider>` 开头。

## 统一导出策略

1. 只允许命名导出，不再增加默认导出。
2. 每个业务域只保留一个对外 barrel，例如 `index.ts`；`*.constant.ts` 负责定义，不负责二次转发其它域的核心常量。
3. 封闭集合优先使用 `enum` 或 `as const` 对象二选一：
需要数据库稳定编码且要双向映射时用 `enum`。
纯字符串标签或前端协议值优先用 `const` 对象 + `as const`，避免 runtime enum 额外产物。
4. 所有对象/映射型导出必须使用 `Readonly<Record<...>>`，并以 `as const` 或 `Object.freeze` 固化。

## 依赖解耦方案

1. 禁止跨业务域直接引用对方 `*.constant.ts`。interaction 不得直接依赖 growth 域常量；growth 也不得直接引用 interaction 私有常量。
2. 所有跨域共享常量必须沉到核心常量层或配置中心，例如：
交互目标类型统一迁移到 `core/business/interaction-target.constant.ts`。
成长规则编码迁移到 `core/business/growth-rule.constant.ts`，interaction 只依赖核心层，不依赖 growth 域实现。
3. 建立 `dependency-cruiser` 或 ESLint import 规则：禁止 `libs/interaction/**` 导入 `libs/growth/**/*.constant.ts`，反之亦然。

## 命名与注释规范

1. `enum` 名称统一以 `Enum` 结尾；映射对象统一以 `Map`、`Names`、`Labels` 结尾。
2. `enum` 成员默认使用全大写下划线，如 `SYSTEM_CONFIG`、`COMMENT_LIKED`；只有与外部协议强绑定的字符串值才允许 `camelCase` 值，但成员名仍保持全大写。
3. `const` 对象命名使用 `UPPER_SNAKE_CASE` 仅限真正的单值常量；对象/映射变量保持 `PascalCase` 或 `camelCase` 需遵守项目现有语义后缀。
4. 所有对外导出常量强制补 JSDoc，最少包含“用途 + 编码来源/约束”两项。
JSDoc 示例：
```ts
/**
 * 统一交互目标类型。
 * 与数据库 interaction.target_type 列保持一一对应，不得复用其它枚举编码。
 */
export enum InteractionTargetTypeEnum {
  COMIC = 1,
}
```

## 检测与自动化

1. 新增脚本：保留本次生成器 `scripts/constant-governance-report.ts`，在 CI 中输出 JSON 与 Markdown 基线。
2. 新增 ESLint 自定义规则：
禁止跨域直接导入其它业务域 `*.constant.ts`。
禁止导出未冻结的对象字面量常量。
禁止在非常量层重复定义已存在的目标类型/状态枚举名称。
3. 新增 CI 门禁：
执行 `pnpm type-check`、`pnpm lint`、`pnpm analyze:constants`。
若新增跨域依赖、重复导出或未使用导出超过基线，则直接失败。
4. 新增 pre-commit：仅扫描变更文件中的 `*.constant.ts`，输出新增 magic value、重复导出与跨域依赖告警。

## 存量重构路线图

1. Phase 1（2026-03-18 到 2026-03-27）：先抽离核心目标类型与 growth rule 编码，阻断 interaction -> growth 的直接依赖。
测试要求：相关 service/resolver 单元测试覆盖导入路径变更；核心枚举快照测试覆盖编码和值映射。
回归标准：点赞、收藏、评论、浏览、举报、购买发奖链路全量通过，数据库编码零变化。
2. Phase 2（2026-03-28 到 2026-04-05）：清理空壳 re-export 文件、合并重复目标枚举、补全 `as const`/`Readonly`。
测试要求：扫描脚本零新增重复导出；所有名称映射对象拥有只读断言测试。
回归标准：全量 TypeScript 编译通过，公开 API 契约无 breaking change。
3. Phase 3（2026-04-06 到 2026-04-12）：上线 ESLint 规则、dependency-cruiser 门禁和 pre-commit 差异扫描。
测试要求：CI 在故意构造的跨域导入样例上稳定失败，在正常分支上稳定通过。
回归标准：新建常量文件必须经过门禁校验，无人工豁免路径。

## interaction / growth 专项整改清单

以下责任人与 Deadline 为建议占位，需在项目例会上映射到真实 owner：

| 文件 | 风险 | 替换方案 | 责任人（建议） | Deadline |
| --- | --- | --- | --- | --- |
| libs/interaction/src/comment/comment.constant.ts | 评论目标类型重复且直接耦合 growth 规则。 | 改为引用核心 `interaction-target` 常量，并把奖励映射迁入 `libs/core-constants` 或配置中心。 | Interaction 模块负责人 | 2026-03-25 |
| libs/interaction/src/like/like.constant.ts | 点赞目标类型命名与平台层不一致，奖励规则跨域直连。 | 统一改用核心目标类型前缀，奖励映射改为通过 `growth-rule-registry` 中转。 | Interaction 模块负责人 | 2026-03-25 |
| libs/interaction/src/favorite/favorite.constant.ts | 目标类型重复、映射对象缺少类型和冻结保护。 | 收敛到统一交互目标常量；映射对象改成 `Readonly<Record<...>>` 并集中导出。 | Interaction 模块负责人 | 2026-03-25 |
| libs/interaction/src/browse-log/browse-log.constant.ts | 目标类型重复且 `undefined` 占位隐藏规则缺口。 | 改由核心交互目标 + 核心奖励注册表组合，章节浏览奖励状态通过显式注释或配置项表达。 | Interaction 模块负责人 | 2026-03-27 |
| libs/interaction/src/report/report.constant.ts | 举报原因/状态/目标多套可变映射，对 growth 域形成硬依赖。 | 拆为 `report-status`、`report-reason`、`interaction-target` 三层常量，奖励映射移至核心层。 | Interaction 模块负责人 | 2026-03-27 |
| libs/interaction/src/download/download.constant.ts | 章节目标类型与购买/平台层重复。 | 删除本地目标枚举，复用统一章节目标常量。 | Interaction 模块负责人 | 2026-03-29 |
| libs/interaction/src/purchase/purchase.constant.ts | 支付方式和目标类型局部化，存在平台常量下沉不完整的问题。 | 支付方式迁入平台/支付常量层；购买目标复用统一章节目标常量。 | Interaction 模块负责人 | 2026-03-29 |
| libs/growth/src/growth-rule.constant.ts | 核心奖励编码硬编码分段且被多业务域直连。 | 升格为核心常量层 `core/growth-rule`，补充编码分段文档和注册表生成脚本。 | Growth 模块负责人 | 2026-03-26 |
| libs/growth/src/point/point.constant.ts | 空壳 re-export 文件制造重复出口。 | 标记为兼容层并逐步废弃；新代码只从核心 growth 规则层导入。 | Growth 模块负责人 | 2026-03-30 |
| libs/growth/src/experience/experience.constant.ts | 空壳 re-export 文件模糊归属。 | 同 `point.constant.ts` 一并收敛，保留 deprecation 注释与迁移清单。 | Growth 模块负责人 | 2026-03-30 |
| libs/growth/src/task/task.constant.ts | 执行模式枚举重复。 | 抽取统一 `TaskExecutionModeEnum`，其余状态按子域拆分并补测试。 | Growth 模块负责人 | 2026-04-03 |
| libs/growth/src/badge/user-badge.constant.ts | 枚举成员命名风格与全仓不一致。 | 统一改为 `SYSTEM/ACHIEVEMENT/ACTIVITY`，并为兼容层提供 codemod 替换列表。 | Growth 模块负责人 | 2026-04-03 |
| libs/growth/src/level-rule/level-rule.constant.ts | 权限 key 与展示名称散落在业务层。 | 抽到核心权限常量层，名称映射改只读导出。 | Growth 模块负责人 | 2026-04-05 |
| libs/growth/src/growth-ledger/growth-ledger.constant.ts | 失败原因标签为可变对象，协议值归属不清。 | 提炼为核心账本协议常量，并使用 `as const` + `Readonly<Record<...>>`。 | Growth 模块负责人 | 2026-04-05 |

## 交付要求

- 所有重构 PR 必须附带常量扫描结果前后对比。
- 若删除或合并常量文件，必须提供迁移清单和调用点替换说明。
- 若常量会透出到接口层或数据库层，必须附带回归测试与兼容性说明。