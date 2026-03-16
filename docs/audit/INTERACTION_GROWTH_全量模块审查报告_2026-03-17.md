# interaction 与 growth 模块全量审查报告（2026-03-17）

## 1. 审查范围与方法

### 1.1 审查范围

- interaction：`libs/interaction/src` 全部文件（69 个）
- growth：`libs/growth/src` 全部文件（44 个）

### 1.2 审查维度

- 业务逻辑正确性（规则映射、状态流转、幂等与一致性）
- 并发与事务一致性（乐观锁、冲突重试、跨事务副作用）
- 异常处理语义（错误分级、吞错、可观测性）
- 可维护性（冗余代码、死代码、类型安全、可读性）
- 性能与扩展性（N+1、串行循环、查询代价）

### 1.3 结论概览

- 高风险问题：5 项
- 中风险问题：10 项
- 低风险/技术债：16 项
- 文件级结论：
  - 核心业务服务文件存在结构性风险（主要在事务边界、映射正确性、并发更新）
  - DTO/接口/模块装配类文件整体健康
  - 存在部分明显可清理冗余与历史迁移残留

---

## 2. 高风险问题（建议优先修复）

### H1. 章节点赞成长规则映射错误（会发错奖励规则）

- 文件：`libs/interaction/src/interaction-target-growth-rule.ts`
- 位置：L26-L28
- 现象：`NOVEL_CHAPTER` 被映射到 `COMIC_CHAPTER_LIKE`
- 影响：小说章节点赞会按漫画章节点赞规则计奖，导致积分/经验发放策略错误、运营数据失真

### H2. 目标计数更新脱离事务上下文（事务一致性破坏）

- 文件：`libs/interaction/src/interaction-target-access.service.ts`
- 位置：L276-L303
- 现象：
  - 入参有 `tx`，但函数内 `void tx`
  - 更新通过 `this.drizzle.ext.applyCountDelta(...)` 直接执行
- 影响：在点赞/收藏/评论等“写记录 + 计数更新”链路里，计数可能与主记录不一致（主事务回滚但计数已变更）

### H3. 任务进度/完成的乐观锁失败未判空（并发下潜在运行时错误）

- 文件：`libs/growth/src/task/task.service.ts`
- 位置：
  - `reportProgress`：L546-L562、L581-L586
  - `completeTask`：L633-L648、L661-L663
- 现象：`update ... where version = oldVersion` 可能 0 行更新，但代码直接使用 `updated.status`
- 影响：高并发上报/完成任务时，可能出现 `undefined.status` 运行时异常或脏语义返回

### H4. 举报奖励默认兜底规则不安全（目标类型扩展时高概率错发）

- 文件：`libs/interaction/src/report/report-growth.service.ts`
- 位置：L34-L37
- 现象：未命中映射时默认 `TOPIC_REPORT`
- 影响：新增举报目标类型（尤其 USER）若漏配映射会错误发放“主题举报”奖励

### H5. 任务常量文件注释乱码（编码污染，影响长期维护）

- 文件：`libs/growth/src/task/task.constant.ts`
- 位置：全文件注释
- 现象：中文注释全部乱码
- 影响：规则语义不可读，后续修改与交接成本高，易误改

---

## 3. 中风险问题（建议排期修复）

### M1. 成长奖励链路大量吞错且无日志

- 文件：
  - `libs/interaction/src/like/like-growth.service.ts`（L87, L133）
  - `libs/interaction/src/favorite/favorite-growth.service.ts`（L58）
  - `libs/interaction/src/browse-log/browse-log-growth.service.ts`（L70）
  - `libs/interaction/src/report/report-growth.service.ts`（L60）
  - `libs/growth/src/growth-reward/growth-reward.service.ts`（L72, L135）
- 影响：奖励失败无法观测，线上排障困难，运营误判“奖励系统正常”

### M2. 默认 bizKey 基于时间戳，天然非幂等

- 文件：
  - `libs/growth/src/point/point.service.ts`（L396-L398）
  - `libs/growth/src/experience/experience.service.ts`（L334-L336）
- 影响：相同业务事件重试时可能重复入账，幂等依赖调用方“必须手动传 bizKey”，易误用

### M3. 评论奖励 targetId 写入口径不一致

