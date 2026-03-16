# interaction + growth Prisma → Drizzle 一次性改造执行清单（文件级）

## 1. 目标与边界

- 目标：`libs/interaction`、`libs/growth` 与其对应 resolver 一次性完成 Prisma → Drizzle 改造。
- 边界：处于开发阶段，直接按目标架构改到位，不做历史兼容过渡。
- 约束：
  - 不做双驱动并存。
  - 不做按配置回退能力。
  - 不新增并发压测脚本。
  - 不写测试/测试计划相关条目。

## 2. 执行策略

- 策略：一次性切主干，分批提交，按依赖顺序推进。
- 顺序：`接口与类型` → `growth 核心` → `interaction 核心` → `content/forum resolver` → `清理收口`。
- 目标状态：迁移完成后，目标范围内不再出现 `this.prisma`、`PrismaTransactionClientType`、`Prisma.sql` 的新增依赖。

## 3. 风险分级与工时口径

- 风险等级
  - H：事务一致性、幂等、余额扣减、限额占位、跨模块调用。
  - M：复杂查询改写、分页行为、接口签名联动。
  - L：注入替换、简单查询、导出整理。
- 工时口径
  - 1h = 实现 + 编译级检查 + 人工走查。

## 4. 一次性改造顺序清单（按文件级）

### Phase A：接口与类型先改（阻塞项）

| 顺序 | 文件 | 改造内容 | 风险 | 预估 |
|---|---|---|---|---|
| A1 | `libs/interaction/src/report/interfaces/report-target-resolver.interface.ts` | `tx` 参数改为统一 `InteractionTx`，去掉 Prisma 事务类型依赖 | H | 1h |
| A2 | `libs/interaction/src/like/interfaces/like-target-resolver.interface.ts` | 同上 | H | 1h |
| A3 | `libs/interaction/src/favorite/interfaces/favorite-target-resolver.interface.ts` | 同上 | H | 1h |
| A4 | `libs/interaction/src/comment/interfaces/comment-target-resolver.interface.ts` | 同上 | H | 1h |
| A5 | `libs/interaction/src/browse-log/interfaces/browse-log-target-resolver.interface.ts` | 同上 | H | 1h |
| A6 | `libs/interaction/src/download/interfaces/download-target-resolver.interface.ts` | 同上 | H | 1h |
| A7 | `libs/interaction/src/purchase/interfaces/purchase-target-resolver.interface.ts` | 同上 | H | 1h |
| A8 | `libs/interaction/src/reading-state/interfaces/reading-state-resolver.interface.ts` | 同上 | M | 1h |
| A9 | `libs/interaction/src/query.helper.ts` | `Prisma.sql/empty/raw` 改为 Drizzle SQL 构建 | M | 2h |
| A10 | `libs/interaction/src/index.ts` | 导出新类型，清理 Prisma 透出 | L | 0.5h |

### Phase B：growth 核心一次切换

| 顺序 | 文件 | 改造内容 | 风险 | 预估 |
|---|---|---|---|---|
| B1 | `libs/growth/src/growth-ledger/growth-ledger.service.ts` | 全量改 `DrizzleService`，幂等/限额/扣减语义按 Drizzle 重写 | H | 10h |
| B2 | `libs/growth/src/point/point.service.ts` | 全链路事务改 drizzle，分页/聚合改写 | H | 5h |
| B3 | `libs/growth/src/experience/experience.service.ts` | 全链路事务改 drizzle，分页/聚合改写 | H | 5h |
| B4 | `libs/growth/src/growth-reward/growth-reward.service.ts` | 奖励发放事务切换到 drizzle | M | 2h |
| B5 | `libs/growth/src/point/point-rule.service.ts` | 规则 CRUD 切换到 drizzle | M | 2h |
| B6 | `libs/growth/src/level-rule/level-rule.service.ts` | 等级相关复杂查询改写 | M | 4h |
| B7 | `libs/growth/src/badge/user-badge.service.ts` | badge 写库与查询切换 | M | 3h |
| B8 | `libs/growth/src/permission/permission.service.ts` | 权限查询切换 | L | 1.5h |
| B9 | `libs/growth/src/resolver/user-report.resolver.ts` | resolver tx 类型联动替换 | M | 1h |
| B10 | `libs/growth/src/index.ts` | 导出整理，清理 Prisma 相关类型 | L | 0.5h |

