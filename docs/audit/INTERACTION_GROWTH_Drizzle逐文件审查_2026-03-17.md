# interaction / growth 模块 Drizzle 逐文件审查报告（2026-03-17）

## 1. 审查目标

- 对 `libs/interaction/src` 与 `libs/growth/src` 中 **直接使用 Drizzle 的文件** 做逐文件排查。
- 对齐项目内 Drizzle 规范基线，重点检查：
  - 是否符合 `withErrorHandling / assertAffectedRows / ext.findPagination / buildWhere` 等约束。
  - 是否充分使用项目已有封装能力（`DrizzleService` 与 `db/extensions`）。
  - 查询是否存在冗余（重复查、N+1、可合并聚合）。
  - 可落地的优化建议与优先级。

## 2. 规范基线

本次审查按以下代码作为规范基线：

- `docs/ai/drizzle-guidelines.md`
- `db/core/drizzle.service.ts`
- `db/core/drizzle.extensions.ts`

重点能力清单：

- 统一入口：`this.drizzle.db` + `this.drizzle.schema`
- 条件构建：`this.drizzle.buildWhere(...)`
- 分页封装：`this.drizzle.ext.findPagination(...)`
- 写操作异常语义：`this.drizzle.withErrorHandling(...)`
- 受影响行断言：`this.drizzle.assertAffectedRows(...)`
- 可复用扩展：`ext.exists / existsActive / softDelete / applyCountDelta / ...`

## 3. 覆盖范围（逐文件）

### 3.1 interaction 模块（18 个文件）

1. `download/download.service.ts`
2. `purchase/purchase.service.ts`
3. `favorite/favorite.service.ts`
4. `like/like.service.ts`
5. `report/report.service.ts`
6. `browse-log/browse-log.service.ts`
7. `comment/comment.service.ts`
8. `interaction-target-access.service.ts`
9. `comment/resolver/comment-like.resolver.ts`
10. `reading-state/reading-state.service.ts`
11. `report/report-growth.service.ts`
12. `browse-log/browse-log-growth.service.ts`
13. `favorite/favorite-growth.service.ts`
14. `like/like-growth.service.ts`
15. `interaction-target-resolver.service.ts`
16. `comment/comment-permission.service.ts`
17. `browse-log/browse-log-permission.service.ts`
18. `comment/resolver/comment-report.resolver.ts`

### 3.2 growth 模块（10 个文件）

1. `point/point-rule.service.ts`
2. `point/point.service.ts`
3. `task/task.service.ts`
4. `badge/user-badge.service.ts`
5. `growth-ledger/growth-ledger.service.ts`
6. `level-rule/level-rule.service.ts`
7. `experience/experience.service.ts`
8. `growth-reward/growth-reward.service.ts`
9. `permission/permission.service.ts`
10. `resolver/user-report.resolver.ts`

## 4. 总体结论

- **总体可用，但规范一致性不均衡**：growth 模块整体更接近规范，interaction 在复杂查询场景（download/purchase）明显偏离。
- **覆盖范围存在漏项并已补齐**：原始清单遗漏 `comment-report.resolver.ts` 与 `user-report.resolver.ts`，两者均直接使用 Drizzle 事务查询。
- **封装能力使用不充分**：`findPagination/buildWhere/withErrorHandling` 使用较多，但 `assertAffectedRows`、`ext.exists`、`ext.applyCountDelta` 等能力没有形成统一约定。
- **冗余查询存在且可优化**：主要集中在：
  - 下载/购买列表的重复 SQL 模板；
  - 某些“更新后再查存在性”二次查询；
  - 统计类 N+1 查询；
  - 账本链路中的重复读。
- **高优先级优化位点**：`download.service.ts`、`purchase.service.ts`、`growth-ledger.service.ts`、`level-rule.service.ts`、`comment-like.resolver.ts`。

## 5. interaction 逐文件结论

