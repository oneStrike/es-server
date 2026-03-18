# Drizzle 自动化整改清单 + 批量修复 PR 方案（逐文件）

基线规范：`docs/audit/drizzle-guidelines.md`（唯一规范源）  
更新日期：2026-03-18

## 1. 自动化整改范围

- 目标一：消除高风险 SQL 注入边界（`sql.raw` 与业务层原生 SQL）。
- 目标二：收敛原生 SQL 到 `db/core/query` helper，并输出强类型结果。
- 目标三：移除业务层 `rows` 手工解包，统一结果映射入口。
- 目标四：补齐事务链路 `tx` 透传一致性，避免事务外读写窗口。

## 2. 逐文件整改清单

| 模块 | 文件 | 问题类型 | 现状 | 整改动作 | 自动化程度 |
|---|---|---|---|---|---|
| db/core/query | `db/core/query/interaction-query.helper.ts` | `sql.raw` 风险 | `sql.raw(column)` 动态注入列名 | 改为白名单映射：`columnKey -> SQL 片段`，拒绝未知 key | 半自动 |
| libs/interaction | `libs/interaction/src/purchase/purchase.service.ts` | 业务层 `db.execute` | 存在复杂 SQL 执行 | 提取到 `db/core/query/purchase-query.helper.ts`，服务层仅调用 helper | 半自动 |
| libs/interaction | `libs/interaction/src/purchase/purchase.service.ts` | 手工解包 `rows` | 本地 `extractRows` | 改为 helper 内统一 `mapWith`/强类型转换，服务层移除解包函数 | 半自动 |
| libs/interaction | `libs/interaction/src/purchase/purchase.service.ts` | 事务边界 | 预校验在事务外 | 将强一致校验并入事务，或增加版本条件更新 | 手动 |
| libs/interaction | `libs/interaction/src/download/download.service.ts` | 业务层 `db.execute` | 存在复杂 SQL 执行 | 提取到 `db/core/query/download-query.helper.ts` | 半自动 |
| libs/interaction | `libs/interaction/src/download/download.service.ts` | 手工解包 `rows` | 本地 `extractRows` | 下沉到 helper 强类型返回，服务层删除手工解包 | 半自动 |
| apps/admin-api | `apps/admin-api/src/modules/message/message-monitor.service.ts` | 业务层 `db.execute` | 多处统计 SQL 在服务层 | 提取到 `db/core/query/message-monitor-query.helper.ts` | 半自动 |
| apps/admin-api | `apps/admin-api/src/modules/message/message-monitor.service.ts` | 手工解包 `rows` | 本地 `extractRows` | 统一 helper 返回 DTO，删除手工 rows 处理 | 半自动 |
| apps/app-api | `apps/app-api/src/modules/user/user.service.ts` | 业务层 `db.execute` | 用户统计 SQL 在服务层 | 提取到 `db/core/query/user-query.helper.ts` | 半自动 |
| apps/app-api | `apps/app-api/src/modules/user/user.service.ts` | 手工解包 `rows` | 本地 `extractRows` | 迁移到 helper + 强类型返回 | 半自动 |
| libs/platform | `libs/platform/src/modules/health/health.service.ts` | 业务层 `db.execute` | 健康检查直接执行 SQL | 允许保留（基础设施模块白名单），补充说明“仅探活” | 手动 |
| libs/message | `libs/message/src/outbox/outbox.service.ts` | `tx?` 可选参数 | 需确认调用链一致透传 | 调整为“事务内路径必须显式传 tx”，新增 lint 规则约束 | 手动 |
| libs/growth | `libs/growth/src/point/point.service.ts` | `tx?` 可选参数 | 需确认调用链一致透传 | 同上，补调用点检查与测试 | 手动 |
| libs/growth | `libs/growth/src/level-rule/level-rule.service.ts` | `tx?` 可选参数 | 需确认调用链一致透传 | 同上，补调用点检查与测试 | 手动 |

## 3. 批量修复 PR 拆分方案

### PR-1（高风险安全收口）
- 范围：`interaction-query.helper.ts` 的 `sql.raw` 白名单改造。
- 目标：禁止任何非白名单列名进入 `sql.raw`。
- 验收：新增单测覆盖合法/非法列名；非法输入抛错。

### PR-2（interaction 模块 SQL 下沉）
- 范围：`purchase.service.ts`、`download.service.ts`。
- 目标：业务层移除 `db.execute` 与 `extractRows`，统一改为 query helper。
- 验收：服务层不再出现 `db.execute(`、`extractRows(`。

### PR-3（admin/app 模块 SQL 下沉）
- 范围：`message-monitor.service.ts`、`user.service.ts`。
- 目标：同 PR-2，完成 helper 下沉与强类型返回。
- 验收：业务层不再手工解包 rows；回归接口结果一致。

### PR-4（事务透传一致性）
- 范围：`outbox.service.ts`、`point.service.ts`、`level-rule.service.ts` 及调用点。
- 目标：事务内调用链显式透传 tx，消除事务外窗口。
- 验收：新增用例证明事务回滚可覆盖链路写操作。

### PR-5（规范门禁自动化）
- 范围：lint/CI 检查脚本与文档验收清单。
- 目标：阻止新引入 `db._query`、业务层 `db.execute`、`(result as any).rows`、不安全 `sql.raw`。
- 验收：CI 失败信息可直接定位文件与规则。

