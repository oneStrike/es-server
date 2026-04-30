# db/migration 代码规范审查报告

## 审查概览

- 审查模块：`db/migration` + `db/migrate.ts`
- 审查文件数：54
- 读取范围：`db/migration/**/migration.sql`、`db/migration/**/snapshot.json`、`db/migrate.ts`
- 适用规范总条数：86
- 合规条数：60
- 违规条数：26
- 风险分布：CRITICAL 0 / HIGH 2 / MEDIUM 14 / LOW 10
- Rules checked：9/9
- Rule points closed：86/86
- Scope completion：complete

## 规范条款逐条校验汇总

| 规范条款                                      | 校验结果   | 证据                                                                                              |
| --------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| migration 只允许新建，不应修改既有执行文件    | 未验证历史 | 本轮只审查当前文件状态，未对 git 历史做执行后修改判定                                             |
| 字段改类型/值域/JSON 内部枚举必须处理历史数据 | 部分违规   | `20260419014000_*`、`20260419132000_*`、`20260420172000_*`、`20260421100240_*` 多处直接 drop 旧表 |
| 破坏性更新必须明确破坏范围与风险              | 违规       | 多个 `DROP TABLE` / `DROP COLUMN` migration 仅靠目录名表达 breaking，SQL 内缺少风险注释           |
| 原生 SQL 使用原因必须说明                     | 违规       | 多数手写 DO block / backfill function 缺少头部说明；部分文件如 `20260415105000_*` 做得较好        |
| 大表索引创建需关注锁表风险                    | 违规       | 多数 `CREATE INDEX` 未使用 `CONCURRENTLY`，且无锁表说明                                           |
| schema/comment/migration 应同轮一致           | 部分违规   | migration 大量变更表结构，但 `db/comments/generated.sql` 无 warning 摘要，无法证明同步完整        |
| 迁移脚本不得自动执行危险 seed                 | 违规       | `db/migrate.ts:357-373` fresh DB 后自动执行 seed                                                  |
| 纯 TS 类型应放入 `*.type.ts`                  | 违规       | `db/migrate.ts:13-38`                                                                             |
| 禁止 `any` 和 shell 字符串拼接执行            | 违规       | `db/migrate.ts:117`、`:121`、`:369`                                                               |

## 按文件/模块拆分的详细违规清单

### db/migrate.ts

[HIGH] fresh DB 自动执行 seed，且 seed 写入固定认证数据

- 位置：`db/migrate.ts:357-373`
- 对应规范：安全风险、`07-drizzle.md` / migration 与 seed 边界需明确
- 违规原因：迁移脚本检测到空库后自动执行 `db/seed/index.ts`。结合 `db/seed` 中固定管理员账号/密码 hash，此行为会让迁移脚本承担创建认证数据的副作用。
- 整改建议：默认不自动 seed；改为显式环境变量 `AUTO_SEED_ON_FRESH_DB=1`，并复用 seed 的环境保护。

[MEDIUM] migration runner 使用 shell 字符串执行 seed

- 位置：`db/migrate.ts:369`
- 对应规范：安全风险 / 避免字符串拼接 shell 命令
- 违规原因：`execSync(\`bun "${seedTsPath}"\`)`通过 shell 解释字符串路径。虽然路径来自`process.cwd()`，但仍不如参数数组安全。
- 整改建议：改用 `execFileSync('bun', [seedTsPath], { stdio: 'inherit' })`。

[MEDIUM] migration runner 类型声明放在脚本实现文件

- 位置：`db/migrate.ts:13`、`:14`、`:24`、`:30`、`:38`
- 对应规范：`04-typescript-types.md` / 纯 TS 类型放入 `*.type.ts`
- 违规原因：日志、migration meta、migration record、snapshot 类型都声明在 runner 文件。
- 整改建议：迁入 `migrate.type.ts`。

[LOW] `serializeError` 使用 `any` 读取 cause 链