- 文件：`libs/interaction/src/comment/comment-growth.service.ts`
- 位置：L33、L45
- 现象：参数里有 `targetId`，但写账本时使用 `targetId: commentId`
- 影响：成长流水难以按“被评论目标”聚合，报表与追踪语义偏差

### M4. TaskService 存在典型 N+1/串行分配

- 文件：`libs/growth/src/task/task.service.ts`
- 位置：L1073-L1077、L1086-L1107
- 影响：任务数增长后，`getMyTasks`/`getAvailableTasks` 会放大数据库调用次数

### M5. 阅读历史存在分组后二次逐条章节查询

- 文件：`libs/interaction/src/reading-state/reading-state.service.ts`
- 位置：L226-L259
- 影响：列表越长，章节快照查询越多，出现明显延迟（N+1）

### M6. GrowthLedger 失败路径审计不完整

- 文件：`libs/growth/src/growth-ledger/growth-ledger.service.ts`
- 位置：`applyByRule`/`applyDelta`
- 现象：规则不存在、限额拒绝等路径多数直接 return，不写 deny 审计
- 影响：风控与运营对失败原因的统计不完整

### M7. Favorite 列表详情聚合吞异常

- 文件：`libs/interaction/src/favorite/favorite.service.ts`
- 位置：L272-L283
- 影响：某一目标解析器异常会被静默吞掉，返回数据缺字段，调用方难定位问题

### M8. 查询分页语义混合 0/1 基

- 文件：`libs/interaction/src/query.helper.ts`
- 位置：L12-L35
- 影响：上下游若不统一易出现“翻页跳页/重复页”，长期维护认知成本高

### M9. CommentService 类型降级较多

- 文件：`libs/interaction/src/comment/comment.service.ts`
- 位置：L199、L254、L270、L531
- 影响：编译期约束弱化，后续改动更容易引入运行时错误

### M10. LevelRule 计数接口过度 any 化

- 文件：`libs/growth/src/level-rule/level-rule.service.ts`
- 位置：L425
- 影响：扩展统计逻辑时，参数与返回约束弱，重构风险高

---

## 4. 低风险与技术债

- `interaction-target-access.service.ts` 中 `getTargetModel` 仅定义未被调用，且仍是 Prisma 语义残留
- 多个接口/注释仍有 Prisma 文案，不影响运行但增加认知负担
- `task/tsconfig.lib.json` 位于 `src` 下，结构上不够统一
- 多处 `any`/`as any` 用于 SQL 结果解包（download/purchase/reading-state 等），建议逐步收敛

---

## 5. 逐文件审查清单（interaction）

说明：状态定义为【通过 / 关注 / 风险】。
通过=无明显业务风险；关注=存在维护或可观测性问题；风险=存在业务正确性或一致性问题。

### 5.1 根级与核心路由

- `core.module.ts`：通过
- `index.ts`：通过
- `interaction-target-access.service.ts`：风险（H2 + 迁移残留）
- `interaction-target-growth-rule.ts`：风险（H1，且当前疑似未被引用）
- `interaction-target-resolver.service.ts`：通过
- `interaction-target.definition.ts`：通过
- `interaction-tx.type.ts`：通过
- `query.helper.ts`：关注（M8）

### 5.2 browse-log

- `browse-log/browse-log-growth.service.ts`：关注（M1）
- `browse-log/browse-log-interaction.service.ts`：通过（占位实现）
- `browse-log/browse-log-permission.service.ts`：通过
- `browse-log/browse-log.constant.ts`：通过
- `browse-log/browse-log.module.ts`：通过
- `browse-log/browse-log.service.ts`：通过
- `browse-log/index.ts`：通过
- `browse-log/dto/browse-log.dto.ts`：通过
- `browse-log/interfaces/browse-log-target-resolver.interface.ts`：通过

### 5.3 comment

- `comment/comment-growth.service.ts`：关注（M3 + any）
- `comment/comment-permission.service.ts`：通过
- `comment/comment.constant.ts`：通过
- `comment/comment.module.ts`：通过
- `comment/comment.service.ts`：关注（M9，复杂度高）
- `comment/index.ts`：通过
- `comment/dto/comment.dto.ts`：通过
- `comment/interfaces/comment-target-resolver.interface.ts`：通过
- `comment/resolver/comment-like.resolver.ts`：通过
- `comment/resolver/comment-report.resolver.ts`：通过

