# IP 属地接入执行排期

## 优先级说明

- `P0`：阻塞核心落库链路或 app 端接口契约的任务，未完成前不进入整体验收。
- `P1`：依赖核心链路稳定后再推进的补充任务，不阻塞 `P0` 的主链路打通。

## 状态说明

- 状态仅反映当前分支的代码落地情况，不等同于最终签收结论。
- 状态取值约定：`pending` = 未开始，`in_progress` = 已部分落地但仍有缺口，`completed` = 代码已落地，待验收补证据。
- 最终签收、证据与验证命令仍以 [final-acceptance-checklist.md](./checklists/final-acceptance-checklist.md) 为准。

## 依赖术语

- `硬前置`：必须完成后，当前任务才能开工。
- `软前置`：建议优先完成，但不满足时可在风险可控前提下并行推进。
- `可并行`：在无共享写集冲突时可并行执行。
- `直接后置`：当前任务完成后应立即衔接的任务。

## Wave 划分

### Wave 1

| 任务 | 状态 | 依赖 | 可并行 | 直接后置 | 摘要 | 任务单 |
| --- | --- | --- | --- | --- | --- | --- |
| P0-01 | completed | 无 | 无 | P0-02、P0-03 | 收口 schema 与 Geo 平台基础能力 | [01-schema-and-geo-foundation.md](./p0/01-schema-and-geo-foundation.md) |

### Wave 2

| 任务 | 状态 | 硬前置 | 可并行 | 直接后置 | 摘要 | 任务单 |
| --- | --- | --- | --- | --- | --- | --- |
| P0-02 | completed | P0-01 | P0-03 | 无 | 打通登录态与审计属地写入 | [02-auth-and-audit-geolocation-write-path.md](./p0/02-auth-and-audit-geolocation-write-path.md) |
| P0-03 | completed | P0-01 | P0-02 | P1-01 | 打通社区内容落库与 app 端返回契约 | [03-community-content-geolocation-contract.md](./p0/03-community-content-geolocation-contract.md) |

### Wave 3

| 任务 | 状态 | 硬前置 | 软前置 | 直接后置 | 摘要 | 任务单 |
| --- | --- | --- | --- | --- | --- | --- |
| P1-01 | completed | P0-01 | P0-03 | 无 | 打通论坛操作日志属地写入 | [01-forum-action-log-geolocation-write-path.md](./p1/01-forum-action-log-geolocation-write-path.md) |
| P1-02 | completed | P0-01 | 无 | 无 | 打通管理端 xdb 上传与当前进程热切换 | [02-admin-ip2region-hot-reload-management.md](./p1/02-admin-ip2region-hot-reload-management.md) |

## 任务依赖补充说明

- `P0-01` 负责唯一的数据模型、schema 字段和 Geo 平台能力，后续任务不得各自定义第二套属地结构。
- `P0-02` 与 `P0-03` 可并行，但都必须复用 `P0-01` 提供的统一 Geo 上下文与字段写法。
- `P1-01` 涉及 `libs/forum/src/topic/forum-topic.service.ts`，与 `P0-03` 共享写集，默认在 `P0-03` 稳定后串行推进。
- `P1-02` 依赖 `P0-01` 提供的 Geo owner 与默认 `xdb` 加载入口，默认可与 `P1-01` 并行；运行时 `tmp / versions / active` 目录约定由 `P1-02` 独占 owner，若后续需要跨进程立即生效，需另立任务处理广播重载。

## 状态变更记录

| 日期 | 任务 | 变更前 | 变更后 | 记录 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 2026-04-06 | 全部任务 | 无 | pending | 初始化工作包文档集 | 当前仅完成排期建档，未开始实现 |
| 2026-04-07 | P1-02 | 无 | pending | 新增管理端 xdb 上传与热切换任务 | 当前仅完成任务建档，未开始实现 |
| 2026-04-08 | P0-01 | pending | completed | 按当前代码回填任务状态 | schema、Geo owner 与注释产物已在当前分支落地，待最终验收补证据 |
| 2026-04-08 | P0-02 | pending | completed | 按当前代码回填任务状态 | auth token 与后台审计属地写入已在当前分支落地，待最终验收补证据 |
| 2026-04-08 | P0-03 | pending | completed | 按当前代码回填任务状态 | 社区内容写入与 app 返回契约已在当前分支落地，收藏主题分页口径已补齐 |
| 2026-04-08 | P1-01 | pending | completed | 按当前代码回填任务状态 | 论坛操作日志属地写入已在当前分支落地，待最终验收补证据 |
| 2026-04-08 | P1-02 | pending | completed | 按当前代码回填任务状态 | 管理端上传、状态查询与当前进程热切换已在当前分支落地，待最终验收补证据 |
