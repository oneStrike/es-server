# NestJS 架构规范

适用范围：`apps/*`、`libs/*`、`db/*` 的 runtime import、Nest module/provider、跨域协作、事务所有权与 HTTP/WS 协议装配。

## TL;DR

- 何时看：改 module imports/exports、provider 注册、`@Global()`、`ModuleRef`、跨域调用、事件、事务或 HTTP/WS enhancer 时先看本篇。
- 必做：所有 runtime edge 遵循唯一 package DAG；一个 provider 只有一个 owner module；跨域同步能力使用 consumer-owned port，异步事实使用 producer-owned event；HTTP 与 WS 显式独立装配。
- 不要：新增业务 global、service locator、重复 provider、循环依赖、中央万能 integration/repository 或隐式事务。
- 最低验证：`pnpm type-check` 与 ephemeral module/HTTP/WS 验证；不得引用不存在的命令。

本篇是 NestJS 架构约束的单一事实源。导入路径形状仍以 [01-import-boundaries.md](./01-import-boundaries.md) 为准，测试门禁以 [08-testing.md](./08-testing.md) 为准；破坏性更新必须先形成明确决策。

## 唯一 runtime package DAG

```text
apps/* 与 operational CLI composition
  → account/read-model
  → message
  → content/app-content
  → forum
  → commerce
  → interaction
  → growth
  → moderation
  → user/identity
  → system-config
  → eventing/workflow
  → observability
  → db/core
  → db/relations
  → db/schema
  → platform
```

- 箭头表示唯一允许的依赖方向：左侧可以依赖右侧，右侧不得反向导入左侧；不要求每个相邻节点直接依赖。
- 数据库 operational composition 由 package scripts 调起的 Drizzle Kit config、`db/bootstrap/**`、`db/seed/**` 与 `scripts/**` 静态/RBAC 入口组成。它们与 `apps/*` 一样只能装配并向下依赖 runtime owner；任何业务 runtime package 都不得反向导入这些可执行入口。
- package group 必须覆盖全部 runtime owner：`account/read-model` 对应 `libs/account`，`content/app-content` 对应 `libs/content` 与 `libs/app-content`，`commerce` 对应 `libs/commerce`，`moderation` 对应 `libs/moderation`（别名 `@libs/sensitive-word`），`system-config` 对应 `libs/config`，`user/identity` 对应 `libs/user` 与 `libs/identity`，`eventing/workflow` 对应 `libs/eventing` 与 `libs/workflow`，`observability` 对应 `libs/observability`。不得把这些 DB owner 留在 `libs/platform`。
- `db/core → db/relations → db/schema` 是数据库内部的唯一运行方向；业务代码只通过受控 `@db/core` / `@db/schema` public API 使用数据库能力，不把 `@db/relations` 暴露为业务入口。
- 新增顶层 `apps/*`、`libs/*` 或 `db/*` runtime package 前，必须先把它登记到上述唯一顺序及 machine-readable boundary 配置；未映射 package 直接使边界门禁失败，不允许默认放行。
- runtime package graph、Nest imports graph 与文件级 runtime import graph 都必须无 SCC。
- `apps/*` 只负责 composition、transport、启动与 adapter 绑定，不承载可复用领域逻辑。
- `apps/*` 不直接注入 `DrizzleService`、持有 schema table 或 import 任意 `@db/*`；它们只调用显式导入的 domain owner provider。
- `account/read-model` 是复杂用户聚合读模型的唯一 owner；不得把聚合查询回塞 `user/identity` 或建成业务 global。
- `libs/platform` 不依赖 `db/core`；数据库健康检查归 DB adapter 或 app composition。
- `forwardRef()`、调整导出顺序或动态 service lookup 不得用于掩盖反向边；必须删除导致环的依赖。

## Module 与 provider owner

- 自定义业务 `@Global()` 必须为 0。
- 全局基础设施 allowlist 仅包含框架 `ConfigModule`、CLS request-context module，以及无 DB 依赖的 `libs/platform` 基础设施 `JwtAuthModule`、`CryptoModule`、`GeoModule`、`LoggerModule`；新增 allowlist 项必须修改本篇并形成架构决策，不得由 feature module 自行声明。
- `DrizzleModule` 不在 global allowlist。每个数据库 consumer 所在 owner module 必须显式 import 它；`PlatformModule` 和任何 facade 不得替 feature module 隐式提供数据库 provider。
- 一个 provider 只能在一个 owner module 的 `providers` 中注册。其他模块通过显式 `imports` 消费 owner module 暴露的最小稳定 provider。
- 禁止在多个 module 重复注册同一 provider、token、guard、storage 或 adapter 实现。
- 禁止 `ModuleRef.get(..., { strict: false })`、字符串 service locator、容器全局查找或运行期补依赖。
- feature module 只导出其稳定 public provider，不得聚合导出其他业务模块形成隐式依赖面。
- config factory 必须在 bootstrap/register factory 执行时读取最终环境值，经校验后以强类型 provider 注入；禁止模块加载前捕获环境变量。

