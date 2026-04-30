# db/extensions 代码规范审查报告

## 审查概览

- 审查模块：`db/extensions`
- 审查文件数：7
- 读取范围：`db/extensions/**`
- 适用规范总条数：86
- 合规条数：71
- 违规条数：15
- 风险分布：CRITICAL 0 / HIGH 0 / MEDIUM 8 / LOW 7
- Rules checked：9/9
- Rule points closed：86/86
- Scope completion：complete

## 规范条款逐条校验汇总

| 规范条款                                            | 校验结果 | 证据                                                                                            |
| --------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| 数据库扩展能力优先复用 `db/ext`，避免业务重复造轮子 | 合规     | `counter.ts`、`exists*.ts`、`findPagination.ts`、`maxOrder.ts`、`softDelete.ts`、`swapField.ts` |
| 纯类型必须放入 `*.type.ts`                          | 违规     | `findPagination.ts:11-27`                                                                       |
| 复杂函数签名不得直接写内联对象和深层泛型            | 违规     | `findPagination.ts:13-27`、`:48-57`；`swapField.ts:57-62`                                       |
| 禁止使用 `as never` 绕过 Drizzle 类型               | 违规     | `findPagination.ts:71`、`:111`；`swapField.ts:77-97`、`:130-143`                                |
| helper 可预期失败不应直接绑定 HTTP 异常             | 违规     | `findPagination.ts:74`、`:83`、`:91`、`:98`、`:103`；`softDelete.ts:10`                         |
| 原生 SQL 不得字符串拼接                             | 合规     | 未发现拼接 SQL                                                                                  |
| 事务上下文必须显式                                  | 合规     | `swapField.ts:73` 使用 `db.transaction`                                                         |
| 方法/函数注释不使用 JSDoc                           | 违规     | `swapField.ts:8-50`、`findPagination.ts:32-39`                                                  |
| index 作为 `@db/extensions` 白名单入口              | 合规     | `db/extensions/index.ts`                                                                        |

## 按文件/模块拆分的详细违规清单

### findPagination.ts

[MEDIUM] 分页扩展类型和复杂签名都放在实现文件

- 位置：`db/extensions/findPagination.ts:11`、`:13-27`、`:48-57`
- 对应规范：`04-typescript-types.md` / 纯类型放入 `*.type.ts`；复杂方法签名需命名
- 违规原因：`FindPaginationOptions`、`FindPaginationResultItem` 及返回对象结构都直接写在分页扩展实现文件，泛型层次较深。
- 整改建议：新增 `find-pagination.type.ts`，拆出 `FindPaginationOptions`、`FindPaginationResultItem`、`FindPaginationResult`。

[MEDIUM] 分页扩展使用 `as never` 压过表列和 select 类型

- 位置：`db/extensions/findPagination.ts:71`、`:111`
- 对应规范：`04-typescript-types.md` / 禁止断言绕过类型契约
- 违规原因：`getTableColumns(table as never)`、`db.select(selectedColumns as never)` 表明扩展的列选择类型没有收窄。
- 整改建议：将 `AnyPgTable`、`InferSelectModel` 和 `getTableColumns` 的返回类型封装为命名类型，减少断言。

[MEDIUM] 内部配置错误直接抛 HTTP 500

- 位置：`db/extensions/findPagination.ts:74`、`:83`、`:91`、`:98`、`:103`
- 对应规范：`06-error-handling.md` / DB helper 不应直接绑定 HTTP 异常
- 违规原因：pick/omit 冲突、字段不存在、字段集合为空都抛 `InternalServerErrorException`。这些属于扩展调用契约错误，直接绑定 HTTP 500 不利于脚本/后台任务复用。
- 整改建议：改为普通 `Error` 或 DB extension contract error，并由上层边界转换为 HTTP 响应。

### swapField.ts

[MEDIUM] swapField 选项使用内联对象类型

- 位置：`db/extensions/swapField.ts:57-62`
- 对应规范：`04-typescript-types.md` / 函数签名中复杂对象先命名
- 违规原因：交换条件、字段名、来源字段、共享 where 直接写在参数位置。
- 整改建议：新增 `swap-field.type.ts`，定义 `SwapFieldOptions`、`SwapFieldWherePair`。

[MEDIUM] swapField 大量使用 `as never`

- 位置：`db/extensions/swapField.ts:77`、`:78`、`:90`、`:92`、`:95`、`:97`、`:130`、`:131`、`:136`、`:137`、`:142`、`:143`
- 对应规范：`04-typescript-types.md` / 禁止断言绕过类型契约
- 违规原因：动态字段交换通过反射取列后反复把 where/select/update 强制断言为 `never`，类型系统无法保护目标列和值类型。
- 整改建议：限制可交换字段类型为表列键集合，使用命名泛型约束 `TSortField extends keyof InferSelectModel<TTable>`。

[LOW] 注释仍是长 JSDoc 并包含过期异常描述

- 位置：`db/extensions/swapField.ts:8-50`
- 对应规范：`05-comments.md` / 方法注释用短行注释；注释不得与实现不一致
- 违规原因：`@throws BadRequestException` 与实际代码中的 `InternalServerErrorException`、`BusinessException` 不一致。
- 整改建议：替换为短行注释，说明交换原子性和唯一约束临时值方案。

### softDelete.ts 与 existsActive.ts

[MEDIUM] 软删扩展错误模型混用 HTTP 异常和普通 Error

- 位置：`db/extensions/softDelete.ts:10`、`:25`、`db/extensions/existsActive.ts:28`
- 对应规范：`06-error-handling.md` / helper 错误语义应统一
- 违规原因：同为“表缺少 deletedAt 字段”的调用契约错误，有的使用 `Error`，有的文件导入 `BadRequestException`；错误语义不稳定。
- 整改建议：统一为 DB extension contract error 或普通 `Error`，避免扩展层直接暴露 HTTP 异常。

## 已审查且未发现独立违规项的文件

- `db/extensions/counter.ts`：计数器原子更新扩展未发现独立违规项。
- `db/extensions/exists.ts`：存在性查询扩展未发现独立违规项。
- `db/extensions/maxOrder.ts`：最大排序值查询扩展未发现独立违规项。
- `db/extensions/index.ts`：作为 `@db/extensions` 白名单入口符合导入边界。

## 整体合规率总结

- 模块合规率：约 82.6%（71/86）
- 主要风险集中在动态 Drizzle 扩展的类型断言和错误模型。

## 必改项清单

1. 为 `findPagination` 和 `swapField` 建立 `*.type.ts`，移出复杂泛型类型。
2. 消除 `as never`，至少把表列键、select 字段和 update 值收敛到命名泛型。
3. 统一扩展调用契约错误，不在 DB extension 层直接抛 Nest HTTP 异常。

## 优化建议清单

1. `swapField` 可先限定为数值排序字段场景，减少动态字符串字段带来的临时值风险。
2. `findPagination` 的 pick/omit 校验建议拆成纯函数，便于单元测试覆盖边界。
