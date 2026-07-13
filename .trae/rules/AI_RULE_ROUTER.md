# AI 规则快速路由

本文件只回答两件事：先读什么，最低验证做到什么程度。

## 边界

- 本文件只做导航，不替代 `AGENTS.md`、`PROJECT_RULES.md`、已接受 ADR 和 `01-09` 专项规则。
- 如果本文件与专项规则冲突，以专项规则为准；如果当前任务命中有效 ADR，以 ADR 的明确范围为准。

## 先判类型

- 改导入路径、文件放置、barrel、`libs/platform` / `db` 入口：读 [01-import-boundaries.md](./01-import-boundaries.md)。
- 改 Controller、路由、Swagger、`@HttpCode()`、HTTP 响应模型：读 [02-controller.md](./02-controller.md)；成功/失败语义同时读 [06-error-handling.md](./06-error-handling.md)。
- 改 DTO、返回结构、nullable、unknown field、字段复用：读 [03-dto.md](./03-dto.md)；Controller 出参同时读 02。
- 改 `*.type.ts`、Drizzle infer 或复杂签名：读 [04-typescript-types.md](./04-typescript-types.md)；HTTP contract 回到 03。
- 改注释、schema 字段说明、导出类型/常量/枚举说明：读 [05-comments.md](./05-comments.md)。
- 改错误码、`BusinessException`、HTTP/WS 错误映射、数据库错误转换：读 [06-error-handling.md](./06-error-handling.md)。
- 改 Drizzle 查询、schema、migration、seed、bootstrap：读 [07-drizzle.md](./07-drizzle.md) 与 [07-drizzle-operations.md](./07-drizzle-operations.md)；涉及 DTO/错误再读 03/06。
- 改测试、fixture、覆盖率、性能场景或验证入口：读 [08-testing.md](./08-testing.md) 与 [AGENTS.md](../../AGENTS.md)。
- 改 Nest module、provider owner、`@Global()`、`ModuleRef`、package DAG、port/event、事务 owner 或 HTTP/WS composition：读 [09-nestjs-architecture.md](./09-nestjs-architecture.md)。
- 改旧合同删除、迁移历史或可销毁开发数据：除对应专项规则外，必须先形成明确的操作与回退决策。
- 只改文档/规则：读 [AGENTS.md](../../AGENTS.md) 验证基线与 [PROJECT_RULES.md](./PROJECT_RULES.md)。

一次改动命中多类时取并集，不要只读一篇规则就开始改。

## 速查表

| 改动类型                   | 必须先读                  | 常见误判                                                           | 最低验证                                              |
| -------------------------- | ------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------- |
| 导入/owner/barrel          | 01、09                    | 只改路径形状却形成反向 package edge；新增转发入口                  | `pnpm type-check`、对应静态 owner/import gate         |
| Controller/HTTP contract   | 02、03、06                | 输入 DTO 当输出；HTTP 规则套到 WS；保留旧 route alias              | type-check、目标 HTTP e2e、OpenAPI check              |
| DTO/nullable/unknown field | 03、02                    | 用 `?: T \| null`；复制字段；静默丢弃旧字段                        | type-check、unit/HTTP e2e                             |
| 内部 type/infer            | 04、03                    | 在业务文件声明复杂顶层类型；重复 DTO/schema 结构                   | `pnpm type-check`                                     |
| 错误/异常/ACK              | 06、02、09                | 手写错误码；吞异常；让 WS 隐式继承 HTTP filter                     | type-check、目标 HTTP/WS e2e                          |
| Schema/migration/seed      | 07、07 operations、03、06 | 用 `push`；把 seed 当 bootstrap；未过 gate 就删旧 migration        | type-check、DB integration、migration/comments checks |
| Module/provider/DAG        | 09、01                    | 新增 business global、重复 provider、`strict:false`、中央万能 port | architecture test、TestingModule、boundaries check    |
| 测试/性能                  | 08                        | 遗留测试文件；真实外网/共享 DB；共享 CI 噪声充当性能证据           | 对应 gate/evidence；type-check 与必要 build           |
| 纯文档/规则                | AGENTS、PROJECT_RULES     | 只改文档就跳过检查；拿 ESLint 当 Markdown 检查                     | Prettier check；规则文档再跑 type-check               |

## 当前 epoch 快速判断

- 旧客户端、旧配置、旧数据库值域、旧 ORM API 或旧 migration log 是否被请求继续解释？若是，停止新增运行时分支，回到 epoch ADR 的 no-compat 边界。
- 是否准备销毁数据库或改写 migration 历史？若是，先证明三重 guard 和 Gate A/B/C 顺序；普通 `db:migrate` 与 `pnpm check` 不得隐式执行 reset。
- 是否准备调用 `publish-api:*` 或其他凭据化外部写操作？当前 ADR 不授权；必须满足 Gate D 并取得当次明确授权。

## 固定执行顺序

1. 判断改动类型与是否命中有效 ADR。
2. 读取对应专项规则；多类改动取并集。
3. 遇到项目术语时查 [AI_TERMS.md](./AI_TERMS.md)。
4. 仓库现状与目标规则不一致时查 [AI_EXCEPTIONS.md](./AI_EXCEPTIONS.md)；例外只描述现状，不授予新增债务。
5. 先建立可重复的 contract/operation gate 或 ephemeral 行为验证，再实施破坏性或结构性改动。
6. 选择足以证明结论的验证；声称完成前使用同一最终工作区的新输出。
