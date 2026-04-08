# 数据库表改名优先级与迁移风险清单

审计时间：2026-04-08

适用范围：

- 存量表改名评估
- schema 重构前的风险判断
- migration 窗口规划

关联文档：

- 规范基线：`../../.trae/rules/TABLE_NAMING_SPEC.md`
- 存量分档：`./table-naming-audit.md`

## 1. 先看结论

当前不建议发起“仅为了命名更整齐”的独立表改名。

建议顺序：

1. `task`：有改名价值，但风险最高，只建议在 task 域重构窗口顺带处理。
2. `user_badge`：有一定语义优化空间，但收益中等，优先级低于 `task`。
3. `sensitive_word`：当前不建议动，先等治理域边界稳定，再决定目标前缀。

## 2. 风险分层

### 2.1 两种改法必须区分

同一张表，至少有两种改法：

- 物理表改名：只改 `pgTable('旧表名')` 中的数据库表名，暂时保留 TypeScript 常量名。
- 语义全量改名：数据库表名、Drizzle 常量名、类型名、service 内部 getter 名、引用变量名一起改。

风险差异：

- 物理表改名：主要影响 migration、生成物、数据库对象名和排障习惯。
- 语义全量改名：额外影响应用代码、关系定义、seed、DTO 映射和测试语义。

### 2.2 风险等级

- 低：影响面集中，主要在 schema 与少量业务文件。
- 中：涉及多个业务模块或历史生成物，但可以在单一窗口内完成。
- 高：涉及高频业务域、广泛代码引用、生成物、迁移窗口和较强回归验证成本。

## 3. 候选表矩阵

| 表名 | 建议目标 | 改名收益 | 物理表改名风险 | 语义全量改名风险 | 当前建议 |
|------|----------|----------|----------------|------------------|----------|
| `task` | `task_definition` | 高 | 中 | 高 | 仅在 task 域重构窗口处理 |
| `user_badge` | `badge` / `badge_definition` | 中 | 低到中 | 中 | 暂缓，等 badge 域继续演化 |
| `sensitive_word` | `moderation_sensitive_word` / `sys_sensitive_word` | 低到中 | 低到中 | 中 | 暂不处理，先定治理域归属 |

## 4. 逐表分析

### 4.1 `task` → `task_definition`

#### 现状判断

- 改名价值：高
- 物理表改名风险：中
- 语义全量改名风险：高

#### 收益

- `task` 当前主体名过泛。
- 与 `task_assignment`、`task_progress_log` 并列时，`task_definition` 更能明确“模板定义表”语义。
- 后续新增 task 域近身表时，命名空间更清楚。

#### 影响面证据

基于当前仓库搜索结果：

- `task` 常量或语义引用分布在约 `35` 个文件。
- `task` / `task_assignment` / `task_progress_log` 相关表族分布在约 `51` 个文件。
- 覆盖范围包括：
  - `libs/growth/src/task/*`
  - `apps/admin-api/src/modules/task/*`
  - `apps/app-api/src/modules/task/*`
  - `db/schema/app/*`
  - `db/relations/*`
  - `db/seed/modules/app/*`
  - `db/comments/generated.sql`
  - `db/migration/*/snapshot.json`

#### 风险拆分

物理表改名风险主要来自：

- 需要新增 migration。
- `task_*` 相关索引、唯一约束、注释生成物会跟着变化。
- 历史 snapshot 与历史排障材料中会长期保留旧表名，短期内会出现“新旧名称并存”。

语义全量改名风险额外来自：

- `drizzle.schema.task`
- `db.query.task`
- `Task` / `task` 相关内部变量、getter、service 支撑层
- task 域模块内的大量上下文命名

#### 建议策略

优先推荐两阶段，而不是一次性全改：

1. 第一阶段只改物理表名为 `task_definition`，保留导出常量 `task`。
2. 第二阶段如确有必要，再把常量名、类型名和内部变量名收敛为 `taskDefinition`。

这样做的好处：

- 第一阶段几乎不碰上层业务调用。
- 可以把“数据库对象改名”和“代码语义改名”拆成两个独立风险面。

#### 推荐窗口

- task 域 schema 重构
- task 域新增更多主实体近身表，命名冲突明显时
- 已经确定用户可亲自处理 `pnpm db:generate` 可能出现的交互式迁移生成

#### 当前结论

这是唯一值得明确列入“下次有窗口优先处理”的表。

### 4.2 `user_badge` → `badge` / `badge_definition`

#### 现状判断

