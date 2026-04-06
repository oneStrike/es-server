# IP 属地接入执行排期

## 优先级说明

- `P0`：阻塞核心落库链路或 app 端接口契约的任务，未完成前不进入整体验收。
- `P1`：依赖核心链路稳定后再推进的补充任务，不阻塞 `P0` 的主链路打通。

## 依赖术语

- `硬前置`：必须完成后，当前任务才能开工。
- `软前置`：建议优先完成，但不满足时可在风险可控前提下并行推进。
- `可并行`：在无共享写集冲突时可并行执行。
- `直接后置`：当前任务完成后应立即衔接的任务。

## Wave 划分

### Wave 1

| 任务 | 状态 | 依赖 | 可并行 | 直接后置 | 摘要 | 任务单 |
| --- | --- | --- | --- | --- | --- | --- |
| P0-01 | pending | 无 | 无 | P0-02、P0-03 | 收口 schema 与 Geo 平台基础能力 | [01-schema-and-geo-foundation.md](/E:/Code/es/es-server/docs/audits/ip-geolocation-work-items/p0/01-schema-and-geo-foundation.md) |

### Wave 2

| 任务 | 状态 | 硬前置 | 可并行 | 直接后置 | 摘要 | 任务单 |
| --- | --- | --- | --- | --- | --- | --- |
| P0-02 | pending | P0-01 | P0-03 | 无 | 打通登录态与审计属地写入 | [02-auth-and-audit-geolocation-write-path.md](/E:/Code/es/es-server/docs/audits/ip-geolocation-work-items/p0/02-auth-and-audit-geolocation-write-path.md) |
| P0-03 | pending | P0-01 | P0-02 | P1-01 | 打通社区内容落库与 app 端返回契约 | [03-community-content-geolocation-contract.md](/E:/Code/es/es-server/docs/audits/ip-geolocation-work-items/p0/03-community-content-geolocation-contract.md) |

### Wave 3

| 任务 | 状态 | 硬前置 | 软前置 | 直接后置 | 摘要 | 任务单 |
| --- | --- | --- | --- | --- | --- | --- |
| P1-01 | pending | P0-01 | P0-03 | 无 | 打通论坛操作日志属地写入 | [01-forum-action-log-geolocation-write-path.md](/E:/Code/es/es-server/docs/audits/ip-geolocation-work-items/p1/01-forum-action-log-geolocation-write-path.md) |

## 任务依赖补充说明

- `P0-01` 负责唯一的数据模型、schema 字段和 Geo 平台能力，后续任务不得各自定义第二套属地结构。
- `P0-02` 与 `P0-03` 可并行，但都必须复用 `P0-01` 提供的统一 Geo 上下文与字段写法。
- `P1-01` 涉及 `libs/forum/src/topic/forum-topic.service.ts`，与 `P0-03` 共享写集，默认在 `P0-03` 稳定后串行推进。

## 状态变更记录

| 日期 | 任务 | 变更前 | 变更后 | 记录 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 2026-04-06 | 全部任务 | 无 | pending | 初始化工作包文档集 | 当前仅完成排期建档，未开始实现 |