| 文件 | 规范符合度 | 封装能力使用情况 | 冗余查询/可优化点 | 优先级 |
|---|---|---|---|---|
| download.service.ts | C | 使用 `DrizzleService`；事务正确；未统一 `withErrorHandling/assertAffectedRows`；大量 `db.execute(sql)` | 1) `extractRows` 手工解包驱动返回；2) 作品/章节列表 SQL 与 purchase 高度重复，可抽公共 query builder；3) 章节列表中 `INNER JOIN work w` 仅用于过滤，可按条件裁剪；4) count/list 双 SQL 可评估 `count(*) over()` | P0 |
| purchase.service.ts | C | 使用事务 + `withErrorHandling`（重复购买）；其余写操作未统一断言 | 1) 与 download 同构 SQL 重复；2) `extractRows` 手工解包；3) count/list 模式重复；4) `checkNeedPurchase` + `purchase` 之间价格变化窗口可考虑在事务内复验 | P0 |
| favorite.service.ts | B | 分页已用 `ext.findPagination + buildWhere`；写入有 `withErrorHandling` | 1) `checkStatusBatch` 未去重 `targetIds`；2) `getUserFavorites` 分类型聚合已较优，但 resolver 失败仅 warn，可增加失败维度字段 | P1 |
| like.service.ts | B | 分页能力使用规范；写入使用 `withErrorHandling` | 1) `checkStatusBatch` 同样可先去重；2) `checkLikeStatus` 可直接 `exists` 化；3) 删除链路可统一 `assertAffectedRows` | P1 |
| report.service.ts | B | 事务边界清晰；创建举报使用 `withErrorHandling` | 1) `ensureReporterExists` 与主事务分离，极端并发下存在时间窗；2) 可统一使用 `assertAffectedRows` 风格做受影响断言 | P2 |
| browse-log.service.ts | B | 事务使用合理；schema/db 获取规范 | 1) `deferPostProcess` 异常吞掉（仅 `catch(() => undefined)`），建议结构化日志；2) 计数更新可以考虑统一进入公共 target-count 封装 | P1 |
| comment.service.ts | B | 大量使用 `findPagination/buildWhere/withErrorHandling`；事务冲突重试机制完整 | 1) `replyComment` 先查回复目标再入事务，可合并到事务内减少一致性窗口；2) `getReplies` 为 page + user 二段查询（可接受），可评估 join 拉平；3) 多处读后判断可考虑 `ext.exists` | P1 |
| interaction-target-access.service.ts | B- | 使用 `buildWhere`；动态 table 定位能力完整 | 1) `set({ [field]: sql... } as any)` 类型降级；2) 负向 delta 更新未对 0 行受影响做显式语义（余额不足/目标不存在）；3) 可封装统一 `applyDelta` 返回结构 | P1 |
| comment-like.resolver.ts | B | Drizzle join 与事务使用正确 | 1) `applyCountDelta` 先 update 再 findFirst 二次查询，可改为 `update...returning({id})` 一步断言；2) `batchGetDetails` 可按需裁剪字段 | P1 |
| reading-state.service.ts | B | 分页规范、upsert 正确 | 1) `touchByChapter` 逐 resolver 试探查询，resolver 数量增大时线性放大；2) `getUserReadingHistory` 分组后章节快照仍有多次 resolver 调用，可提供批量章节快照接口 | P1 |
| query.helper.ts（已删除） | A | 通用能力已下沉到 `@db/core/query/interaction-query.helper` | 删除完成；`download/purchase` 已迁移到 `normalizePagination/buildColumnDateRangeSqlFilter` | P3 |
| report-growth.service.ts | B | 事务中调用账本服务；日志存在 | 奖励链路属于“可失败不阻断”，建议统一附带 `bizKey/ruleType` 结构字段 | P2 |
| browse-log-growth.service.ts | B | 同上 | 同上，建议统一日志字段规范，便于观测聚合 | P2 |
| favorite-growth.service.ts | B | 同上 | 同上 | P2 |
| like-growth.service.ts | B | 同上；评论点赞前置查作者逻辑清晰 | `rewardCommentLiked` 为读后再发奖，可考虑把查询与发奖关键信息落到统一 helper | P2 |
| interaction-target-resolver.service.ts | A- | 使用 `interaction-target-access` 做统一存在性校验 | 评论元数据解析路径清晰；可将 `ensureUserExists` 收敛为通用 exists helper | P3 |
| comment-permission.service.ts | B | 查询写法规范，`$count` 使用合理 | `postInterval` 查询 topic/comment 两条 SQL，可合并为 `greatest(max(...), max(...))` 类聚合（视可读性） | P2 |
| browse-log-permission.service.ts | A | 简洁、规范、查询开销小 | 可与 comment-permission 共用用户状态校验 helper，减少重复逻辑 | P3 |
| comment-report.resolver.ts | B+ | 事务查询与场景解析逻辑清晰 | 1) `targetType as InteractionTargetTypeEnum` 存在类型断言依赖；2) 与 `comment-like` 在评论存在性校验上可沉淀共享 helper | P3 |

