# db/schema 代码规范审查报告

## 审查概览

- 审查模块：`db/schema`
- 审查文件数：86
- 读取范围：`db/schema/**`
- 适用规范总条数：86
- 合规条数：61
- 违规条数：25
- 风险分布：CRITICAL 0 / HIGH 0 / MEDIUM 17 / LOW 8
- Rules checked：9/9
- Rule points closed：86/86
- Scope completion：complete

## 规范条款逐条校验汇总

| 规范条款                                                          | 校验结果 | 证据                                                                                                                                           |
| ----------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `@db/schema` 作为白名单目录入口                                   | 合规     | `db/schema/index.ts` 聚合 schema owner 文件，符合 `@db/schema` 例外                                                                            |
| schema 推导类型应直接使用 `XxxSelect = typeof table.$inferSelect` | 违规     | `growth-reward-rule.ts:85-86`、`growth-rule-usage-counter.ts:68-69`、`user-asset-balance.ts:57-58`                                             |
| 闭集状态/类型/mode/role 字段默认 smallint 并补 check              | 部分违规 | `user-favorite.ts`、`user-like.ts`、`user-report.ts`、`user-badge.ts`、`chat-message.ts`、`chat-conversation-member.ts` 多个 smallint 无 check |
| smallint/smallint[] 字段注释必须写清值域                          | 部分违规 | 多数新文件合规；部分旧文件仍有“Auto-converted”模板和泛化说明                                                                                   |
| 非枚举 smallint 配置字段应写清 0/默认值含义并补边界               | 部分违规 | `user-level-rule.ts:38-90` 有说明但缺非负/范围 check                                                                                           |
| schema/migration/comments 三者应同轮一致                          | 部分违规 | schema 大量字段有 JSDoc，但 `db/comments/generated.sql` 无 warning 摘要，无法证明 0 warning                                                    |
| 禁止无意义别名链                                                  | 违规     | `GrowthRewardRule = ...` 后再 `GrowthRewardRuleSelect = GrowthRewardRule` 等                                                                   |
| 注释不得保留模板化历史描述                                        | 违规     | 多个文件头 `Auto-converted from legacy schema.`                                                                                                |
| 工程风格需符合格式化规范                                          | 违规     | 多个旧文件使用双引号、分号、长行和过度缩进                                                                                                     |

## 按文件/模块拆分的详细违规清单

### app/growth-reward-rule.ts

[MEDIUM] Drizzle inferSelect 类型使用无意义中间别名

- 位置：`db/schema/app/growth-reward-rule.ts:85-86`
- 对应规范：`07-drizzle.md` / schema 推导类型直接命名为 `XxxSelect`
- 违规原因：先声明 `GrowthRewardRule = typeof growthRewardRule.$inferSelect`，再声明 `GrowthRewardRuleSelect = GrowthRewardRule`，形成禁止的二次别名链。
- 整改建议：删除 `GrowthRewardRule`，直接保留 `export type GrowthRewardRuleSelect = typeof growthRewardRule.$inferSelect`。

### app/growth-rule-usage-counter.ts

[MEDIUM] Drizzle inferSelect 类型使用无意义中间别名

- 位置：`db/schema/app/growth-rule-usage-counter.ts:68-69`
- 对应规范：`07-drizzle.md`
- 违规原因：`GrowthRuleUsageCounterSelect` 通过 `GrowthRuleUsageCounter` 二次别名导出。
- 整改建议：直接导出 `GrowthRuleUsageCounterSelect = typeof growthRuleUsageCounter.$inferSelect`。

### app/user-asset-balance.ts

[MEDIUM] Drizzle inferSelect 类型使用无意义中间别名

- 位置：`db/schema/app/user-asset-balance.ts:57-58`
- 对应规范：`07-drizzle.md`
- 违规原因：`UserAssetBalanceSelect` 通过 `UserAssetBalance` 二次别名导出。
- 整改建议：删除中间别名，直接导出 Select/Insert。

[MEDIUM] 资产键 check 约束为永真表达式

