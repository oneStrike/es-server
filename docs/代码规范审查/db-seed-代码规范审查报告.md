# db/seed 代码规范审查报告

## 审查概览

- 审查模块：`db/seed`
- 审查文件数：13
- 读取范围：`db/seed/**`
- 适用规范总条数：86
- 合规条数：66
- 违规条数：20
- 风险分布：CRITICAL 0 / HIGH 1 / MEDIUM 10 / LOW 9
- Rules checked：9/9
- Rule points closed：86/86
- Scope completion：complete

## 规范条款逐条校验汇总

| 规范条款                                             | 校验结果 | 证据                                                                                |
| ---------------------------------------------------- | -------- | ----------------------------------------------------------------------------------- |
| seed 脚本可作为数据库脚本边界直接创建 Drizzle client | 合规     | `db-client.ts:29-39`                                                                |
| 不得在可误运行脚本中写入默认管理员凭据               | 违规     | `shared.ts:1-4`、`modules/admin/domain.ts:10-25`                                    |
| 纯类型必须放入 `*.type.ts`                           | 违规     | `db-client.ts:8-20`                                                                 |
| 复杂函数签名不得直接写内联对象                       | 违规     | `db-client.ts:12-18`、`:47-64`                                                      |
| seed 日志可输出进度，但不应泄露敏感数据              | 部分违规 | 大量 `console.log` 输出进度可接受；管理员用户名、手机号、请求日志 seed 数据需要注意 |
| 原生 SQL 必须说明原因                                | 违规     | `index.ts:22-52` 使用 DO block 重置序列但无原因注释                                 |
| 不得硬编码生产可用 token/固定 jti                    | 违规     | `modules/admin/domain.ts:24`、`modules/app/domain.ts:606-658`                       |
| 方法注释要求                                         | 违规     | 多个 seed 函数无紧邻职责注释                                                        |
| 临时脚本不得伪装成正式测试                           | 合规     | seed 文件均位于正式 seed 目录                                                       |

## 按文件/模块拆分的详细违规清单

### shared.ts 与 modules/admin/domain.ts

[HIGH] Seed 会写入固定管理员账号、固定密码 hash 和固定 token jti，缺少环境保护

- 位置：`db/seed/shared.ts:1-4`、`db/seed/modules/admin/domain.ts:10-25`、`:43-73`
- 对应规范：安全风险、工程风格 / 禁止让脚本误操作生产敏感数据
- 违规原因：seed 脚本会用固定 `admin`、固定 `SEED_PASSWORD_HASH` 和固定 `seed-admin-access-token` upsert 管理员和 token 记录；`db/seed/index.ts` 只依赖 `DATABASE_URL`，没有阻止生产环境执行。若误连生产库，可能重置管理员密码/令牌元数据。
- 整改建议：增加环境白名单，例如只允许 `NODE_ENV=development|test|provision` 且需要显式 `ALLOW_SEED_RESET=1`；管理员密码 hash 和 seed token jti 改为从本地安全配置读取或每次生成。

[LOW] 管理员 seed 日志输出用户名

- 位置：`db/seed/modules/admin/domain.ts:45`、`:52`
- 对应规范：安全日志 / 避免输出敏感标识
- 违规原因：虽然是 seed 脚本，仍会在日志中输出管理员用户名。
- 整改建议：进度日志只输出“管理员创建/更新完成”，不打印账号标识。

### db-client.ts

[MEDIUM] seed DB 客户端类型声明在实现文件

- 位置：`db/seed/db-client.ts:8`
- 对应规范：`04-typescript-types.md` / 纯 TS 类型放入 `*.type.ts`
- 违规原因：`Db` 是 seed 运行时适配 Drizzle RQB 的核心类型，却直接声明在 client 实现文件。
- 整改建议：迁入 `seed-db.type.ts`。

[MEDIUM] query proxy 类型直接写复杂内联对象

- 位置：`db/seed/db-client.ts:12-18`、`:47-64`
- 对应规范：`04-typescript-types.md` / 复杂签名先命名
- 违规原因：`findFirst`、`findMany` 的 config 类型在类型声明和实现处重复写内联对象/函数类型。
- 整改建议：定义 `SeedQueryWhereFactory`、`SeedQueryConfig`、`SeedQueryDelegate`。

[LOW] 访问 `$client` 依赖 `@ts-expect-error`