## 6. growth 逐文件结论

| 文件 | 规范符合度 | 封装能力使用情况 | 冗余查询/可优化点 | 优先级 |
|---|---|---|---|---|
| point-rule.service.ts | A | `withErrorHandling/findPagination/buildWhere/assertAffectedRows` 使用较完整 | `getPointRuleDetail` 可统一 `query.findFirst` 风格；错误文案中英混杂可统一 | P3 |
| point.service.ts | B+ | 分页封装规范；事务与账本集成合理 | 1) `addPoints/consumePoints` 在拿到 `recordId` 后再查一次 ledger，可评估由 ledger 直接返回完整记录；2) `getUserPointStats` 两次 sum 可合并为单 SQL 条件聚合 | P1 |
| task.service.ts | B | 管理端 CRUD 规范较好，`softDelete` 已使用 | 1) `getTaskAssignmentPage/getMyTasks` 手工分页模板重复，建议抽公共分页 helper；2) `ensureAutoAssignmentsForUser` 对任务逐条调用 createOrGet，规模大时查询放大 | P1 |
| user-badge.service.ts | B | 分页/where 使用较好；部分写操作未统一 withErrorHandling | 1) create/update/delete 可统一异常映射与断言；2) `getBadgeStatistics` topBadges 后补查 badge 需要二次查询（可接受） | P2 |
| growth-ledger.service.ts | B- | 核心事务设计完整，幂等与限额逻辑清晰 | 1) `createLedgerGate` 固定“insert + find”双查，可按插入结果分支减少一次查询；2) `applyDelta` 更新余额后再 `findUserBalanceById` 读取可优化为 returning；3) `reserveLimitedSlots` 最坏 O(limit) 插入尝试 | P0 |
| level-rule.service.ts | B | CRUD 与分页规范较好 | 1) `getHighestLevelRuleByExperience(tx?: any)` 存在类型降级；2) `getLevelStatistics` 按 level 循环 count，典型 N+1，建议 group by 一次取分布 | P1 |
| experience.service.ts | A- | 规范度高，分页/写入错误映射较完整 | `addExperience` 在拿 `recordId` 后再 `findFirst` 可与 ledger 返回值整合，减少一次查询 | P2 |
| growth-reward.service.ts | A- | 事务使用与日志兜底合理 | 奖励发放结果当前仅日志，若需要观测可补业务指标埋点 | P3 |
| permission.service.ts | A- | 查询清晰，职责边界明确 | `validateViewPermission` 中用户等级与 requiredLevel 查询可在部分调用场景缓存 | P3 |
| user-report.resolver.ts | B | 事务查询与举报场景元数据构造简洁 | 用户存在性校验仅按 `id`，未过滤 `deletedAt`；建议收敛到 `existsActive` 语义，避免软删除用户被视为可举报目标 | P1 |

## 7. 关键问题清单（按影响排序）

### 7.1 P0（建议优先处理）

