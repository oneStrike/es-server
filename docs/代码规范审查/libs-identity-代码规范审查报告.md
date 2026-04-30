# libs/identity 代码规范审查报告

## 审查概览

- 审查模块：`libs/identity`
- 审查文件数：9
- 读取范围：`libs/identity/src/**`、`libs/identity/tsconfig.lib.json`
- 关联核验文件：`libs/platform/src/modules/auth/base-token-storage.service.ts`、`libs/platform/src/modules/auth/token-storage.types.ts`
- 适用规范总条数：53
- 合规条数：46
- 违规条数：7
- 风险分布：CRITICAL 0 / HIGH 1 / MEDIUM 4 / LOW 2

## 规范条款逐条校验汇总

| 规范条款                                        | 校验结果 | 证据                                                                                                                                   |
| ----------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 目录职责：`libs/*` 承载可复用业务契约与领域逻辑 | 合规     | 模块内容集中在 identity/session/token 存储能力                                                                                         |
| 导入边界：业务域代码默认直连 owner 文件         | 合规     | `src/token/*` 直接引用 `@libs/platform/modules/auth/...` 与 `@db/core`                                                                 |
| 类型文件命名：纯类型定义必须使用 `*.type.ts`    | 合规     | `src/session.type.ts` 命名正确                                                                                                         |
| 禁止在 service/module 文件声明顶层业务类型      | 违规     | `src/token/drizzle-token-storage.base.ts:17` 声明 `type TokenTable`                                                                    |
| 方法签名禁止复杂内联对象类型                    | 违规     | `src/identity.module.ts:7`、`src/session.service.ts:23`、`src/session.service.ts:92-93`                                                |
| 方法必须有紧邻的简短行注释                      | 违规     | `src/session.service.ts:21`、`src/session.service.ts:73`、`src/session.service.ts:91`、`src/token/drizzle-token-storage.base.ts:31` 等 |
| 类型注释不得为同一符号重复堆叠 JSDoc            | 违规     | `src/session.type.ts:3` 与 `src/session.type.ts:7` 连续描述同一类型                                                                    |
| 数据写入/删除路径必须防止误伤范围扩大           | 违规     | `src/token/drizzle-token-storage.base.ts:141-173` 对空 where 未显式拒绝                                                                |
| DTO 字段说明应表达中文业务语义                  | 合规     | `src/dto/admin-auth.dto.ts`、`src/dto/admin-user.dto.ts` 字段描述基本为中文业务语义                                                    |
| 枚举成员应有注释                                | 合规     | `src/admin-user.constant.ts` 成员均有业务注释                                                                                          |
| 认证失败可使用认证/协议异常                     | 合规     | `src/session.service.ts` 的 `UnauthorizedException` 位于会话认证边界                                                                   |

## 按文件/模块拆分的详细违规清单

### src/identity.module.ts

[MEDIUM] 模块注册方法使用内联对象类型

- 位置：`libs/identity/src/identity.module.ts:7`
- 对应规范：类型规范 2.2，方法/函数签名不得直接声明复杂对象字面量类型，应提升到 `*.type.ts`
- 违规原因：`register(options: { tokenStorageProvider: Provider })` 把可复用模块注册参数内联在 module 文件中，后续扩展参数时容易形成重复定义。
- 整改建议：在 `identity.type.ts` 或现有类型文件中定义 `IdentityModuleRegisterOptions`，方法签名改为 `register(options: IdentityModuleRegisterOptions)`。

### src/session.service.ts

[MEDIUM] 会话服务方法参数使用内联对象类型

- 位置：`libs/identity/src/session.service.ts:23`、`libs/identity/src/session.service.ts:92-93`
- 对应规范：类型规范 2.2，复杂方法签名必须使用命名类型
- 违规原因：`tokens`、`logout dto`、`logout options` 均直接以内联对象类型声明，和已存在的 `SessionClientContext` 抽取方式不一致。
- 整改建议：抽取 `PersistSessionTokensInput`、`LogoutSessionInput`、`LogoutSessionOptions` 到 `session.type.ts` 后复用。

[LOW] 公开/内部方法缺少紧邻行注释

- 位置：`libs/identity/src/session.service.ts:21`、`libs/identity/src/session.service.ts:73`、`libs/identity/src/session.service.ts:91`
- 对应规范：注释规范 1.1，方法必须有紧邻的简短行注释
- 违规原因：`persistTokens`、`refreshAndPersist`、`logout` 没有方法级说明，调用方需要阅读实现才能确认职责边界。
- 整改建议：在每个方法前补充一行中文职责注释，例如“持久化新签发的访问令牌与刷新令牌”。

### src/session.type.ts

[LOW] 同一类型存在重复 JSDoc 注释

- 位置：`libs/identity/src/session.type.ts:3`、`libs/identity/src/session.type.ts:7`
- 对应规范：注释规范 3.1，同一符号不得堆叠重复 JSDoc
- 违规原因：`SessionClientContext` 前同时存在领域说明块和“稳定领域类型”模板注释，信息重复。
- 整改建议：保留一段准确说明即可，删除重复模板注释或合并内容。

