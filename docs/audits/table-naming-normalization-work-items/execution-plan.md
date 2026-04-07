# 数据表命名规范化执行排期

## 优先级说明

- `P0`：阻塞线上库直接切换的核心任务；未完成前不得生成最终迁移或安排上线窗口。

## 依赖术语

- `硬前置`：必须完成后，当前任务才能开工。
- `软前置`：建议优先完成，但在风险可控前提下可并行推进。
- `可并行`：在无共享写集冲突时可并行执行。
- `直接后置`：当前任务完成后应立即衔接的任务。

## Wave 划分

### Wave 1

| 任务 | 状态 | 依赖 | 可并行 | 直接后置 | 摘要 | 任务单 |
| --- | --- | --- | --- | --- | --- | --- |
| P0-01 | completed | 无 | 无 | P0-02 | 收口 schema 文件名、导出符号、物理表名与关系定义 | [01-schema-file-symbol-and-table-rename.md](./p0/01-schema-file-symbol-and-table-rename.md) |

### Wave 2

| 任务 | 状态 | 硬前置 | 可并行 | 直接后置 | 摘要 | 任务单 |
| --- | --- | --- | --- | --- | --- | --- |
| P0-02 | completed | P0-01 | 无 | P0-03 | 切换 apps / libs / seed 对新 schema 名称的全部引用 | [02-runtime-seed-and-reference-cutover.md](./p0/02-runtime-seed-and-reference-cutover.md) |

### Wave 3

| 任务 | 状态 | 硬前置 | 可并行 | 直接后置 | 摘要 | 任务单 |
| --- | --- | --- | --- | --- | --- | --- |
| P0-03 | in_progress | P0-01、P0-02 | 无 | 无 | 生成迁移、同步注释产物并完成直切发布验证 | [03-migration-comments-and-release-verification.md](./p0/03-migration-comments-and-release-verification.md) |

## 任务依赖补充说明

- `P0-01` 是唯一的 schema 命名事实源，后续任务不得自行保留旧导出或再派生第二套别名。
- `P0-02` 必须在 `P0-01` 稳定后进行，否则 `apps/*`、`libs/*` 与 `db/seed/*` 会同时出现旧导出和新导出混用。
- `P0-03` 必须在代码引用全部切换后执行，避免 `drizzle-kit` 基于中间态生成错误迁移。
- 本轮为线上库直切，不允许把旧应用版本与新 schema 长时间混跑；上线顺序和回滚判定统一在 `P0-03` 落实。

## 状态变更记录

| 日期 | 任务 | 变更前 | 变更后 | 记录 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 2026-04-07 | 全部任务 | 无 | pending | 初始化工作包文档集 | 当前仅完成排期建档，尚未开始实现 |
| 2026-04-07 | P0-01 | pending | completed | 已完成 schema 文件名、导出符号、物理表名与 relations 收口 | 新 schema 名称已成为唯一事实源 |
| 2026-04-07 | P0-02 | pending | completed | 已完成 apps / libs / seed 对新 schema 名称的切换 | `pnpm type-check` 已通过 |
| 2026-04-07 | P0-03 | pending | in_progress | 已完成 comments 产物刷新与工程校验，待用户执行迁移生成 | `pnpm db:generate` 可能涉及 rename 交互，需用户亲自确认 |
| 2026-04-07 | P0-03 | in_progress | in_progress | 已补充用户授权的手工 rename migration，并完成人工审查 | 待实际执行数据库迁移与发布门禁确认 |
| 2026-04-07 | P0-03 | in_progress | in_progress | 用户已反馈手工 rename migration 执行成功 | 待补数据库侧独立核验与业务冒烟证据 |
| 2026-04-07 | P0-03 | in_progress | in_progress | 已完成数据库侧独立核验，确认新表存在、旧表消失且迁移记录哈希匹配 | 待补业务冒烟与发布门禁确认 |