1. `download.service.ts` / `purchase.service.ts`
   - 原生 SQL 模板重复 + 手工 rows 解包。
   - 建议抽象 `interactionAggregateQuery` 层，统一：
     - 参数建模（time range / type / userId / page）
     - 结果类型约束
     - count/list 一体化策略

2. `growth-ledger.service.ts`
   - 高频链路存在可消减的重复查询与循环插槽尝试。
   - 建议先做“低风险优化”：
     - `createLedgerGate` 分支化查询；
     - `applyDelta` 使用 returning 拿 afterValue；
     - 明确 `reserveLimitedSlots` 上限与性能边界。

### 7.2 P1（建议本迭代纳入）

1. `level-rule.service.ts`：去 `tx?: any`，统计改 group by。
2. `comment-like.resolver.ts`：`update + findFirst` 合并为 `returning`。
3. `point.service.ts`：统计查询合并；账本记录查询路径去重。
4. `task.service.ts`：抽通用手工分页模板，降低重复维护成本。
5. `reading-state.service.ts`：补齐批量章节快照 resolver 能力，降低潜在 N+1。
6. `user-report.resolver.ts`：用户存在性校验补齐 `deletedAt is null` 语义。

## 8. 是否使用了项目内 Drizzle 封装能力（总结）

- **使用较好**
  - `ext.findPagination + buildWhere`：interaction 的 like/favorite/comment/reading-state，growth 的 point-rule/experience/level-rule/task 等。
  - `withErrorHandling`：growth 管理类写操作、interaction 的部分写操作（like/favorite/report/create）。
- **使用不足**
  - `assertAffectedRows` 在 interaction 覆盖不足。
  - `ext.exists / existsActive` 几乎未使用，存在多处“查一条再判断”的机会。
  - `ext.applyCountDelta` 未形成统一策略（目前多处手写 `sql\`${column} +/- delta\``）。

## 9. 推荐落地顺序（可执行）

1. 抽 `download/purchase` 共享聚合查询层（先不改业务接口，只替换内部查询实现）。
2. 收敛 `growth-ledger` 重复读逻辑（保持结果语义不变）。
3. 修复 `level-rule` 的 N+1 与 `tx?: any`。
4. 收敛 `comment-like` 二次查询。
5. 做一次模块级规则统一：
   - 写操作默认 `withErrorHandling`；
   - 更新删除默认 `assertAffectedRows`；
   - 禁止新增手工 `rows` 解包。

## 10. 审查结论

- interaction 与 growth 当前 Drizzle 使用整体已脱离迁移早期状态，主链路可运行。
- 但从“项目规范一致性 + 可维护性 + 查询效率”看，仍有一批可以明确量化收益的优化点。
- 上述 P0/P1 完成后，可显著提升：
  - 查询层一致性（减少重复 SQL 模板）；
  - 账本链路吞吐稳定性（减少不必要 round-trip）；
  - 代码可读性与后续扩展效率（减少手工解包和 any 类型泄漏）。

## 11. 文档先行执行约束

- 当前阶段仅产出执行文档，不进行任何代码改动。
- 后续实施严格按本节及第 12 节顺序推进，避免“边改边想”导致范围漂移。
- 当前处于快速开发阶段：不要求兼容历史 helper 形态，可直接重命名/重组 API。
- `libs/interaction/src/query.helper.ts` 目标状态：改造完成后删除。
- 删除前置条件：
  - 所有引用全部迁移到 `@db/core` 可复用能力；
  - `download.service.ts`、`purchase.service.ts` 编译通过；
  - lint/typecheck 全绿。

## 12. 可直接执行的改造任务清单（文件 + 工时 + 风险）