### src/token/app-user-token-storage.service.ts

[LOW] getter 缺少紧邻行注释

- 位置：`libs/identity/src/token/app-user-token-storage.service.ts:14`
- 对应规范：注释规范 1.1，方法/访问器必须有紧邻简短说明
- 违规原因：`tokenTable` getter 决定当前存储服务绑定的表，但没有注释说明绑定关系。
- 整改建议：在 getter 前补充“返回 APP 用户 token 表定义”一类的短注释。

### src/token/drizzle-token-storage.base.ts

[HIGH] 空查询条件未被拒绝，更新/删除路径存在误伤风险

- 位置：`libs/identity/src/token/drizzle-token-storage.base.ts:141-173`
- 对应规范：安全与语法逻辑，数据库写操作必须有明确范围约束；Drizzle 查询条件应通过具名变量表达并避免隐式空条件
- 违规原因：`TokenStorageWhereInput` 的字段均为可选，`buildWhere({})` 会走到 `and(...conditions)`；在 `updateManyItems`、`deleteManyItems` 中继续传入 `.where(condition)`，一旦调用方传入空条件，可能退化为无条件更新/删除 token 数据。
- 整改建议：`buildWhere` 在 `conditions.length === 0` 时显式抛出业务异常，或在类型层定义至少一个查询键的输入类型，并为批量更新/删除增加空数组、空对象防护。

[MEDIUM] service 基类文件声明顶层业务类型

- 位置：`libs/identity/src/token/drizzle-token-storage.base.ts:17`
- 对应规范：类型规范 2.1，纯类型定义必须放在 `*.type.ts`
- 违规原因：`type TokenTable` 是纯类型别名，却声明在 service 基类实现文件中。
- 整改建议：移动到 `session.type.ts` 不合适，建议新增 `token-storage.type.ts` 或放入更贴近 token 存储的 `*.type.ts`。

[MEDIUM] 多个方法缺少紧邻行注释

- 位置：`libs/identity/src/token/drizzle-token-storage.base.ts:31`、`:58`、`:87`、`:96`、`:111`、`:130`、`:141`
- 对应规范：注释规范 1.1，方法必须有紧邻的简短行注释
- 违规原因：该基类承担 token 创建、批量查询、批量更新、批量删除和 where 构造，但方法前没有职责说明。
- 整改建议：为每个 protected/private 方法补充一行中文注释，说明操作语义和约束。

[MEDIUM] 多处类型断言弱化类型安全

- 位置：`libs/identity/src/token/drizzle-token-storage.base.ts:55`、`:93`、`:104`、`:121`、`:127`
- 对应规范：类型规范与工程风格，避免用断言绕过真实类型约束
- 违规原因：`as TEntity`、`as Record<...>`、`as Promise<TEntity[]>` 把 Drizzle 推导结果强行转换为抽象实体，掩盖表结构与泛型实体不匹配的可能。
- 整改建议：为 token 表建立可复用的表/实体映射类型，收窄 `TokenTable` 泛型约束，尽量让 `select/returning/set` 由 Drizzle 类型自然推导。

## 文件逐份审查结论

| 文件                                                        | 结论                                              |
| ----------------------------------------------------------- | ------------------------------------------------- |
| `libs/identity/src/admin-user.constant.ts`                  | 已读，未发现本轮适用规范违规                      |
| `libs/identity/src/dto/admin-auth.dto.ts`                   | 已读，未发现本轮适用规范违规                      |
| `libs/identity/src/dto/admin-user.dto.ts`                   | 已读，未发现本轮适用规范违规                      |
| `libs/identity/src/identity.module.ts`                      | 已读，发现内联对象类型问题                        |
| `libs/identity/src/session.service.ts`                      | 已读，发现内联对象类型与方法注释问题              |
| `libs/identity/src/session.type.ts`                         | 已读，发现重复 JSDoc 问题                         |
| `libs/identity/src/token/app-user-token-storage.service.ts` | 已读，发现 getter 注释问题                        |
| `libs/identity/src/token/drizzle-token-storage.base.ts`     | 已读，发现空 where 风险、类型放置、注释与断言问题 |
| `libs/identity/tsconfig.lib.json`                           | 已读，未发现本轮适用规范违规                      |

## 整体合规率总结

- 合规率：86.79%
- 主要问题集中在：方法签名类型抽取、方法注释、Drizzle token 存储基类的空条件防护。

## 必改项清单

1. 修复 `BaseDrizzleTokenStorageService.buildWhere` 的空条件防护，避免批量更新/删除误伤。
2. 将 `IdentityModule.register`、`AuthSessionService.persistTokens/logout` 的内联对象参数抽取为命名类型。
3. 将 `TokenTable` 移出 service 基类实现文件。

## 优化建议清单

1. 为 token 存储基类的 protected/private 方法补齐简短中文行注释。
2. 合并 `SessionClientContext` 的重复 JSDoc。
3. 减少 Drizzle 查询结果上的强制类型断言，优先通过泛型约束表达真实返回类型。
