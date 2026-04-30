# db/core 代码规范审查报告

## 审查概览

- 审查模块：`db/core`
- 审查文件数：12
- 读取范围：`db/core/**`
- 适用规范总条数：86
- 合规条数：70
- 违规条数：16
- 风险分布：CRITICAL 0 / HIGH 0 / MEDIUM 9 / LOW 7
- Rules checked：9/9
- Rule points closed：86/86
- Scope completion：complete

## 规范条款逐条校验汇总

| 规范条款                                                       | 校验结果 | 证据                                                                                                                                                                    |
| -------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db` 公共入口只允许 `@db/core`、`@db/extensions`、`@db/schema` | 合规     | `db/core/index.ts` 作为 `@db/core` owner 出口，未发现跨模块业务依赖                                                                                                     |
| 纯 TS 类型应集中在 `*.type.ts`                                 | 违规     | `query/order-by.ts:11-17`、`query/page-query.ts:1-9`、`query/like-pattern.ts:15`、`error/postgres-error.ts:29-60`、`error/error-handler.ts:17`、`drizzle.service.ts:36` |
| Service/helper 可预期失败统一错误模型                          | 违规     | `query/order-by.ts:57`、`:69`、`:89`、`:94`、`:99`、`:105`、`:108`、`:113`；`error/error-handler.ts:91`                                                                 |
| 禁止用 `as never` 压过 Drizzle 类型契约                        | 违规     | `query/order-by.ts:199`                                                                                                                                                 |
| 成功/业务失败应使用项目业务码，不把业务失败伪装成 HTTP         | 部分违规 | DB unique/serialization 映射符合业务码；not-null/check 仍抛 `BadRequestException`                                                                                       |
| 方法/函数注释应使用短行注释，避免 JSDoc 方法注释               | 违规     | `drizzle.service.ts:45-203`、`query/order-by.ts:20-215`、`query/page-query.ts:10-40`                                                                                    |
| 原生 SQL 不得字符串拼接                                        | 合规     | `db/core` 未发现拼接 SQL                                                                                                                                                |
| 分页应 1-based 且排序显式                                      | 合规     | `query/page-query.ts:31-40`、`query/order-by.ts:207-218`                                                                                                                |
| 测试规范本模块不适用                                           | 不适用   | `db/core` 无 `*.spec.ts`                                                                                                                                                |

## 按文件/模块拆分的详细违规清单

### query/order-by.ts

[MEDIUM] orderBy helper 直接抛 HTTP 400

- 位置：`db/core/query/order-by.ts:57`、`:69`、`:89`、`:94`、`:99`、`:105`、`:108`、`:113`
- 对应规范：`06-error-handling.md` / service/helper 可预期失败不应绑定 HTTP 协议
- 违规原因：排序 JSON 格式非法、字段不存在、方向非法属于查询契约错误，但 `db/core` 是数据库共享层，直接抛 `BadRequestException` 会让非 HTTP 调用方继承协议异常。
- 整改建议：返回解析失败结果或抛平台查询参数错误类型，再由 Controller/ValidationPipe/filter 映射为 400。

[MEDIUM] orderBy 类型定义散落在 query helper 文件

- 位置：`db/core/query/order-by.ts:11`、`:16`
- 对应规范：`04-typescript-types.md` / 纯 TS 类型放入 `*.type.ts`
- 违规原因：`DrizzleOrderByOptions`、`DrizzleOrderByInput` 等稳定查询类型直接声明在 helper 实现文件。
- 整改建议：迁入 `query/order-by.type.ts`，helper 实现文件只导入类型。

[LOW] Drizzle 列排序使用 `as never`

- 位置：`db/core/query/order-by.ts:199`
- 对应规范：`04-typescript-types.md` / 禁止断言绕过类型契约
- 违规原因：`asc(column as never)`、`desc(column as never)` 说明 `validColumns` 的列类型没有被收窄到 Drizzle 可排序列。
- 整改建议：定义 `SortableColumnMap` 类型或从 `getColumns(table)` 推导列值类型，避免 `never` 断言。

### query/page-query.ts

[MEDIUM] 分页查询类型声明在 helper 实现文件

- 位置：`db/core/query/page-query.ts:1`、`:6`
- 对应规范：`04-typescript-types.md` / 纯 TS 类型放入 `*.type.ts`
- 违规原因：`DrizzlePageQueryInput`、`DrizzlePageQueryOptions` 是共享分页契约，直接写在实现文件。
- 整改建议：迁入 `query/page-query.type.ts` 并由 `DrizzleService`、扩展方法复用。

[LOW] 方法注释仍以 JSDoc 为主

- 位置：`db/core/query/page-query.ts:10`、`:30`
- 对应规范：`05-comments.md` / 方法注释使用紧邻行注释，不使用 JSDoc
- 违规原因：`normalizePageIndex` 和 `buildDrizzlePageQuery` 使用 JSDoc 作为函数说明。
- 整改建议：替换为一到两行中文行注释。

### error/postgres-error.ts

[MEDIUM] PostgreSQL 错误结构类型声明在错误实现文件

- 位置：`db/core/error/postgres-error.ts:29`、`:38`、`:47`、`:51`、`:56`、`:60`
- 对应规范：`04-typescript-types.md` / 纯 TS 类型放入 `*.type.ts`
- 违规原因：错误元信息、descriptor、source 类型都是稳定共享类型，当前和错误码/解析实现混在同一文件。
- 整改建议：迁入 `postgres-error.type.ts`，错误实现只保留常量和函数。

[LOW] 常量字段注释不完整

- 位置：`db/core/error/postgres-error.ts:18-25`
- 对应规范：`05-comments.md` / 导出常量对象字段应有字段级业务注释
- 违规原因：`PostgresDefaultMessages` 只通过 key 间接表达语义，字段本身没有紧邻注释。
- 整改建议：为每个错误码默认文案补充说明，或改为带注释的显式对象字段。

### error/error-handler.ts

[MEDIUM] CHECK/NOT NULL 约束错误仍直接映射 HTTP 400

- 位置：`db/core/error/error-handler.ts:85-92`
- 对应规范：`06-error-handling.md` / 数据库错误映射应统一保留 cause 并区分业务码/平台码
- 违规原因：DB 约束暴露的输入错误当前抛 `BadRequestException`。这符合平台 400 的最终响应，但在 db/core 层直接绑定 Nest HTTP 异常，复用边界偏窄。
- 整改建议：抽出平台层 `PlatformException` 或数据库错误 descriptor，让全局 filter 统一映射 HTTP 400；至少保持 cause 和结构化 code。

[LOW] 文件存在格式漂移

- 位置：`db/core/error/error-handler.ts:2`、`:12-14`
- 对应规范：工程风格
- 违规原因：`import type {PostgresErrorSource}` 缺空格且保留分号，`PostgresErrorCode` import 中存在多余空行。
- 整改建议：运行 prettier 或手工统一格式。

### drizzle.service.ts

[MEDIUM] Drizzle service 文件内声明纯类型

- 位置：`db/core/drizzle.service.ts:36`
- 对应规范：`04-typescript-types.md` / service 文件禁止顶层纯类型
- 违规原因：`DrizzleErrorInput` 只是 `PostgresErrorSource` 别名，声明在 service 主文件且语义增量有限。
- 整改建议：直接使用 `PostgresErrorSource`，或迁入 `drizzle.type.ts` 并赋予明确边界语义。

[LOW] service 方法注释使用 JSDoc

- 位置：`db/core/drizzle.service.ts:45-203`
- 对应规范：`05-comments.md` / 方法注释统一使用行注释
- 违规原因：`onApplicationShutdown`、`schema`、`buildPage`、`withTransaction` 等方法均使用 JSDoc。
- 整改建议：保留关键事务、错误翻译语义，改为紧邻方法的短行注释。

### query/like-pattern.ts

[MEDIUM] LIKE pattern 选项类型声明在 helper 文件

- 位置：`db/core/query/like-pattern.ts:15`
- 对应规范：`04-typescript-types.md` / 纯 TS 类型放入 `*.type.ts`
- 违规原因：`LikePatternOptions` 是可复用查询 helper 选项类型，直接写在实现文件。
- 整改建议：迁入 `like-pattern.type.ts`。

## 已审查且未发现独立违规项的文件

- `db/core/drizzle.provider.ts`：连接池 provider 结构清晰，`DATABASE_URL` 缺失抛启动错误，未发现独立违规项。
- `db/core/drizzle.module.ts`：模块注册未发现违规项。
- `db/core/drizzle.extensions.ts`：扩展聚合未发现违规项。
- `db/core/drizzle.type.ts`：类型文件命名和职责符合规范。
- `db/core/query/raw-result.helper.ts`：原始查询结果解析未发现独立违规项。
- `db/core/index.ts`：作为 `@db/core` 白名单入口符合项目导入边界。

## 整体合规率总结

- 模块合规率：约 81.4%（70/86）
- 主要风险集中在共享查询 helper 的 HTTP 异常绑定和类型放置不符合最新规范。

## 必改项清单

1. 将 `query/order-by.ts`、`query/page-query.ts`、`error/postgres-error.ts` 中的共享类型迁入 `*.type.ts`。
2. 抽离 `orderBy`、DB constraint 错误的协议异常绑定，避免 db/core 直接依赖 HTTP 400。
3. 移除 `order-by.ts:199` 的 `as never`，用 Drizzle 列类型收窄替代。
4. 清理 `error-handler.ts` 格式漂移。

## 优化建议清单

1. `db/core` 是全仓数据库能力入口，建议优先完成类型文件迁移，减少业务模块后续跟随整改成本。
2. 错误映射可以统一返回 descriptor，再由 `libs/platform` filter 决定 HTTP 状态和响应 code。