### 5.4 download

- `download/download.constant.ts`：通过
- `download/download.module.ts`：通过
- `download/download.service.ts`：关注（any 解包 + 重复 SQL 模式）
- `download/index.ts`：通过
- `download/dto/download.dto.ts`：通过
- `download/interfaces/download-target-resolver.interface.ts`：通过

### 5.5 favorite

- `favorite/favorite-growth.service.ts`：关注（M1）
- `favorite/favorite.constant.ts`：通过
- `favorite/favorite.module.ts`：通过
- `favorite/favorite.service.ts`：关注（M7 + any）
- `favorite/index.ts`：通过
- `favorite/dto/favorite.dto.ts`：通过
- `favorite/interfaces/favorite-target-resolver.interface.ts`：关注（`any` 返回）

### 5.6 like

- `like/index.ts`：通过
- `like/like-growth.service.ts`：关注（M1）
- `like/like.constant.ts`：通过
- `like/like.module.ts`：通过
- `like/like.service.ts`：通过
- `like/dto/like.dto.ts`：通过
- `like/interfaces/like-target-resolver.interface.ts`：关注（`any` 返回）

### 5.7 purchase

- `purchase/index.ts`：通过
- `purchase/purchase.constant.ts`：通过
- `purchase/purchase.module.ts`：通过
- `purchase/purchase.service.ts`：关注（any 解包 + SQL 重复模式）
- `purchase/dto/purchase.dto.ts`：通过
- `purchase/interfaces/purchase-target-resolver.interface.ts`：通过

### 5.8 reading-state

- `reading-state/index.ts`：通过
- `reading-state/reading-state.module.ts`：通过
- `reading-state/reading-state.service.ts`：关注（M5 + any）
- `reading-state/dto/reading-state.dto.ts`：通过
- `reading-state/interfaces/reading-state-resolver.interface.ts`：通过

### 5.9 report

- `report/index.ts`：通过
- `report/report-growth.service.ts`：风险（H4）+关注（M1）
- `report/report.constant.ts`：通过
- `report/report.module.ts`：通过
- `report/report.service.ts`：通过
- `report/dto/report-app.dto.ts`：通过
- `report/dto/report.dto.ts`：通过
- `report/interfaces/report-target-resolver.interface.ts`：通过

---

## 6. 逐文件审查清单（growth）

### 6.1 根级

- `growth-rule.constant.ts`：通过
- `index.ts`：通过

### 6.2 badge

- `badge/index.ts`：通过
- `badge/user-badge.constant.ts`：通过
- `badge/user-badge.module.ts`：通过
- `badge/user-badge.service.ts`：关注（查询复杂度上升风险，可继续拆分）
- `badge/dto/user-badge.dto.ts`：通过

### 6.3 experience

- `experience/experience.constant.ts`：通过
- `experience/experience.module.ts`：通过
- `experience/experience.service.ts`：关注（M2）
- `experience/index.ts`：通过
- `experience/dto/experience-record.dto.ts`：通过
- `experience/dto/experience-rule.dto.ts`：通过

### 6.4 growth-ledger

- `growth-ledger/growth-ledger.constant.ts`：通过
- `growth-ledger/growth-ledger.module.ts`：通过
- `growth-ledger/growth-ledger.service.ts`：关注（M6 + any 事务抽象）
- `growth-ledger/growth-ledger.types.ts`：通过
- `growth-ledger/index.ts`：通过

### 6.5 growth-reward

- `growth-reward/growth-reward.module.ts`：通过
- `growth-reward/growth-reward.service.ts`：关注（M1，source 参数未使用）
- `growth-reward/index.ts`：通过

### 6.6 level-rule

- `level-rule/index.ts`：通过
- `level-rule/level-rule.constant.ts`：通过
- `level-rule/level-rule.module.ts`：通过
- `level-rule/level-rule.service.ts`：关注（M10）
- `level-rule/dto/level-rule.dto.ts`：通过

### 6.7 permission

- `permission/index.ts`：通过
- `permission/permission.module.ts`：通过
- `permission/permission.service.ts`：通过

### 6.8 point

