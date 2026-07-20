# 测试与验证规范

适用范围：行为/contract/数据库验证、一次性探针和交付证据。本文件服从
`AGENTS.md` 的"仓库不保留测试文件"硬约束；不得以历史测试策略覆盖该约束。

## TL;DR

- 先锁住业务、分页、错误、事务和数据 contract，再修改实现。
- 不提交 `*.spec.ts`、`*.test.ts`、`*.e2e.spec.ts`、`test/**`、临时 fixture/probe 或
  ad-hoc import script。临时验证必须在系统临时目录或显式登记的 ephemeral location
  运行，并在交付前删除。
- 可长期提交的是 production/operation owner 的静态 gate 和受控脚本，例如 migration
  check、环境 guard 与边界检查；它们不是测试框架资产，
  必须不含兼容层或真实凭据。
- `.omx/evidence/**` 只保留脱敏、可重算的证据摘要、raw distribution、EXPLAIN JSON、
  环境与 digest；不得保存 DATABASE_URL、token、password、PII、可恢复的 source dump 或
  不可复现临时数据。

## 分层验证

- 静态：typecheck、non-fixing ESLint、build、Drizzle/RQB/FK/raw/decoder/manifest/page
  contract checks。
- PostgreSQL：使用操作流程明确的数据库连接，按实际改动验证 RQB relation、transaction、
  migration/comments/bootstrap。测试结束后删除临时测试代码与一次性证据。
- HTTP/WS：冻结 DTO、OpenAPI、错误码、认证、页码/游标 owner 与完整 response。后台必须
  维持页码任意跳转和 exact total；不得以 cursor 或近似值替代。

## 当前真实入口

代码改动最低运行 `pnpm type-check`，再按影响面运行：

```bash
pnpm exec eslint <changed-typescript-files>
pnpm build:admin
pnpm build:app
pnpm identity:hard-cut:check
pnpm db:migration:check
pnpm db:comments:check
```

只运行实际存在的命令。当前不存在 `pnpm check`、`pnpm lint:check`、
`pnpm test:*`、`pnpm boundaries:check`；不得在文档或 CI 中伪造它们。
规则/文档变更至少运行对应 Markdown Prettier check 与 `pnpm type-check`。

identity hard cut 当前真实窄静态 gate 是 `pnpm identity:hard-cut:check`，阻断
`libs/identity`、
`@libs/identity/*`、`IdentityModule`、替代 umbrella、compat shim、alias re-export、旧 token
storage 继承 base、旧 schema/relation path 和 retained test/probe file。retained
test/probe 扫描必须覆盖所有 commit candidate，并排除 `.git`、`.omx`、`dist` 与
`node_modules`。该 gate 变更需要红绿验证脚本本身确实能因旧路径或 retained
test/probe 回归而失败。

## 禁止项

- 禁止普通测试、OpenAPI、生成、应用启动或 lint 隐式 reset、seed、bootstrap、publish 或
  其他凭据化写入。
- 禁止在 evidence/log 中输出连接串、credential、token、SQL 参数或 PII。
- 禁止测试为兼容层、旧 route/field/value/ORM API 或旧 migration journal 提供豁免。
- 禁止销毁未明确指定的资源、修改 PostgreSQL cluster configuration 或声称未执行的验证已通过。
