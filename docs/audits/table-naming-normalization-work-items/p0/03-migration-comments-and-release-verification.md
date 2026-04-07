# P0-03 生成迁移、同步注释产物并完成直切发布验证

## 目标

- 基于已完成的新 schema 命名生成可用于线上数据保留的迁移产物。
- 同步更新数据库注释产物，并完成直切上线前的验证与证据沉淀。

## 范围

- `db/migration/*`
- `db/comments/generated.sql`
- `package.json`
- `docs/audits/table-naming-normalization-work-items/*`

## 当前代码锚点

- 当前迁移通过 `pnpm db:generate` 生成：
  - `package.json`
- 当前迁移产物目录：
  - `db/migration/20260406145232_neat_tag/*`
  - `db/migration/20260407002252_greedy_enchantress/*`
- 当前注释产物文件：
  - `db/comments/generated.sql`
- 当前工作包验收入口：
  - `docs/audits/table-naming-normalization-work-items/checklists/final-acceptance-checklist.md`

## 非目标

- 不手写 migration SQL 来绕过 `drizzle-kit` 生成结果。
- 不设计旧表名兼容层或长期灰度方案。
- 不在本任务中引入额外数据修复脚本。
- 不执行生产环境实际迁移；本任务只产出和验证上线所需工件与顺序。

## 主要改动

- 在 `P0-01` 与 `P0-02` 完成后，由用户亲自执行 `pnpm db:generate`，如遇 rename 交互则明确确认旧表与新表的映射。
- 审查生成的 `db/migration/*/migration.sql` 和 `snapshot.json`，确认产物符合“rename 保留数据”的预期。
- 运行 `pnpm db:comments:generate` 更新 `db/comments/generated.sql`，并用 `pnpm db:comments:check` 校验注释产物与 schema 一致。
- 运行 `pnpm type-check`，并对本轮改动文件执行 `eslint`。
- 用 `rg` 搜索源码范围内的旧表名和旧 schema 导出符号，确认仓库已完成切换；固定豁免目录为 `docs/audits/table-naming-normalization-work-items/**` 与 `db/migration/**`，避免把 rename matrix 和历史 / 生成迁移中的旧名文本误判为残留。
- 在验收清单中记录迁移审查结论、验证命令输出摘要、阻塞上线项与最终签收意见。

## 完成标准

- 迁移产物已生成并完成人工审查，未出现不可接受的 drop/create 数据风险。
- `db/comments/generated.sql` 已和新 schema 命名保持一致，`pnpm db:comments:check` 可通过。
- `pnpm type-check` 可通过，变更文件的 `eslint` 已通过。
- 工作包范围内对目标旧表名、旧导出符号的残留已清零，或在验收清单中列出明确豁免。
- 上线顺序、阻塞条件和回滚判定已写入验收清单，可供实际发布时复用。

## 完成后同步文档

- 更新 [execution-plan.md](../execution-plan.md) 中 `P0-03` 的状态。
- 更新 [development-plan.md](../development-plan.md) 中迁移与发布验证结论。
- 在 [final-acceptance-checklist.md](../checklists/final-acceptance-checklist.md) 记录迁移、校验和上线门禁证据。

## 排期引用

- 排期、波次、依赖与状态以 [execution-plan.md](../execution-plan.md) 中的 `P0-03` 为唯一事实源。