- 位置：`db/seed/db-client.ts:72`
- 对应规范：`04-typescript-types.md` / 不依赖私有 API 断言
- 违规原因：`disconnectDbClient` 通过 `db.$client` 访问内部 pool，需要 `@ts-expect-error`。
- 整改建议：`createDbClient` 返回 `{ db, pool }` 或封装 `SeedDbClient`，显式保存 pool。

### index.ts

[MEDIUM] 原生 SQL DO block 缺少原因和风险注释

- 位置：`db/seed/index.ts:22-52`
- 对应规范：`07-drizzle.md` / 使用原生 SQL 必须说明原因
- 违规原因：脚本执行 `DO $$ ... EXECUTE format(...)` 重置所有 public 表的 id 序列，但没有说明为什么 seed 需要全库扫描和 setval。
- 整改建议：在 SQL 前补充原因注释：seed 通过固定 id/upsert 后需同步 identity sequence；说明仅限非生产环境。

[MEDIUM] seed 入口缺少生产环境保护

- 位置：`db/seed/index.ts:18-91`
- 对应规范：安全风险、工程边界
- 违规原因：脚本只检查 `DATABASE_URL`，没有校验运行环境或目标库标识。
- 整改建议：在 `runSeeds` 开始前检查 `NODE_ENV`、数据库 host/dbname，必要时要求显式确认环境变量。

### modules/app/domain.ts

[MEDIUM] 应用用户 seed 使用固定密码 hash 和固定 token jti

- 位置：`db/seed/modules/app/domain.ts:540`、`:606-658`
- 对应规范：安全风险 / seed 数据不得变成生产凭据来源
- 违规原因：应用 seed 用户复用固定 `SEED_PASSWORD_HASH`，并写入固定 token jti。误运行生产会写入可预测认证数据。
- 整改建议：测试账号和 token 元数据仅在 development/test/provision 执行；或由 seed 前置清理/隔离测试租户。

### modules/system/domain.ts

[LOW] seed 请求日志包含管理员路径与设备信息

- 位置：`db/seed/modules/system/domain.ts:272-283`
- 对应规范：安全日志 / 避免沉淀敏感路径和标识
- 违规原因：seed 会写入 `/api/admin/task/create`、`seed-script/admin` 等运行轨迹，可能污染审计/请求日志。
- 整改建议：将 seed 日志标记为 `seed` source，并避免模拟真实后台敏感路径。

### 全部 domain.ts

[LOW] seed 进度全部使用 `console.log`

- 位置：`db/seed/modules/work/domain.ts:370-772`、`app/domain.ts:420-2167`、`forum/domain.ts:103-452`、`message/domain.ts:40-392`、`system/domain.ts:124-327`
- 对应规范：代码质量 / 正式脚本建议使用统一日志封装
- 违规原因：seed 作为脚本使用 console 输出可接受，但无法控制日志等级，也不便于 CI 收敛。
- 整改建议：封装 `seedLogger`，统一进度、warn、error 输出和脱敏策略。

## 已审查且未发现独立违规项的文件

- `db/seed/modules/admin/index.ts`、`app/index.ts`、`forum/index.ts`、`message/index.ts`、`system/index.ts`、`work/index.ts`：仅做模块 re-export，未发现独立违规项。
- `db/seed/modules/work/domain.ts`：除统一 console 日志问题外，seed 数据分阶段写入未发现独立违规项。
- `db/seed/modules/forum/domain.ts`：除统一 console 日志问题外，论坛 seed upsert 逻辑未发现独立违规项。
- `db/seed/modules/message/domain.ts`：除统一 console 日志问题外，消息 seed upsert 逻辑未发现独立违规项。

## 整体合规率总结

- 模块合规率：约 76.7%（66/86）
- 最高风险是 seed 脚本缺少生产保护且写入固定认证相关数据。

## 必改项清单

1. 给 seed 入口增加环境保护，禁止默认对生产库运行。
2. 移除固定管理员密码 hash/固定 token jti，或限制在本地测试环境。
3. 将 `db-client.ts` 的 seed query 类型迁入 `*.type.ts`。
4. 给序列重置 DO block 补充原因和风险注释。

## 优化建议清单

1. 建立 `seedLogger` 统一日志输出和脱敏。
2. 将 seed 账号、手机号、token 等敏感样例数据集中声明并标记仅限本地/测试。