### Phase C：interaction 核心服务一次切换

| 顺序 | 文件 | 改造内容 | 风险 | 预估 |
|---|---|---|---|---|
| C1 | `libs/interaction/src/interaction-target.definition.ts` | `modelKey` 方案改为 `table + whereBuilder` 显式映射 | H | 4h |
| C2 | `libs/interaction/src/interaction-target-access.service.ts` | 移除 Prisma 动态 model 访问，改 Drizzle 通用访问层 | H | 6h |
| C3 | `libs/interaction/src/like/like.service.ts` | like 事务、分页、状态查询全量切换 | H | 5h |
| C4 | `libs/interaction/src/favorite/favorite.service.ts` | favorite 全链路切换，保留详情聚合能力 | H | 5h |
| C5 | `libs/interaction/src/report/report.service.ts` | report 主流程事务与异常语义切换 | H | 4h |
| C6 | `libs/interaction/src/comment/comment.service.ts` | comment 主流程重构到 drizzle（最重） | H | 10h |
| C7 | `libs/interaction/src/browse-log/browse-log.service.ts` | 浏览写入、计数更新切换 | M | 3h |
| C8 | `libs/interaction/src/download/download.service.ts` | 下载流程与聚合 SQL 切换 | H | 6h |
| C9 | `libs/interaction/src/purchase/purchase.service.ts` | 购买流程、扣积分事务切换 | H | 7h |
| C10 | `libs/interaction/src/reading-state/reading-state.service.ts` | 阅读状态切换 | M | 3h |
| C11 | `libs/interaction/src/comment/comment-permission.service.ts` | 权限查询切换 | L | 1.5h |
| C12 | `libs/interaction/src/browse-log/browse-log-permission.service.ts` | 权限查询切换 | L | 1.5h |
| C13 | `libs/interaction/src/interaction-target-resolver.service.ts` | target 解析流程 tx 联动切换 | M | 2h |
| C14 | `libs/interaction/src/like/like-growth.service.ts` | 奖励事务入口改 drizzle | M | 2h |
| C15 | `libs/interaction/src/favorite/favorite-growth.service.ts` | 同上 | M | 1.5h |
| C16 | `libs/interaction/src/report/report-growth.service.ts` | 同上 | M | 1.5h |
| C17 | `libs/interaction/src/browse-log/browse-log-growth.service.ts` | 同上 | M | 1.5h |
| C18 | `libs/interaction/src/comment/resolver/comment-like.resolver.ts` | resolver 查询与 tx 类型切换 | M | 2h |
| C19 | `libs/interaction/src/comment/resolver/comment-report.resolver.ts` | resolver 查询与 tx 类型切换 | M | 1.5h |

### Phase D：content + forum resolver 联动切换

#### D1 content resolver（22 个）