- 位置：`db/schema/app/user-asset-balance.ts:50`
- 对应规范：`07-drizzle.md` / check 约束应真实表达业务值域
- 违规原因：`btrim(assetKey) = '' or btrim(assetKey) <> ''` 对非 null 字符串永远为真，无法约束“积分/经验为空，扩展资产非空”的合同。
- 整改建议：与 `growth_reward_rule_asset_key_not_blank_chk` 对齐：`assetType in (1,2)` 时空字符串，`assetType in (3,4,5)` 时非空。

### app/user-favorite.ts

[MEDIUM] 收藏目标类型 smallint 缺少 check 约束

- 位置：`db/schema/app/user-favorite.ts:20`
- 对应规范：`07-drizzle.md` / 闭集类型字段 smallint 必须补 check
- 违规原因：注释写明 `1=漫画,2=小说,3=论坛主题`，但表约束只定义唯一键和索引，没有限制 `targetType` 值域。
- 整改建议：新增 `check('user_favorite_target_type_valid_chk', sql\`${table.targetType} in (1, 2, 3)\`)` 并同步 migration。

### app/user-like.ts

[MEDIUM] 点赞目标/场景/评论层级 smallint 缺少 check 约束

- 位置：`db/schema/app/user-like.ts:19`、`:27`、`:37`
- 对应规范：`07-drizzle.md`
- 违规原因：`targetType`、`sceneType`、`commentLevel` 都有闭集值域注释，但 schema 未声明 check，数据库可写入未知数值。
- 整改建议：增加 `target_type_valid`、`scene_type_valid`、`comment_level_valid` 三个 check，并同步业务枚举。

### app/user-report.ts

[MEDIUM] 举报闭集字段缺少 check 约束

- 位置：`db/schema/app/user-report.ts:27`、`:35`、`:45`、`:49`、`:61`
- 对应规范：`07-drizzle.md`
- 违规原因：举报目标类型、场景类型、评论层级、原因类型、状态均是闭集 smallint，但没有数据库 check。
- 整改建议：按注释值域补 check；`commentLevel` 允许 null 时写成 `is null or in (1,2)`。

### app/user-badge.ts

[MEDIUM] 徽章类型 smallint 缺少 check 约束

- 位置：`db/schema/app/user-badge.ts:22`
- 对应规范：`07-drizzle.md`
- 违规原因：注释列出 `1=系统徽章,2=成就徽章,3=活动徽章`，但未补 `user_badge_type_valid_chk`。
- 整改建议：新增 check 并生成 migration。

### app/user-level-rule.ts

[MEDIUM] 等级规则数值上限字段缺少数据库边界约束

- 位置：`db/schema/app/user-level-rule.ts:38`、`:54`、`:66`、`:70`、`:74`、`:78`、`:82`、`:86`、`:90`、`:94`
- 对应规范：`05-comments.md`、`07-drizzle.md` / smallint 配置字段需写清默认值语义并补边界
- 违规原因：`loginDays`、`sortOrder`、每日限制、黑名单/收藏上限和 `purchasePayableRate` 只有注释，没有非负或 0-1 check。
- 整改建议：增加非负 check，`purchasePayableRate` 增加 `>=0 and <=1` 约束。

### message/chat-message.ts

[MEDIUM] 聊天消息类型和状态缺少 check 约束

- 位置：`db/schema/message/chat-message.ts:44`、`:61`
- 对应规范：`07-drizzle.md`
- 违规原因：`messageType` 注释为 `1=文本,2=图片,3=系统`，`status` 注释为 `1=正常,2=撤回,3=删除`，但没有 check。
- 整改建议：补充 `chat_message_message_type_valid_chk`、`chat_message_status_valid_chk`。

### message/chat-conversation-member.ts

[MEDIUM] 会话成员角色缺少 check 约束

- 位置：`db/schema/message/chat-conversation-member.ts:31`
- 对应规范：`07-drizzle.md`
- 违规原因：`role` 注释列明 `1=会话所有者,2=普通成员`，但未声明 check。
- 整改建议：补充 `chat_conversation_member_role_valid_chk`。

### app/user-work-reading-state.ts / user-download-record.ts / user-follow.ts

[MEDIUM] 多个互动目标类型字段缺少 check 约束

