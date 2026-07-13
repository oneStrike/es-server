# AI 术语表

本文件只解释项目内高频术语，不替代专项规则或 ADR。

## owner 文件

- 某个符号真正定义和维护的具体文件。大多数业务域导入默认直连 owner 文件，不经过目录语义路径或转发入口。
- 例如 `@libs/forum/section/dto/forum-section.dto`、`@libs/growth/growth-reward/types/growth-reward-result.type`。
- `libs/platform` 与 `db` 是受控 public API 例外，入口以 [01-import-boundaries.md](./01-import-boundaries.md) 及其白名单为准。

## owner 模块

- 某个业务概念、provider 或 use case 实际归属和维护的模块边界。
- DTO、type、service 与 provider 默认贴近 owner 模块；调用方不得就地复制定义或重复注册 provider。

## provider owner

- 唯一把某个 provider/token 放入 `providers` 的 Nest module。
- 其他 module 只能显式 import owner module 并消费其最小 exports；重复注册、业务 global 与 `ModuleRef strict:false` 都不是 owner 机制。
- 完整规则见 [09-nestjs-architecture.md](./09-nestjs-architecture.md)。

## canonical contract

- 当前唯一被代码、OpenAPI、DTO、错误码、schema、comments、RQB v2 relations 与验证证据共同声明的合同。
- 字段存在性、nullability、路由、错误语义、分页、闭集值域和 transport 行为都属于 contract。
- 当前 development epoch 以新 canonical contract 原子替换旧合同；旧输入、旧输出与旧数据解释不构成第二套合同。

## no-compat

- 不接受或解释已删除的路由、字段、配置、值域、ORM API、migration log 或开发数据。
- 禁止 shim、alias、版本路由、静默转换、旧值 fallback、双读、双写与旧 migration 解释器。
- 可观察故障降级、确定性默认排序与状态机补偿不属于旧合同解释能力，但必须进入有 owner 和测试的 resilience allowlist。

## consumer-owned port

- consumer 为真实跨域同步能力或外部 SDK 定义的最小接口；adapter 在 app composition 绑定。
- port 不用于包装所有数据库调用，也不得隐藏新事务。事务上下文需要沿同步调用链显式传播。

## producer-owned event

- producer 为已经发生的业务事实拥有的 event contract；consumer 依赖该 contract，而不是反向依赖 producer service。
- 可靠投递使用 producer transaction 内的 outbox，consumer 负责幂等。

## composition root

- `apps/*` 中显式选择 module、provider adapter 与 transport enhancer 的唯一装配位置。
- HTTP 和 WS 的 pipe/guard/filter/interceptor/error mapper 必须分别可见；Gateway 不依赖 HTTP globals 的隐式继承。

## 闭集字段

- 值域有限、可枚举、需要在 schema/DTO/常量之间保持一致的字段，常见于状态、类型、模式、角色、平台、目标和场景。
- `eventKey`、`categoryKey`、`projectionKey` 等开放业务键不属于闭集字段。

## 事实源

- 当前仓库真正起约束作用的 ADR、规则与 canonical implementation。
- `AGENTS.md` 和 [PROJECT_RULES.md](./PROJECT_RULES.md) 是入口，再下钻到 `01-09` 专项规则；快速路由、术语与例外文档不复制专项正文。

## barrel

- 仅用于转发导出的目录入口或汇总文件，例如 `index.ts`、`dto/index.ts`、`types/index.ts`。
- 大多数业务域禁止新增 barrel；受控例外以 01 规则白名单为准。

## 长期测试资产

- 在本仓库是可长期运行的 operation/static gate 与脱敏 evidence，而不是保留在仓库中的
  `*.spec.ts`/`test/**` 测试代码；具体约束见 [08-testing.md](./08-testing.md) 与
  `AGENTS.md`。
- 一次性诊断测试、fixture 与 probe 不属于长期资产，使用后删除。

## 最低验证

- 诚实宣称完成前必须运行的最小证据集合；它是底线，不是减少验证的借口。
- 规则文档通常需要 Markdown check + type-check；代码改动至少 type-check，并按行为变化运行分层测试、build、边界或性能门禁。