- 改名价值：中
- 物理表改名风险：低到中
- 语义全量改名风险：中

#### 收益

- 当前 `user_badge` 实际承载的是“徽章定义”，不是“用户已获徽章事实”。
- 与 `user_badge_assignment` 同时存在时，单看表名容易误解。
- 若后续 badge 域继续扩展，`badge_definition` 的语义会更稳。

#### 影响面证据

基于当前仓库搜索结果：

- `userBadge` 常量引用约 `7` 个文件。
- `user_badge` 物理表名主要出现在：
  - `db/schema/app/user-badge.ts`
  - `db/comments/generated.sql`
  - `db/migration/*/snapshot.json`
  - `user_badge_assignment` 相关生成物

业务引用主要集中在：

- `libs/growth/src/badge/user-badge.service.ts`
- `apps/app-api/src/modules/user/user.service.ts`
- `libs/forum/src/profile/profile.service.ts`
- `db/seed/modules/app/domain.ts`

#### 风险拆分

物理表改名风险不算高：

- 当前没有发现大量应用层原生 SQL 直写旧表名。
- 大部分运行时代码通过 Drizzle 表对象访问。

语义全量改名风险主要来自：

- badge 域 service、profile 聚合、用户中心展示链路会同步改名。
- `userBadge` 与 `userBadgeAssignment` 这对命名需要整体协调，否则会出现一半是“徽章定义”，一半还是“用户徽章分配”。

#### 建议策略

- 若未来 badge 域要细化，优先把定义表显式收敛为 `badge_definition`。
- 若只是轻量优化命名，也可以收敛为 `badge`，但要保证 `user_badge_assignment` 不会因此变得更难读。

#### 推荐窗口

- badge 域扩容
- 用户成就体系改版
- 用户中心与 profile 徽章逻辑统一整理

#### 当前结论

可改，但不值得抢在 `task` 前面做。

### 4.3 `sensitive_word` → `moderation_sensitive_word` / `sys_sensitive_word`

#### 现状判断

- 改名价值：低到中
- 物理表改名风险：低到中
- 语义全量改名风险：中

#### 收益

- 这张表真正的问题不是“名字不清楚”，而是“归属前缀未定”。
- 如果确定它是系统基础设施，可以收敛为 `sys_sensitive_word`。
- 如果确定它属于内容治理域，更合理的方向是 `moderation_sensitive_word`。

#### 影响面证据

基于当前仓库搜索结果：

- `sensitiveWord` 常量引用约 `7` 个文件。
- `sensitive_word` 物理表名主要出现在：
  - `db/schema/system/sensitive-word.ts`
  - `db/comments/generated.sql`
  - `db/migration/*/snapshot.json`

业务引用主要集中在：

- `libs/moderation/sensitive-word/*`
- `db/seed/modules/system/domain.ts`

#### 风险拆分

技术风险不算最高，但组织风险较高：

- 还没有最终确认它到底归 `system` 还是未来独立的 `moderation` 域。
- 现在就改，容易只是把“前缀不统一”变成“改了一次以后还得再改第二次”。

#### 建议策略

- 在治理域边界未稳定前，不建议动。
- 若未来新增更多治理表，先决定是否建立 `moderation_*` 体系，再统一迁移。
- 若最终确认仍属于 system，再考虑一次性向 `sys_*` 收敛。

#### 推荐窗口

- moderation 域独立
- 内容审核 / 风控 / 治理模型统一重构

#### 当前结论

先不改，比贸然改更合理。

## 5. 实施建议

### 5.1 推荐顺序

若未来确实要做存量改名，建议顺序如下：

1. `task`
2. `user_badge`
3. `sensitive_word`

### 5.2 不推荐的做法

- 不要把三个表打包成一次“大统一重命名”。
- 不要在没有业务窗口的情况下，为了命名纯度单独起 migration。
- 不要同时做“物理表改名 + 常量名改名 + 模块名改名”，这样回归面过大。

### 5.3 推荐做法

优先采用“小步迁移”：

1. 先确认目标命名是否已经稳定。
2. 优先改物理表名，尽量暂时保留 Drizzle 常量名。
3. 等数据库迁移稳定后，再评估是否有必要做第二阶段语义改名。

## 6. 与 migration 规范的关系

按当前仓库规范：

- migration 只能通过 `pnpm db:generate` 生成。
- 若生成过程中出现交互式 rename / conflict 选择，必须由用户亲自在终端完成。

因此，任何存量表改名都不应被视为“顺手小改动”，而应视为明确的迁移窗口任务。
