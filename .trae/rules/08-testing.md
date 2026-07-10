# 测试与验证规范

适用范围：长期 unit/integration/e2e/architecture/performance 测试、一次性探针、覆盖率、性能统计与交付前验证。

本篇是测试资产和验证门禁的单一事实源；仓库级最低交付要求仍以 [AGENTS.md](../../AGENTS.md) 为准。

当前 no-compat 行为和一次性 database baseline reset 的测试范围，以[零债务开发纪元 ADR](../../docs/architecture/zero-debt-development-epoch.md) 为准。

## TL;DR

- 何时看：新增或修改行为、contract、事务、模块边界、错误语义、测试基础设施或性能预算时先看本篇。
- 必做：先建立能在旧缺陷上失败的长期回归保护，再改实现；unit、integration、e2e、architecture 与 performance 测试必须提交并持续维护。
- 不要：删除有回归价值的测试、用一次性探针代替长期测试、依赖真实外网、用重试掩盖 flaky，或只凭 type-check 声称行为正确。
- 最低验证：运行改动对应的分层测试与静态检查；完整交付运行 `pnpm check`。

## 长期资产与命名

- unit：贴近 owner 文件，命名为 `*.spec.ts`。
- integration：统一位于 `test/integration/**`，命名为 `*.integration.spec.ts`。
- e2e：统一位于 `test/e2e/**`，命名为 `*.e2e-spec.ts`。
- architecture/module contract：统一位于 `test/architecture/**`，命名为 `*.architecture.spec.ts`。
- performance/soak：统一位于 `test/performance/**`，命名为 `*.performance.ts`；版本化场景、数据规模、SQL plan 与结果摘要放在同目录受控资产中。
- 共享确定性 fixture 位于 `test/fixtures/**`；fixture 必须最小、可读、无真实凭据。
- 一次性诊断探针只允许放在未跟踪的 `.cache/` 或系统临时目录，验证后删除；若探针证明了可回归行为，必须转成上述长期测试。

## 测试分层

### Unit

- 覆盖 DTO 边界、config factory、error mapping、日志脱敏、request-id、auth policy、mapper、closed set 与纯业务 policy。
- 断言公开行为，不绑定私有方法调用次数、局部变量或无业务意义的实现步骤。

### Module / Architecture

- 每个 feature module 使用 TestingModule 独立编译，证明 provider token 唯一、imports/exports 完整。
- 静态测试必须证明 0 business global、0 `ModuleRef strict:false`、0 runtime SCC、0 forbidden barrel 与 package DAG 合规。

### Integration

- PostgreSQL 覆盖事务提交/回滚、计数器原子性、RQBv2 relations、分页、锁、affected-row、migration/bootstrap/seed。
- Redis/cache 覆盖 token 吊销、限流、缓存故障与 fail-closed 安全边界。
- 数据库与 Redis 必须使用每个 worker 独占的隔离实例和确定性 seed；禁止连接共享开发库。
- 禁止真实外网；第三方依赖使用受控 fake/server stub，并断言 timeout、错误与重试边界。

### HTTP / WebSocket E2E

- 两个 app 覆盖启动、鉴权、权限、DTO unknown field、错误码/状态、request-id、health、上传限制与 OpenAPI。
- WS 覆盖握手、认证超时、吊销 token、payload 上限、消息限流、heartbeat、断线清理与 ACK/error。
- 必须证明 HTTP-only enhancer 不在 WS 消息链执行，WS enhancer 完整且显式。
- 当前 epoch 删除的路由、字段、枚举和配置必须明确失败，不得被静默忽略、转换或映射。

### Performance / Soak

- 场景必须固定 Node/PostgreSQL/Redis 版本、CPU/内存、数据规模、并发、网络与预热条件；预热至少 2 分钟或直到指标稳定。
- 每场景至少 3 个独立 measurement run；每轮同时满足至少 10 分钟与观测量门槛（HTTP 100,000 observations，WS 10,000 ACKs），以更晚达到者为准。
- 使用多轮中位数与 95% confidence interval；run 间 coefficient of variation `>5%` 时扩为 5 轮，并先排除环境噪声。
- 先裁决 absolute SLO；通过后，相对 p95/p99 回归上限分别为 `5%` / `10%`。原本未达 SLO 的热点改善幅度下限为 `15%`，error rate 必须 `<0.1%`。
- 采集吞吐、p50/p95/p99、错误率、event-loop、CPU、heap/RSS、GC、连接池、query count，并对热点保存 `pg_stat_statements` 与 `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` 证据。
- 30 分钟 soak 使用预热后内存时间序列斜率及其 95% CI 判断泄漏；连接池不得耗尽。共享 CI 只跑确定性 performance smoke，完整统计门禁在固定资源 runner 执行。

## 覆盖率与高风险门禁

- 全仓 line/function/statement `>=85%`，branch `>=80%`。
- auth、RBAC、配置启动、migration/bootstrap、事务/计数器、HTTP/WS transport branch `>=95%`。
- 覆盖率只是 policy floor；每个 debt finding 必须绑定至少一个能在旧缺陷或故障注入下失败的行为门禁。
- auth policy、config fail-fast、事务回滚与 WS mapper 必须做 targeted mutation/fault-injection review；高风险 surviving mutant 为 0。
- generated/declarative 文件的排除必须由 test owner 与 verifier 共同批准，记录 owner 和理由，不得掩盖业务分支。

## 默认工作流

1. 明确行为、失败分支、contract 或性能预算。
2. 对 bug、cleanup、refactor、事务和边界调整，先写能锁住当前期望的长期测试；回归修复应证明测试在旧缺陷上失败。
3. 实施最小改动，运行目标测试，再运行受影响的 type-check、lint、build、静态门禁。
4. 删除一次性探针，保留长期测试、fixture、benchmark 与原始裁决证据。
5. 完整交付运行统一 `pnpm check`，并以同一最终工作区的新输出作为证据。

## 标准入口

- `pnpm test:unit`
- `pnpm test:integration`
- `pnpm test:e2e`
- `pnpm test:architecture`
- `pnpm test:performance`
- `pnpm type-check`
- `pnpm lint:check`
- `pnpm check`

测试统一使用 Jest 30 runner 与 SWC 转译；TypeScript 类型检查由独立 tsc 命令负责。脚本收口完成前的真实入口差距记录在 [AI_EXCEPTIONS.md](./AI_EXCEPTIONS.md)，不得把过渡期缺少聚合脚本当作跳过测试的理由。

## 禁止项

- 禁止提交 `.only`、无到期 owner 的 `.skip`、依赖执行顺序的测试或用 retries 掩盖 flaky。
- 禁止大而脆的全对象快照；只断言关键 contract、错误码、状态变化和副作用。
- 禁止使用当前时间、随机值、共享数据库、真实外网或未隔离端口制造不确定性。
- 禁止把 type-check、覆盖率数字或“启动成功”单独作为行为正确证据。
- 禁止删除失败测试后声称完成；必须修复实现、fixture 或测试中的错误假设。
- 禁止由普通测试、`pnpm check` 或本地 OpenAPI 校验触发数据库 reset、外部 API publish 或其他凭据化写操作。