| 顺序 | 文件 | 改造内容 | 风险 | 预估 |
|---|---|---|---|---|
| D1.1 | `libs/content/src/work/core/resolver/work-comic-like.resolver.ts` | tx 类型与查询切换 | M | 1h |
| D1.2 | `libs/content/src/work/core/resolver/work-novel-like.resolver.ts` | 同上 | M | 1h |
| D1.3 | `libs/content/src/work/chapter/resolver/work-comic-chapter-like.resolver.ts` | 同上 | M | 1h |
| D1.4 | `libs/content/src/work/chapter/resolver/work-novel-chapter-like.resolver.ts` | 同上 | M | 1h |
| D1.5 | `libs/content/src/work/core/resolver/work-comic-favorite.resolver.ts` | 同上 | M | 1h |
| D1.6 | `libs/content/src/work/core/resolver/work-novel-favorite.resolver.ts` | 同上 | M | 1h |
| D1.7 | `libs/content/src/work/core/resolver/work-comic-report.resolver.ts` | 同上 | M | 1h |
| D1.8 | `libs/content/src/work/core/resolver/work-novel-report.resolver.ts` | 同上 | M | 1h |
| D1.9 | `libs/content/src/work/chapter/resolver/work-comic-chapter-report.resolver.ts` | 同上 | M | 1h |
| D1.10 | `libs/content/src/work/chapter/resolver/work-novel-chapter-report.resolver.ts` | 同上 | M | 1h |
| D1.11 | `libs/content/src/work/core/resolver/work-comic-browse-log.resolver.ts` | 同上 | M | 1h |
| D1.12 | `libs/content/src/work/core/resolver/work-novel-browse-log.resolver.ts` | 同上 | M | 1h |
| D1.13 | `libs/content/src/work/chapter/resolver/work-comic-chapter-browse-log.resolver.ts` | 同上 | M | 1h |
| D1.14 | `libs/content/src/work/chapter/resolver/work-novel-chapter-browse-log.resolver.ts` | 同上 | M | 1h |
| D1.15 | `libs/content/src/work/chapter/resolver/work-comic-chapter-download.resolver.ts` | 同上 | M | 1h |
| D1.16 | `libs/content/src/work/chapter/resolver/work-novel-chapter-download.resolver.ts` | 同上 | M | 1h |
| D1.17 | `libs/content/src/work/chapter/resolver/work-comic-chapter-purchase.resolver.ts` | 同上 | M | 1h |
| D1.18 | `libs/content/src/work/chapter/resolver/work-novel-chapter-purchase.resolver.ts` | 同上 | M | 1h |
| D1.19 | `libs/content/src/work/core/resolver/work-comic-comment.resolver.ts` | 同上 | M | 1h |
| D1.20 | `libs/content/src/work/core/resolver/work-novel-comment.resolver.ts` | 同上 | M | 1h |
| D1.21 | `libs/content/src/work/chapter/resolver/work-comic-chapter-comment.resolver.ts` | 同上 | M | 1h |
| D1.22 | `libs/content/src/work/chapter/resolver/work-novel-chapter-comment.resolver.ts` | 同上 | M | 1h |

#### D2 forum resolver（5 个）

| 顺序 | 文件 | 改造内容 | 风险 | 预估 |
|---|---|---|---|---|
| D2.1 | `libs/forum/src/topic/resolver/forum-topic-like.resolver.ts` | tx 类型与查询切换 | M | 1h |
| D2.2 | `libs/forum/src/topic/resolver/forum-topic-favorite.resolver.ts` | 同上 | M | 1h |
| D2.3 | `libs/forum/src/topic/resolver/forum-topic-report.resolver.ts` | 同上 | M | 1h |
| D2.4 | `libs/forum/src/topic/resolver/forum-topic-browse-log.resolver.ts` | 同上 | M | 1h |
| D2.5 | `libs/forum/src/topic/resolver/forum-topic-comment.resolver.ts` | 同上 | M | 1h |

### Phase E：收口清理

| 顺序 | 文件 | 改造内容 | 风险 | 预估 |
|---|---|---|---|---|
| E1 | `libs/interaction/src/core.module.ts` | 核对 provider 注入关系，移除不再需要的 Prisma 依赖链 | L | 0.5h |
| E2 | `libs/growth/src/*/*.module.ts` | 核对模块导入，去掉无效耦合 | L | 1h |
| E3 | `libs/platform/src/database/platform.service.ts` | 标记为遗留层，避免在改造范围继续被引用 | M | 1h |

## 5. 不合理点直接调整（本次一并落地）

1. Resolver 接口层透出 Prisma 事务类型不合理
   处理：统一替换为 `InteractionTx` 抽象，不再透出 ORM 细节。