| 序号 | 文件 | 改造内容 | 预计工时 | 风险 |
|---|---|---|---|---|
| A1 | `db/core/query/interaction-query.helper.ts`（新增） | 下沉通用分页与时间过滤能力：`normalizePagination`、`buildColumnDateRangeSqlFilter` | 1.5h | M |
| A2 | `db/core/index.ts` | 导出 A1 新能力，供 `@db/core` 统一引用 | 0.5h | L |
| A3 | `libs/interaction/src/download/download.service.ts` | 替换 `../query.helper` 依赖为 `@db/core`；允许直接调整调用签名，不保留旧 helper 兼容层 | 1.5h | M |
| A4 | `libs/interaction/src/purchase/purchase.service.ts` | 同 A3，替换为 `@db/core` helper，并同步收敛命名 | 1.5h | M |
| A5 | `libs/interaction/src/query.helper.ts` | 删除文件并修复引用 | 0.5h | L |
| A6 | `docs/audit/INTERACTION_GROWTH_Drizzle逐文件审查_2026-03-17.md` | 更新“已完成改造”状态与变更清单 | 0.5h | L |
| A7 | 仓库级验证 | 执行 lint + typecheck，记录异常与修复项 | 1.0h | M |

预计总工时：6.0h（单人）

## 13. 实施步骤与验收标准（针对 query.helper 删除目标）

### 13.1 实施步骤

1. 新增 db 层 helper（A1）
2. 调整 db core 导出（A2）
3. 迁移 `download.service.ts`（A3）
4. 迁移 `purchase.service.ts`（A4）
5. 删除 `query.helper.ts`（A5）
6. lint + typecheck（A7）
7. 回写文档状态（A6）

### 13.2 验收标准

- 功能验收
  - 下载/购买对外返回字段与核心业务语义不变。
  - 时间过滤边界正确（`startDate` 含当日、`endDate` 次日开区间）。
- 工程验收
  - `libs/interaction/src/query.helper.ts` 不存在。
  - 仓库内不存在 `from '../query.helper'` 引用。
  - lint/typecheck 全通过。
- 规范验收
  - interaction 业务 helper 不再承载通用 SQL 工具。
  - 通用工具统一从 `@db/core` 输出，分层清晰。
  - 不新增历史兼容层（不保留旧函数别名与中转导出）。

## 14. 风险与快速修正策略

- 风险点 R1：时间过滤列别名与 SQL 片段拼装不一致，导致结果偏差。
  - 对策：迁移后对下载/购买跑固定参数用例做结果比对。
- 风险点 R2：分页参数归一化差异导致 pageIndex/pageSize 边界变化。
  - 对策：保留原逻辑的 1-based 语义和 pageSize 上限。
- 风险点 R3：helper 下沉后命名冲突或导出循环依赖。
  - 对策：helper 放在 `db/core/query`，仅被 `db/core/index.ts` 单向导出。

快速修正方式：

- 若 A3/A4 出现语义偏差，直接在当前分支修正到通过，不引入兼容层；
- A1/A2 命名不理想时直接重命名并一次性替换引用；
- A5 保持在 A3/A4 完成后立即执行，不保留过渡文件。

## 15. 本轮一次性修复完成状态（按本文档执行）

- A1 完成：新增 `db/core/query/interaction-query.helper.ts`，提供 `normalizePagination`、`buildColumnDateRangeSqlFilter`。
- A2 完成：`db/core/index.ts` 已导出 A1 新能力。
- A3/A4 完成：`download.service.ts`、`purchase.service.ts` 已迁移为 `@db/core` helper 引用。
- A5 完成：`libs/interaction/src/query.helper.ts` 已删除，仓库内无 `../query.helper` 引用。
- A7 完成：已执行 `pnpm type-check` 通过；`pnpm lint` 无 error（存在仓库既有 warning）。
- P0 完成项：`growth-ledger` 已完成 `createLedgerGate` 分支化查询、`applyDelta` 使用 returning 余额、限额槽位上限约束。
- P1 完成项：`level-rule` 去 `tx?: any` 且统计改 `group by`；`comment-like` 改为 `update...returning`；`task` 抽公共分页查询；`reading-state` 改为批量章节快照映射；`user-report` 补齐 `deletedAt is null`；`like/favorite` 批量状态去重并收敛 `exists` 校验。