## 4. 自动化检查规则（可直接接入 CI）

1. 禁止旧版查询 API  
   - 规则：匹配 `db._query` 即失败。
2. 禁止业务层直连原生 SQL  
   - 规则：`apps/**` 与 `libs/**` 下匹配 `db.execute(` 失败；`libs/platform/src/modules/health/health.service.ts` 白名单。
3. 禁止 rows 手工解包  
   - 规则：匹配 `(result as any).rows`、`extractRows(` 失败。
4. 限制 `sql.raw` 用法  
   - 规则：匹配 `sql.raw(` 后必须来自白名单映射函数；否则失败。
5. 事务透传检查  
   - 规则：对 `tx?:` 方法做调用图审计，事务上下文调用必须显式传 tx。

## 5. 执行顺序建议

1. 先做 PR-1，先收敛注入面。  
2. 再做 PR-2/PR-3，按模块并行下沉 SQL。  
3. 然后做 PR-4，补齐事务一致性。  
4. 最后做 PR-5，固化门禁防回归。

## 6. 执行进度

### PR-1（已完成）
- `db/core/query/interaction-query.helper.ts`：已移除 `sql.raw(column)`，改为白名单键映射（`purchaseRecordCreatedAt`、`downloadRecordCreatedAt`）。
- `libs/interaction/src/purchase/purchase.service.ts`：调用参数已切换为白名单键 `purchaseRecordCreatedAt`。
- `libs/interaction/src/download/download.service.ts`：调用参数已切换为白名单键 `downloadRecordCreatedAt`。
- `libs/interaction/src/interaction-query.helper.spec.ts`：新增单测覆盖合法键与非法键场景。
- 验证结果：`pnpm test -- interaction-query.helper.spec.ts`、`pnpm type-check` 已通过。

### PR-2（已完成）
- 新增 `db/core/query/purchase-query.helper.ts`，将购买列表/章节列表 SQL 下沉至 query helper。
- 新增 `db/core/query/download-query.helper.ts`，将下载列表/章节列表 SQL 下沉至 query helper。
- `libs/interaction/src/purchase/purchase.service.ts`：已移除业务层 `db.execute` 与 `extractRows`。
- `libs/interaction/src/download/download.service.ts`：已移除业务层 `db.execute` 与 `extractRows`。

### PR-3（已完成）
- 新增 `db/core/query/message-monitor-query.helper.ts`，下沉 message monitor 统计 SQL。
- 新增 `db/core/query/user-query.helper.ts`，下沉用户已购/已下载作品统计 SQL。
- `apps/admin-api/src/modules/message/message-monitor.service.ts`：已移除业务层 `db.execute` 与 rows 手工解包。
- `apps/app-api/src/modules/user/user.service.ts`：已移除业务层 `db.execute` 与 rows 手工解包。

### PR-4（已完成）
- `libs/message/src/outbox/outbox.service.ts`：新增 `enqueueEventInTx` / `enqueueNotificationEventInTx`，区分事务内外调用入口。
- `libs/forum/src/topic/resolver/forum-topic-like.resolver.ts`：事务内调用切换为 `enqueueNotificationEventInTx`。
- `libs/forum/src/topic/resolver/forum-topic-favorite.resolver.ts`：事务内调用切换为 `enqueueNotificationEventInTx`。
- `libs/interaction/src/comment/resolver/comment-like.resolver.ts`：事务内调用切换为 `enqueueNotificationEventInTx`。
- `libs/interaction/src/comment/comment.service.ts`：事务内调用切换为 `enqueueNotificationEventInTx`。
- `libs/growth/src/point/point.service.ts`：新增 `consumePointsInTx`，将事务内路径改为显式 tx。
- `libs/growth/src/level-rule/level-rule.service.ts`：新增 `getHighestLevelRuleByExperienceInTx`，将事务内路径改为显式 tx。

### PR-5（已完成）
- 新增 `scripts/drizzle-guard.cjs` 门禁脚本，检查 `db._query`、业务层 `db.execute`、rows 手工解包、`sql.raw` 非白名单入口。
- `package.json` 新增脚本：`pnpm drizzle:guard`。
- 验证结果：`pnpm drizzle:guard`、`pnpm test -- interaction-query.helper.spec.ts`、`pnpm type-check` 已通过。

### PR-6（已完成）
- `apps/admin-api/src/modules/message/message-monitor.service.ts`：将 WS 聚合查询与 outbox 汇总查询改为“ORM 主体 + `sql\`\`` 聚合表达式”写法。
- `apps/app-api/src/modules/user/user.service.ts`：将用户已购/已下载作品统计改为 ORM join + 聚合写法。
- `libs/interaction/src/purchase/purchase.service.ts`、`libs/interaction/src/download/download.service.ts`：查询逻辑收敛为模块内私有查询方法，不再依赖 `db/core/query` 业务 helper。
- 已删除 `db/core/query` 下业务绑定 helper：`message-monitor-query.helper.ts`、`purchase-query.helper.ts`、`download-query.helper.ts`、`user-query.helper.ts`、`interaction-query.helper.ts`。
- 额外排查：`apps/**` 与 `libs/**` 剩余 `db.execute` 仅 `libs/platform/src/modules/health/health.service.ts` 的 `SELECT 1` 探活查询，按白名单保留。