2. interaction 目标访问依赖动态 modelKey 不合理
   处理：改为显式 table 映射，保证类型可推断、调用可追踪。

3. purchase/download SQL 语义分散在服务中不合理
   处理：统一收敛为 Drizzle SQL 构建与共享查询辅助。

4. 分页语义 0/1 混用不合理
   处理：统一主语义为 1-based，服务内按统一规则处理。

5. growth 并发语义过度依赖 ORM 特性不合理
   处理：在 Drizzle 代码中显式表达冲突忽略与条件更新约束。

## 6. 明确不做事项

- 不做 Prisma/Drizzle 双实现并存。
- 不做按配置切换驱动。
- 不做回退方案文档。
- 不做并发压测脚本。
- 不做测试计划与测试脚本条目。

## 7. 总工时估算

- Phase A：约 10.5h
- Phase B：约 34h
- Phase C：约 67h
- Phase D：约 27h
- Phase E：约 2.5h
- **总计：约 141h（约 17.5 人天）**

> 建议 2 人并行，整体工期约 2 周。

## 8. 完成判定

- 目标范围文件完成 Drizzle 改造。
- 迁移后清单内文件不再依赖 Prisma 类型与 Prisma 查询入口。
- 文档中定义的“不合理点”均已在代码中对应调整。

## 9. 当前改造成果（截至本次）

### 9.1 已完成（按文件）

- Phase A（接口与类型）
  - `libs/interaction/src/report/interfaces/report-target-resolver.interface.ts`
  - `libs/interaction/src/like/interfaces/like-target-resolver.interface.ts`
  - `libs/interaction/src/favorite/interfaces/favorite-target-resolver.interface.ts`
  - `libs/interaction/src/comment/interfaces/comment-target-resolver.interface.ts`
  - `libs/interaction/src/browse-log/interfaces/browse-log-target-resolver.interface.ts`
  - `libs/interaction/src/download/interfaces/download-target-resolver.interface.ts`
  - `libs/interaction/src/purchase/interfaces/purchase-target-resolver.interface.ts`
  - `libs/interaction/src/reading-state/interfaces/reading-state-resolver.interface.ts`
  - `libs/interaction/src/query.helper.ts`
  - `libs/interaction/src/index.ts`
  - `libs/interaction/src/interaction-tx.type.ts`

- Phase B（growth 已完成项）
  - `libs/growth/src/growth-ledger/growth-ledger.service.ts`（主事务链路已切 Drizzle，兼容旧事务调用）
  - `libs/growth/src/point/point.service.ts`（主流程事务、分页与统计查询已切 Drizzle）
  - `libs/growth/src/experience/experience.service.ts`（主流程事务、分页与统计查询已切 Drizzle）
  - `libs/growth/src/growth-reward/growth-reward.service.ts`（奖励发放事务入口已切 Drizzle）
  - `libs/growth/src/level-rule/level-rule.service.ts`（复杂查询与统计已切 Drizzle）
  - `libs/growth/src/badge/user-badge.service.ts`（徽章写入与查询已切 Drizzle）
  - `libs/growth/src/point/point-rule.service.ts`
  - `libs/growth/src/permission/permission.service.ts`
  - `libs/growth/src/resolver/user-report.resolver.ts`（已去除 PlatformService）