- `point/index.ts`：通过
- `point/point-rule.service.ts`：通过
- `point/point.constant.ts`：通过
- `point/point.module.ts`：通过
- `point/point.service.ts`：关注（M2）
- `point/dto/point-record.dto.ts`：通过
- `point/dto/point-rule.dto.ts`：通过

### 6.9 resolver

- `resolver/user-report-resolver.module.ts`：通过
- `resolver/user-report.resolver.ts`：通过

### 6.10 task

- `task/index.ts`：通过
- `task/task.constant.ts`：风险（H5）
- `task/task.module.ts`：通过
- `task/task.service.ts`：风险（H3）+关注（M4）
- `task/tsconfig.lib.json`：关注（结构放置可优化）
- `task/dto/task.dto.ts`：通过

---

## 7. 冗余与维护困难点汇总

1. **未引用逻辑存在误导风险**
   - `interaction-target-growth-rule.ts` 当前未被模块内引用，但内部有错误映射；后续接入时会直接引爆业务错误。

2. **历史迁移语义残留**
   - 多处注释/方法仍以 Prisma 术语描述，和当前 Drizzle 实现不一致，维护者容易误判事务边界。

3. **重复 SQL 模式**
   - `download.service.ts` 与 `purchase.service.ts` 有大段结构相似 SQL + 结果解包，可抽取共享查询模板。

4. **类型收敛不足**
   - 多个关键流程使用 `any` 承接 tx/SQL 结果，削弱编译期防护。

---

## 8. 修复优先级建议

### P0（立即）

- 修复 H1/H2/H3/H4/H5

### P1（本迭代）

- 奖励吞错链路补日志（含 bizKey、ruleType、target、reason）
- 统一幂等策略：业务事件必须传稳定 bizKey，服务端默认值改为可重入键
- 修复阅读历史与任务自动分配的 N+1/串行问题

### P2（后续优化）

- 清理未引用代码与 Prisma 文案残留
- 收敛 `any`，为核心查询返回结构补类型
- 抽离下载/购买公共查询层

---

## 9. 最终结论

interaction 与 growth 模块整体架构方向正确，但当前存在数个“会直接影响业务结果”的高风险点，尤其是：

- 成长规则映射准确性
- 事务边界一致性
- 并发乐观锁失败处理

建议先完成 P0 修复，再进行可观测性与可维护性治理。

---

## 10. Drizzle 规范对标结论（以 dictionary.service.ts 为基准）

本节按 `libs/config/src/dictionary/dictionary.service.ts` 的写法作为“规范基线”评估 interaction 与 growth 的 Drizzle 使用一致性。

### 10.1 基线定义（dictionary 服务体现的规范）

基准文件：`libs/config/src/dictionary/dictionary.service.ts`

- 查询分页统一：`drizzle.ext.findPagination + drizzle.buildWhere`
- 写操作异常统一：`drizzle.withErrorHandling(...)`
- 受影响行数断言统一：`drizzle.assertAffectedRows(...)`
- 读写入口统一走 `DrizzleService`（`this.drizzle.db` / `this.drizzle.schema`）
- 尽量避免 `any`、避免手工解包底层驱动结果结构

对应参考位置：

- `findPagination/buildWhere`：L116-L127、L229-L247
- `withErrorHandling`：L153-L159、L170-L177、L189-L195、L216-L218
- `assertAffectedRows`：L178、L196、L219

### 10.2 总体结论

- **growth 模块：中等偏规范**
  - 管理类服务（point-rule / experience / level-rule / task）较多采用了 `withErrorHandling + assertAffectedRows`。
  - 但核心账本链路仍存在 `Tx = any` 等类型降级，不完全符合基线的类型安全要求。
- **interaction 模块：规范性明显不足**
  - 几乎未使用 `withErrorHandling` 与 `assertAffectedRows` 统一错误语义。
  - 在下载/购买场景大量使用 `db.execute(sql\`...\`)` + `(rowsResult as any).rows` 手工解包。
  - 事务参数 `tx: any` 与 `as any` 出现较多，偏离基线风格。

### 10.3 明确不规范点（按文件）

#### A. 事务与类型规范偏差

1. `libs/interaction/src/interaction-target-access.service.ts`