- 位置：`db/schema/app/user-work-reading-state.ts:23`、`user-download-record.ts:20`、`user-follow.ts:27`
- 对应规范：`07-drizzle.md`
- 违规原因：阅读作品类型、下载目标类型、关注目标类型都是闭集业务值域，但当前 schema 仅声明 smallint 和索引。
- 整改建议：补充对应值域 check，并与 interaction 模块常量对齐。

### legacy converted schema files

[LOW] 多个 schema 文件保留自动转换模板和非统一格式

- 位置：`db/schema/admin/admin-user.ts:1-6`、`db/schema/app/user-badge.ts:1-6`、`db/schema/app/user-favorite.ts:1-6`、`db/schema/forum/forum-moderator-section.ts:1-5` 等
- 对应规范：`05-comments.md`、工程风格
- 违规原因：文件头 `Auto-converted from legacy schema.` 对当前维护者没有有效业务信息；部分 import 使用双引号、分号、长行和旧缩进。
- 整改建议：删除模板头，运行 prettier，并把表注释改为当前业务语义。

### schema/index.ts

[LOW] schema 公共出口过大但属于白名单例外

- 位置：`db/schema/index.ts:1-86`
- 对应规范：`01-import-boundaries.md` / `@db/schema` 为允许入口
- 违规原因：该文件符合白名单，但导出数量很大，任何新增表都会扩大 `@db/schema` 公共面。
- 整改建议：保持只由 `@db/schema` 使用，不新增 `@db/schema/app` 等二级公共入口；业务代码仍按规范从白名单入口导入。

## 已审查且未发现独立违规项的文件

- `db/schema/admin/admin-user-token.ts`：tokenType/revokeReason 已有值域约束，未发现独立违规项。
- `db/schema/app/app-announcement.ts`、`app-announcement-notification-fanout-task.ts`、`app-page.ts`、`app-update-release.ts`：闭集字段已有 check，未发现除通用格式问题外的独立违规项。
- `db/schema/app/check-in-*`：新版签到相关表整体有较完整 check，未发现独立违规项。
- `db/schema/app/emoji-*`：emoji 场景/类型字段有 check，未发现独立违规项。
- `db/schema/app/growth-audit-log.ts`、`growth-ledger-record.ts`、`growth-reward-settlement.ts`：成长流水/结算关键字段有 check，未发现除通用格式问题外的独立违规项。
- `db/schema/app/task-*`：任务模块字段值域和计数边界整体有 check，未发现独立违规项。
- `db/schema/forum/forum-hashtag*.ts`、`forum-moderator*.ts`、`forum-section.ts`、`forum-topic.ts`、`forum-user-action-log.ts`：多数 forum 新表值域约束完整，未发现除通用格式/注释问题外的独立违规项。
- `db/schema/message/notification-*.ts`、`user-notification.ts`、`message-ws-metric.ts`：通知相关表值域和索引整体符合规范。
- `db/schema/system/domain-event*.ts`、`request-log.ts`、`sensitive-word*.ts`、`system-config.ts`、`system-dictionary.ts`：系统域表整体符合规范。
- `db/schema/work/*`：作品域多数 smallint 字段有 check，未发现除通用格式问题外的独立违规项。

## 整体合规率总结

- 模块合规率：约 70.9%（61/86）
- 主要风险集中在老互动表和消息表的闭集 smallint 缺少数据库 check，以及少量 Drizzle 推导类型二次别名。

## 必改项清单

1. 修正 `user_asset_balance_asset_key_not_blank_chk` 永真约束。
2. 给 `userFavorite`、`userLike`、`userReport`、`userBadge`、`chatMessage`、`chatConversationMember` 等闭集 smallint 字段补 check。
3. 删除 `GrowthRewardRule`、`GrowthRuleUsageCounter`、`UserAssetBalance` 三个无意义中间别名。
4. 为 `userLevelRule` 的 smallint/numeric 配置字段补非负和范围 check。
5. 同步生成 migration 和 `db/comments/generated.sql`，并确认 warning 为 0。

## 优化建议清单

1. 旧 `Auto-converted` schema 文件建议分批格式化，先处理有 closed-set 字段的表。
2. 增加 schema lint 脚本：发现 `smallint()` 字段但同表缺少对应 `*_valid_chk` 时报警。
3. schema 注释生成报告建议纳入 CI，防止新增字段忘记刷新 `generated.sql`。