## 跨域同步 port

- 只有真实跨域同步能力或外部 SDK 边界才建立 port；普通 owner 查询不得泛化成 repository/port。
- port 由 consumer 定义并拥有，接口只表达 consumer 所需最小能力；实现 adapter 在 app composition 绑定。
- feature owner 可以在自己的 query/service 中直接使用注入的 `DrizzleService`，禁止建立中央万能 repository、manager 或 integration package。
- 调用链已有事务时，transaction context 必须作为显式参数沿 port 传播；adapter 不得隐藏开启第二个事务，也不得把数据库 transaction 跨异步事件边界传递。
- 一个 use case 只有一个 transaction owner；事实写入、计数器与 outbox 必须位于同一 owner transaction。

## 跨域异步 event

- 业务事实事件由 producer 定义并拥有 contract；consumer 只依赖 producer 的稳定 event contract，不反向导入 producer service。
- 需要可靠投递时使用 producer transaction 内的 outbox；consumer 必须幂等，并显式定义重试、失败与观测语义。
- event 不得充当同步查询、事务拼接或隐藏循环依赖的 service locator。
- 中央 eventing/workflow 只提供投递与编排基础设施，不拥有各业务域事实字段。

## HTTP 与 WebSocket 显式装配

- 每个 app composition root 必须显式列出所需 feature/infra module，以及 HTTP、WS 各自的 pipe、guard、filter、interceptor、throttler 与 error mapper。
- HTTP application global enhancer 只服务 HTTP；Gateway/adapter 不得假设会继承正确的 HTTP global 行为。
- WS 必须显式装配专用 auth、validation、throttling、exception/ACK chain；不得执行依赖 HTTP response、header 或 request lifecycle 的逻辑。
- HTTP 与 WS 可以复用纯 policy/service，但必须各自拥有 transport adapter 与错误映射。
- transport contract 变化必须由可重复 HTTP/WS e2e proof 证明实际调用链、鉴权、失败码与副作用，而不是依赖 Nest 隐式行为假设；临时代码按 `AGENTS.md` 删除。

## Service 职责

- service 以纵向 use case 为边界，public API 有限，跨域副作用显式，事务 owner 唯一。
- command、query、policy、mapper 与 background orchestration 不得长期纠缠在同一 God Service。
- `>=500` 行 service 必须登记职责复审；`>800` 行或构造依赖 `>8` 是强制复审触发器，不是机械拆分验收条件。
- 复审只能以 `split` 或有 reviewer 证据的 `cohesive` 关闭；不得记录“以后再拆”。

## 架构约束

- 仓库必须维持唯一 package 顺序、0 runtime SCC、0 business global、0 `forwardRef()`、0 `ModuleRef` / `strict:false`、0 forbidden barrel 与 0 重复 provider。从每个 `apps/*/src/app.module.ts` 组合根展开真实 Nest module import 闭包时：仓库自有 `DynamicModule` 静态工厂的 `module`、`imports`、`providers`、`exports` 与传入 options 必须可静态解释；无法解释的动态结构直接失败。闭包内必须同时为 0 module import SCC、0 裸导入 provider-owning dynamic module、0 同 token/provider 重复注册；合法的已导入 module re-export 不计作新注册。涉及 DB 领域边界时，必须保证 0 app direct DB import、0 DB internal-path import、0 generic persistence filename、0 legacy schema/relation path、0 `DrizzleModule @Global()` 与 0 public relation registry export。
- 每个 feature module 必须有可重复的 module compilation proof，证明 imports/exports 与 provider token 完整且唯一；按 `AGENTS.md`，临时测试代码在验证后删除。
- HTTP/WS composition 必须有协议级 proof；跨 port 事务必须有提交、回滚与失败分支验证；event/outbox 必须有幂等与投递失败验证。仓库中不得遗留 test 文件或临时 probe。
- 任何例外必须先修改本篇或 `AI_EXCEPTIONS.md`，写明 owner、理由、验证与到期条件；实现中的局部注释不能替代规则决策。