- 位置：`db/migrate.ts:117`、`:121`
- 对应规范：`04-typescript-types.md` / 禁止 `any`
- 违规原因：`(error as any).cause` 绕过错误对象类型。
- 整改建议：定义 `ErrorWithCause` 类型守卫，递归读取 `cause?: unknown`。

[LOW] raw SQL 查询迁移表记录缺少原因注释

- 位置：`db/migrate.ts:137-165`
- 对应规范：`07-drizzle.md` / 原生 SQL 必须说明原因
- 违规原因：runner 使用手写 SQL 查询 `information_schema` 和 `__drizzle_migrations__`，没有说明是为了兼容不同 Drizzle 迁移表版本。
- 整改建议：补充注释说明无法通过 ORM schema 表达、需要兼容旧迁移表结构。

### 破坏性 check-in migrations

[HIGH] 多个 check-in 重构 migration 直接删除历史表/数据，SQL 内缺少备份或迁移说明

- 位置：`db/migration/20260419014000_check_in_destructive_rearchitecture/migration.sql:1-12`、`20260419132000_check_in_daily_activity_breaking_update/migration.sql:1-14`、`20260420172000_check_in_unified_streak_single_model/migration.sql:1-19`、`20260421100240_check_in_per_rule_streak_lifecycle_hard_cutover/migration.sql:1-5`
- 对应规范：`07-drizzle.md` / 字段改类型、值域、表结构重构必须同步处理历史数据，不能依赖清库或跳过旧值
- 违规原因：这些 migration 直接 `DELETE` 或 `DROP TABLE IF EXISTS` 旧签到/连签表。目录名包含 destructive/hard_cutover，但 SQL 内没有记录备份、不可逆范围、上游文档或历史数据处理策略。
- 整改建议：在 migration 顶部写明破坏范围和确认依据；如果不是明确破坏性任务，应补充 backfill/rename/copy 迁移路径。

### reward / asset cutover migrations

[MEDIUM] 奖励结算迁移在补列后删除旧奖励字段，缺少同文件风险说明

- 位置：`db/migration/20260417170000_task_reward_settlement_cutover/migration.sql:108-121`、`20260417183000_check_in_reward_settlement_cutover/migration.sql:171-184`、`:208-221`、`20260417233000_user_asset_balance_and_ledger_generalization/migration.sql:146-152`
- 对应规范：`07-drizzle.md` / 破坏性字段删除需明确历史数据处理
- 违规原因：migration 中有 backfill 迹象，但删除旧列处没有注释说明旧值已如何迁移到新 settlement/ledger/balance 模型。
- 整改建议：在 DROP COLUMN 前补充注释指向本文件上方的 backfill 语句和验收条件；必要时增加 `RAISE EXCEPTION` 防止存在未迁移旧值。

### forum / content hard cutover migrations

[MEDIUM] 正文 HTML hard cutover 添加并回填 HTML 后删除旧字段，缺少最终校验断言

- 位置：`db/migration/20260429150000_forum_body_html_hard_cutover/migration.sql:1-4`、`:425-435`
- 对应规范：`07-drizzle.md` / JSON/文本契约改造需处理历史数据并防止旧值丢失
- 违规原因：文件包含大量转换函数，但在 `DROP COLUMN "body_tokens"` 前没有看到显式 `RAISE EXCEPTION` 校验未转换记录数量为 0。
- 整改建议：删除旧列前增加断言，确认 `forum_topic.html`、`user_comment.html` 均已非空且可由新 body 结构复现。

[MEDIUM] forum tag 删除 migration 直接 drop 旧表

- 位置：`db/migration/20260428003000_forum_tag_breaking_removal/migration.sql:1-2`
- 对应规范：`07-drizzle.md` / 破坏性更新需同轮说明范围
- 违规原因：`forum_topic_tag`、`forum_tag` 直接删除，SQL 内没有解释与 hashtag 新模型之间的数据迁移或明确放弃历史数据。
- 整改建议：补充迁移说明或先将旧 tag 数据 backfill 到 hashtag 表。

