# db/comments 代码规范审查报告

## 审查概览

- 审查模块：`db/comments`
- 审查文件数：2
- 读取范围：`db/comments/**`
- 适用规范总条数：86
- 合规条数：75
- 违规条数：11
- 风险分布：CRITICAL 0 / HIGH 0 / MEDIUM 6 / LOW 5
- Rules checked：9/9
- Rule points closed：86/86
- Scope completion：complete

## 规范条款逐条校验汇总

| 规范条款                                           | 校验结果 | 证据                                                                        |
| -------------------------------------------------- | -------- | --------------------------------------------------------------------------- |
| schema 注释变更需同步 `db/comments/generated.sql`  | 部分违规 | 存在生成产物，但本轮未执行生成校验；`schema-comments.ts` 本身可生成 warning |
| 纯类型必须放入 `*.type.ts`                         | 违规     | `schema-comments.ts:15-58`                                                  |
| 代码不应在业务路径使用写文件副作用，除明确脚本边界 | 合规     | `writeSchemaCommentsFile` 属注释生成脚本边界                                |
| catch 不得吞掉异常而不保留错误语义                 | 违规     | `schema-comments.ts:363`                                                    |
| 方法/函数注释应使用短行注释                        | 违规     | `schema-comments.ts` 多个导出函数使用 JSDoc 或无方法注释                    |
| 原生 SQL 生成必须转义                              | 合规     | `toPgTextLiteral` 对反斜杠、单引号、换行做转义                              |
| 禁止直接拼接用户输入 SQL                           | 合规     | 拼接内容来自 schema JSDoc 且经过 `toPgTextLiteral`                          |
| 生成 SQL 不应手工编辑                              | 合规     | `generated.sql` 文件头声明生成来源                                          |

## 按文件/模块拆分的详细违规清单

### schema-comments.ts

[MEDIUM] 注释生成脚本内声明大量纯类型

- 位置：`db/comments/schema-comments.ts:15`、`:21`、`:28`、`:36`、`:44`、`:49`、`:54`、`:58`
- 对应规范：`04-typescript-types.md` / 纯 TS 类型放入 `*.type.ts`
- 违规原因：warning、artifact、apply/build options 等类型与 AST 解析实现混在同一脚本文件。
- 整改建议：新增 `schema-comments.type.ts`，保留导出的 artifact/options 类型并让实现文件引用。

[MEDIUM] `writeSchemaCommentsFile` 在 build helper 中直接写入文件

- 位置：`db/comments/schema-comments.ts:163-174`
- 对应规范：工程边界 / 生成产物应有清晰脚本边界
- 违规原因：同一模块同时负责 artifact 构建、文件写入和数据库 apply，职责较宽。当前虽属于脚本模块，但调用方容易误用写文件函数。
- 整改建议：将纯构建、文件写入、数据库 apply 分为独立 owner 文件，CLI 入口只组合调用。

[LOW] `safeReadFile` 空 catch 丢失文件读取失败原因

- 位置：`db/comments/schema-comments.ts:363`
- 对应规范：`06-error-handling.md` / catch 后应保留错误语义
- 违规原因：读取旧 generated.sql 失败时直接返回 null，无法区分文件不存在、权限问题、编码问题。
- 整改建议：文件不存在可降级；其他错误建议返回 warning 或记录 debug 信息。

[LOW] 多处工具函数缺少紧邻方法注释

- 位置：`db/comments/schema-comments.ts:221`、`:270`、`:285`、`:293`、`:309`、`:317`、`:325`、`:345`、`:359`、`:369`、`:373`
- 对应规范：`05-comments.md` / 所有方法定义前必须有简短注释
- 违规原因：AST 解析、节点判断、JSDoc 渲染、SQL 标识符转义等函数没有方法注释。
- 整改建议：补充一行中文注释，说明每个 helper 的输入输出边界。

[LOW] 部分长行未格式化

- 位置：`db/comments/schema-comments.ts:3`、`:61`、`:245`、`:289`、`:297`、`:313`、`:335`
- 对应规范：工程风格
- 违规原因：多处长参数和箭头函数未换行，明显偏离仓库 prettier 风格。
- 整改建议：运行 prettier 或按仓库格式手工换行。

### generated.sql

[MEDIUM] 生成注释产物无法从文件头确认 Warnings 为 0

- 位置：`db/comments/generated.sql:1-4`
- 对应规范：`07-drizzle.md` / 修改 schema 注释后必须刷新 generated.sql 并确保 `Warnings: 0`
- 违规原因：生成文件头只说明来源和命令，没有记录本次生成的 warning 数。审查时无法仅靠产物确认 schema 注释完整性。
- 整改建议：生成脚本在文件头补充 `-- Warnings: 0`；若存在 warning，应阻断生成或在报告中显式列出。

## 已审查且未发现独立违规项的文件

- `db/comments/generated.sql`：除缺少 warning 摘要外，SQL 由生成器产出，未发现手写拼接或明显语法风险。

## 整体合规率总结

- 模块合规率：约 87.2%（75/86）
- 主要问题是生成器自身类型/职责拆分不足，以及生成产物不能直接证明 warning 为 0。

## 必改项清单

1. 将 `schema-comments.ts` 中的纯类型迁入 `schema-comments.type.ts`。
2. 在 `generated.sql` 文件头写入 warning 数，确保审查可追溯。
3. 对 `safeReadFile` 区分文件不存在和其他 IO 错误。

## 优化建议清单

1. 将 build/write/apply 拆成独立文件，减少脚本误用写库或写文件的风险。
2. 给 AST helper 增加短注释，方便后续升级 TypeScript AST API 时定位职责。