- 问题：
  - `tx: any`（L277）
  - `void tx`（L283）导致事务参数未被真正使用
  - `(this.drizzle.schema as any)`、`(this.db.query as any)`（L54、L207）
- 对标结论：**不规范（高优先）**
- 原因：既破坏事务边界，又绕开类型系统。

2. `libs/growth/src/growth-ledger/growth-ledger.service.ts`

- 问题：`type Tx = any`（L15）贯穿核心账本主链路。
- 对标结论：**不规范（中高优先）**
- 原因：核心结算服务使用全局 `any`，与基线“类型收敛”原则冲突。

3. `libs/interaction/src/comment/comment.service.ts`

- 问题：多处 `tx: any` / `as any`（L199、L254、L270、L531）。
- 对标结论：**不规范（中优先）**
- 原因：评论链路复杂，类型降级会放大后续重构风险。

#### B. 错误处理规范偏差

1. interaction 服务整体未统一采用 `withErrorHandling/assertAffectedRows`

- 典型文件：
  - `like.service.ts`
  - `favorite.service.ts`
  - `report.service.ts`
  - `download.service.ts`
  - `purchase.service.ts`
- 对标结论：**不规范（中优先）**
- 原因：同类错误在不同服务中手工分散处理，语义一致性与可维护性弱于基线。

2. 成长奖励链路吞错无日志

- 典型文件：
  - `like-growth.service.ts`（L87、L133）
  - `favorite-growth.service.ts`（L58）
  - `browse-log-growth.service.ts`（L70）
  - `report-growth.service.ts`（L60）
  - `growth-reward.service.ts`（L72、L135）
- 对标结论：**不规范（中优先）**
- 原因：虽然业务允许“奖励失败不阻断主链路”，但基线要求统一可观测处理，不应静默吞错。

#### C. 查询构建规范偏差

1. `libs/interaction/src/download/download.service.ts`
2. `libs/interaction/src/purchase/purchase.service.ts`

- 问题：
  - 多处 `db.execute(sql\`...\`)` 原生 SQL
  - 结果解包依赖 `(rowsResult as any).rows`
- 对标结论：**部分不规范（中优先）**
- 说明：复杂聚合场景使用 SQL 可接受，但当前写法缺少统一封装和类型收敛，明显偏离基线风格。

### 10.4 规范性分级（Drizzle 视角）

- **A级（较符合基线）**
  - `libs/growth/src/point/point-rule.service.ts`
  - `libs/growth/src/experience/experience.service.ts`
  - `libs/growth/src/level-rule/level-rule.service.ts`
  - `libs/growth/src/task/task.service.ts`（仅限管理端 CRUD 相关部分）
- **B级（可用但有明显偏差）**
  - `libs/growth/src/point/point.service.ts`
  - `libs/growth/src/badge/user-badge.service.ts`
  - `libs/interaction/src/like/like.service.ts`
  - `libs/interaction/src/favorite/favorite.service.ts`
  - `libs/interaction/src/report/report.service.ts`
- **C级（偏离基线较大，建议优先治理）**
  - `libs/interaction/src/interaction-target-access.service.ts`
  - `libs/interaction/src/download/download.service.ts`
  - `libs/interaction/src/purchase/purchase.service.ts`
  - `libs/growth/src/growth-ledger/growth-ledger.service.ts`

### 10.5 按基线收敛建议（落地级）

1. **统一异常处理入口**
- 在 interaction 的写操作服务引入与 dictionary 同风格的 `withErrorHandling + assertAffectedRows`。

2. **收敛事务类型**
- 将 `tx: any` / `Tx = any` 逐步替换为统一事务类型（如 `InteractionTx`、`GrowthTx`）。

3. **封装原生 SQL 返回结构**
- 对 download/purchase 的聚合 SQL 封装 typed query helper，禁止业务层直接 `(result as any).rows`。

4. **保留“主流程不阻断”但补齐日志**
- 对所有 `catch {}` 增加结构化日志（bizKey、ruleType、targetType、targetId、error code）。

5. **建立模块内 Drizzle 代码约束清单**
- 约束项建议：
  - 禁止新增 `tx: any`
  - 禁止 `void tx`
  - 禁止新增 `(xxx as any).rows` 解包
  - 写操作必须经过统一错误处理器