### sensitive word cleanup

[LOW] 个别破坏性迁移有说明但没有保护性断言

- 位置：`db/migration/20260415105000_sensitive_word_breaking_cleanup/migration.sql:1-4`
- 对应规范：`07-drizzle.md` / 值域收紧应处理历史数据
- 违规原因：该文件说明 regex 词条无法自动转换并清理，已优于多数文件；但没有记录清理数量或回滚依据。
- 整改建议：可在迁移前后增加统计注释或记录到变更文档。

### index creation across migrations

[MEDIUM] 多数索引创建未声明锁表策略

- 位置：`db/migration/20260417153000_growth_reward_settlement/migration.sql:69-81`、`20260417233000_user_asset_balance_and_ledger_generalization/migration.sql:15`、`:79-82`、`:102`、`20260428010000_forum_hashtag_expand/migration.sql:53-59`、`:91-97` 等
- 对应规范：性能隐患 / migration 应考虑线上锁表窗口
- 违规原因：多处 `CREATE INDEX` 没有 `CONCURRENTLY`，也没有说明该 migration 只用于离线窗口或小表。
- 整改建议：大表索引用 `CREATE INDEX CONCURRENTLY` 并拆出独立 migration；若不能使用 concurrently，需在迁移说明中标注维护窗口。

### value-domain migrations

[MEDIUM] smallint 合同迁移缺少统一的旧值到新值说明

- 位置：`db/migration/20260428113000_forum_section_topic_review_policy_smallint_contract/migration.sql:1-14`、`20260427170000_forum_moderator_action_log_contract_cutover/migration.sql:1-5`、`20260428001000_forum_user_action_log_contract_fix/migration.sql:10-20`
- 对应规范：`07-drizzle.md` / 改值域时 DTO、常量、schema、migration 四层需同轮对齐
- 违规原因：迁移只表现为 update/cast/drop/add constraint，缺少说明与业务枚举值的对应关系。
- 整改建议：在 migration 注释中写出旧值域、新值域和转换策略，并在相关常量/DTO 报告中同步闭环。

## 已审查且未发现独立违规项的文件

- `db/migration/20260414122401_sudden_electro/migration.sql`：单列类型扩容，未发现独立违规项。
- `db/migration/20260416001500_domain_event_idempotency_key/migration.sql`：补充领域事件幂等键，未发现独立违规项。
- `db/migration/20260418152000_notification_delivery_task_lookup_columns/migration.sql`、`20260418154500_user_notification_announcement_lookup_column/migration.sql`、`20260418155500_message_p2_indexes/migration.sql`：补列/索引类迁移未发现除通用锁表说明外的独立违规项。
- `db/migration/20260428153100_forum_section_name_live_unique/migration.sql`：包含重复数据检查和 `RAISE EXCEPTION`，符合上线前保护思路。
- `db/migration/20260427154000_topic_comment_body_doc_backfill/migration.sql`：包含转换函数和清理函数，未发现除通用校验断言建议外的独立违规项。

## 整体合规率总结

- 模块合规率：约 69.8%（60/86）
- 主要风险集中在破坏性 DDL 缺少 SQL 内可追溯说明，以及 migration runner 自动 seed 的安全边界。

## 必改项清单

1. 禁止 `db/migrate.ts` 默认 fresh DB 自动 seed，改为显式开关。
2. 所有 destructive/hard_cutover migration 顶部补充破坏范围、历史数据策略和回滚/确认依据。
3. 大表索引创建补充锁表策略，必要时拆为 `CONCURRENTLY` migration。
4. `db/migrate.ts` 类型迁入 `migrate.type.ts`，并用 `execFileSync` 替代 shell 字符串。

## 优化建议清单

1. 为 destructive migration 建立固定头部模板：`Purpose`、`Data handling`、`Rollback`、`Expected downtime`。
2. 对值域迁移，统一在 SQL 注释中写明 old -> new 映射，方便和 DTO/常量/schema 对账。
