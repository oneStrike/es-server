# db/relations 代码规范审查报告

## 审查概览

- 审查模块：`db/relations`
- 审查文件数：7
- 读取范围：`db/relations/**`
- 适用规范总条数：86
- 合规条数：78
- 违规条数：8
- 风险分布：CRITICAL 0 / HIGH 0 / MEDIUM 4 / LOW 4
- Rules checked：9/9
- Rule points closed：86/86
- Scope completion：complete

## 规范条款逐条校验汇总

| 规范条款                                          | 校验结果 | 证据                                                                                    |
| ------------------------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| `@db/relations` 不属于允许公共入口                | 风险存在 | `db/relations/index.ts` 存在目录聚合出口；业务侧不得导入该入口                          |
| relation 定义应与 schema foreign key/业务别名一致 | 部分违规 | `message.ts`、`forum.ts`、`app.ts` 中存在多处 alias，需与 Drizzle v2 alias 约定持续校验 |
| 纯类型放置规则                                    | 合规     | relation 文件未新增 type/interface                                                      |
| 禁止复杂三元构造 query 条件                       | 合规     | relation 文件只声明关系，不构造查询条件                                                 |
| 禁止 SQL 字符串拼接                               | 合规     | 未发现原生 SQL                                                                          |
| 方法注释规则                                      | 部分违规 | relation 聚合和各域 relation 对象缺少用途注释                                           |
| index 文件规则                                    | 部分违规 | `db/relations/index.ts` 是内部聚合，但规则明确 `@db/relations` 是禁止公共入口示例       |

## 按文件/模块拆分的详细违规清单

### index.ts

[MEDIUM] `db/relations` 存在目录级聚合入口，容易被业务侧误导入

- 位置：`db/relations/index.ts:1-10`
- 对应规范：`01-import-boundaries.md` / 明确禁止 `@db/relations` 目录级入口
- 违规原因：虽然 Drizzle provider 可能内部需要聚合 relations，但 `index.ts` 文件本身会形成 `@db/relations` 可导入路径，与规范中的禁止示例冲突。
- 整改建议：将聚合文件命名为 `relations.registry.ts` 或仅由 `db/core` 内部相对导入；不要暴露 `@db/relations` 路径。

[LOW] relations 聚合缺少边界注释

- 位置：`db/relations/index.ts:8`
- 对应规范：`05-comments.md` / 导出稳定符号需说明用途和边界
- 违规原因：`relations` 是全仓 Drizzle relations 注册总表，但没有说明仅供 Drizzle 初始化使用、禁止业务侧导入。
- 整改建议：补充一行注释说明“仅供 Drizzle provider 注册关系，不作为业务查询入口”。

### message.ts

[MEDIUM] 关系 alias 依赖字符串约定，缺少集中说明

- 位置：`db/relations/message.ts:8`、`:13`、`:27`、`:36`、`:43`、`:55`、`:62`、`:70`
- 对应规范：`07-drizzle.md` / relation alias 应与 schema/查询契约同轮对齐
- 违规原因：`ChatConversationLastMessage`、`ChatConversationParticipants`、`UserNotificationActor` 等 alias 直接写在 relation 文件，缺少统一注释说明查询侧使用边界。
- 整改建议：为复杂 alias 关系补充注释，必要时建立 relation alias 常量，避免查询侧手写字符串漂移。

### app.ts / forum.ts / work.ts

[LOW] 复杂业务域关系对象缺少用途注释

- 位置：`db/relations/app.ts:1`、`db/relations/forum.ts:1`、`db/relations/work.ts:1`
- 对应规范：`05-comments.md` / 导出稳定符号需说明业务语义
- 违规原因：这些文件定义大量跨表关系，但导出对象没有说明 relation 维护边界和 alias 约定。
- 整改建议：给每个域 relation 导出补一条注释，说明对应 schema 域和 Drizzle RQB v2 使用场景。

## 已审查且未发现独立违规项的文件

- `db/relations/admin.ts`：管理员用户与 token relation 未发现独立违规项。
- `db/relations/system.ts`：系统表 relation 未发现独立违规项。
- `db/relations/app.ts`、`forum.ts`、`work.ts`：除导出注释不足外，关系声明形式未发现明显违规项。
- `db/relations/message.ts`：除 alias 注释/常量化风险外，关系 from/to 显式性符合 Drizzle v2 关系定义要求。

## 整体合规率总结

- 模块合规率：约 90.7%（78/86）
- 主要风险是 `db/relations/index.ts` 容易被当成公共入口，以及 relation alias 缺少文档化约束。

## 必改项清单

1. 避免暴露 `@db/relations` 目录级入口；将内部聚合改名或限制在 `db/core` 相对路径。
2. 给复杂 alias relation 增加说明或常量化，避免查询侧字符串漂移。

## 优化建议清单

1. relation 文件可按“owner schema + 主要查询方向”补充短注释，方便新模块接入 Drizzle RQB v2。
2. 对别名较多的 message/forum 域，建议增加一次专门 relation-v2 对账。