- Phase C（interaction 已完成项）
  - `libs/interaction/src/interaction-target-access.service.ts`
  - `libs/interaction/src/interaction-target.definition.ts`（已切为 `tableKey + whereBuilder/whereInBuilder`）
  - `libs/interaction/src/interaction-target-resolver.service.ts`
  - `libs/interaction/src/reading-state/reading-state.service.ts`
  - `libs/interaction/src/comment/comment-permission.service.ts`
  - `libs/interaction/src/browse-log/browse-log-permission.service.ts`
  - `libs/interaction/src/download/download.service.ts`
  - `libs/interaction/src/purchase/purchase.service.ts`
  - `libs/interaction/src/report/report.service.ts`
  - `libs/interaction/src/like/like.service.ts`（已去除 PlatformService，主事务写链路已切 Drizzle）
  - `libs/interaction/src/browse-log/browse-log.service.ts`（已去除 PlatformService，主事务写链路已切 Drizzle）
  - `libs/interaction/src/favorite/favorite.service.ts`（已去除 PlatformService，主事务写链路已切 Drizzle）
  - `libs/interaction/src/comment/comment.service.ts`（已去除 PlatformService，评论/回复主事务写链路已切 Drizzle）
  - `libs/interaction/src/comment/comment-growth.service.ts`（已去除 PlatformService）
  - `libs/interaction/src/like/like-growth.service.ts`（已去除 PlatformService）
  - `libs/interaction/src/favorite/favorite-growth.service.ts`（已去除 PlatformService）
  - `libs/interaction/src/report/report-growth.service.ts`（已去除 PlatformService）
  - `libs/interaction/src/browse-log/browse-log-growth.service.ts`（已去除 PlatformService）
  - `libs/interaction/src/comment/resolver/comment-like.resolver.ts`
  - `libs/interaction/src/comment/resolver/comment-report.resolver.ts`
  - `libs/message/src/outbox/outbox.service.ts`（已支持 Drizzle tx 写入 outbox）

- Phase D（content/forum resolver）
  - content work/core 与 work/chapter 下 22 个 resolver 已完成 tx 类型联动替换
  - forum topic 下 5 个 resolver 已完成 tx 类型联动替换
  - browse-log 相关 5 个 resolver 已去除 PlatformService
  - like/favorite/comment 相关 resolver 的查询与计数字段更新已切为 Drizzle 风格

### 9.2 约束执行结果

- 已完成改造的核心服务文件不再继承 `PlatformService`：
  - `interaction-target-access.service.ts`
  - `interaction-target-resolver.service.ts`
  - `reading-state.service.ts`
  - `comment-permission.service.ts`
  - `browse-log-permission.service.ts`
  - `download.service.ts`
  - `purchase.service.ts`
  - `report.service.ts`
  - `like.service.ts`
  - `browse-log.service.ts`
  - `favorite.service.ts`
  - `comment.service.ts`
  - `comment-growth.service.ts`
  - `like-growth.service.ts`
  - `favorite-growth.service.ts`
  - `report-growth.service.ts`
  - `browse-log-growth.service.ts`
  - `comment-like.resolver.ts`
  - `comment-report.resolver.ts`
  - `growth-reward.service.ts`
  - `level-rule.service.ts`
  - `user-badge.service.ts`
  - `user-report.resolver.ts`

- 新增收口结果（本轮）：
  - `libs/interaction/src/report/report.service.ts` 已移除 `PrismaService` 并切换为 Drizzle 事务写入
  - `libs/interaction/src/download/download.service.ts` 已移除 `PrismaService` 并切换为 Drizzle 事务写入/状态查询
  - `libs/interaction/src/purchase/purchase.service.ts` 已移除 `PrismaService` 并切换为 Drizzle 事务写入
  - `libs/interaction/src/comment/comment.service.ts` 已移除 `PrismaService`，评论奖励与删除链路切换为 Drizzle
  - `libs/interaction/src/comment/resolver/comment-like.resolver.ts` 已移除 `PrismaService`，批量详情查询切换为 Drizzle
  - `libs/content/src/work/chapter/resolver/work-*-chapter-download.resolver.ts` 与 `work-*-chapter-purchase.resolver.ts` 已完成 Drizzle 事务形态适配
  - `libs/content/src/work/**/resolver/*-report.resolver.ts`、`libs/forum/src/topic/resolver/forum-topic-report.resolver.ts`、`libs/growth/src/resolver/user-report.resolver.ts` 已完成 Drizzle 事务查询形态适配

## 10. 未完成改造清单（详细）

- 已无剩余未完成项（Phase B/C/E 均已收口完成）。

