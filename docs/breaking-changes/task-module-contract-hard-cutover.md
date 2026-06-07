# Task Module Contract Hard Cutover

## Scope

- API:
  - `admin/task/*`
  - `app/task/*`
- Domain: task definition、task step、task template options、task runtime cycle
- Change type: 破坏性更新，无兼容层

## Canonical Contract Changes

### Task definition write contract

管理端创建/更新任务时不再接受以下旧字段：

- `code`
- `priority`
- `repeatTimezone`
- `audienceSegmentId`

现在统一使用：

```ts
{
  title: string
  description?: string
  cover?: string
  sceneType: 1 | 2 | 4
  status: 0 | 1 | 2 | 3
  sortOrder: number
  claimMode: 1 | 2
  completionPolicy: 1
  repeatType: 0 | 1 | 2 | 3
  startAt?: Date | null
  endAt?: Date | null
  rewardItems?: unknown[] | null
  step: {
    triggerMode: 1 | 2
    targetValue: number
    templateKey?: string
    filters?: Array<{ key: string; value: string }>
    dedupeScope?: 1 | 2 | null
  }
}
```

说明：

- `code` 改为服务端自动生成，不再允许管理端直接写入。
- `sortOrder` 取代 `priority`，新合同为“数值越小越靠前”。
- `repeatTimezone` 已下线，周期统一按应用时区计算。
- `audienceSegmentId` 已下线，不再保留写入入口。

### Task definition read contract

任务定义相关响应不再返回以下旧字段：

- `priority`
- `repeatTimezone`
- `audienceSegmentId`

现在统一读取：

- `sortOrder`
- `repeatType`
- `startAt`
- `endAt`

## Step Contract Changes

步骤定义不再暴露以下旧字段：

- `progressMode`
- `uniqueDimensionKey`

现在统一使用：

- `triggerMode`
- `targetValue`
- `templateKey`
- `filters`
- `dedupeScope`

说明：

- 是否支持“按不同对象累计”由模板元数据 `supportsUniqueCounting` 表达。
- 唯一维度不再作为后台显式输入字段；执行层直接使用模板内部定义的默认唯一维度。

## Template Option Changes

`admin/task/template-options` 不再返回以下内部字段：

- `eventCode`
- `defaultUniqueDimensionKey`
- `availableUniqueDimensions`
- `supportedProgressModes`

现在统一返回：

- `templateKey`
- `label`
- `implStatus`
- `isSelectable`
- `targetEntityType`
- `supportsUniqueCounting`
- `availableFilterFields`
- `warningHints`

## Runtime Semantics

### Execution mode matrix

本轮 hard cutover 后仅保留两种合法执行合同：

- `claimMode=1` 自动领取 + `step.triggerMode=2` 事件驱动。
- `claimMode=2` 手动领取 + `step.triggerMode=1` 手动触发。

以下组合全部下线，服务端创建/更新会直接拒绝：

- `claimMode=1` 自动领取 + `step.triggerMode=1` 手动触发。
- `claimMode=2` 手动领取 + `step.triggerMode=2` 事件驱动。

事件候选任务只扫描自动领取的事件任务；即使历史库中残留
`MANUAL + EVENT`，也不会再被事件推进。手动领取、上报进度和完成链路
继续只允许 `MANUAL + MANUAL`。

### Ordering

任务展示与分页统一按以下顺序处理：

```ts
sortOrder asc, id asc
```

旧 `priority` 的“数值越大越靠前”语义已下线。

### Time zone

任务周期键和过期时间统一按应用时区计算：

- `process.env.TZ`
- 未配置时回退 `Asia/Shanghai`

旧 `repeatTimezone` 已直接删除，不保留 per-task 时区口径。

## Migration Guidance

- 本次为 hard cutover，不提供旧字段兼容层。
- 本次不保证旧 `priority` / `repeatTimezone` 数据继续保留原业务语义。
- 调用方不得再同时兼容旧字段和新字段。
- 测试与验收只面向新合同，不再以旧字段回归为目标。
- 上线前必须执行以下非法矩阵探查 SQL；tail migration 包含等价
  fail-fast 检查，发现任何非法组合都会中止，不自动改写历史数据。

```sql
-- claim_mode: 1=AUTO, 2=MANUAL
-- trigger_mode: 1=MANUAL, 2=EVENT
select
  d.id as task_id,
  d.title as task_title,
  d.status as task_status,
  d.claim_mode,
  s.id as step_id,
  s.trigger_mode,
  count(i.id) as instance_count
from task_definition d
join task_step s on s.task_id = d.id
left join task_instance i on i.task_id = d.id and i.deleted_at is null
where d.deleted_at is null
  and (
    (d.claim_mode = 1 and s.trigger_mode <> 2)
    or (d.claim_mode = 2 and s.trigger_mode <> 1)
  )
group by d.id, d.title, d.status, d.claim_mode, s.id, s.trigger_mode
order by d.id, s.id;
```

## Failure Facts

Task consumer 失败不再只写 warning，而是持久化到 `task_event_failure`。
失败事实状态为：

- `1` 待重试。
- `2` 重试中。
- `3` 已解决。
- `4` 终态失败。

新增 admin 接口：

- `GET admin/task/event-failure/page`
- `POST admin/task/event-failure/retry`
- `POST admin/task/event-failure/retry-pending/batch`

重试复用正式 task event execution path，不复制任务推进逻辑。默认最大重试
次数为 5 次。

## Admin UX

管理端任务定义表单必须联动 `claimMode` 与 `step.triggerMode`，默认界面
不能让运营选择非法矩阵。实例、对账和失败事实筛选默认使用可选择控件；
用户 ID、任务 ID、实例 ID、结算事实 ID 等内部值只能作为高级筛选入口保留。

## Notes

- 本次变更必须与 `db/schema`、tail migration、`db/comments/generated.sql`、DTO、runtime、tests 同轮一致。
- 已存在 migration 文件不再继续承载本轮新合同；正式 DDL 仅收口到新的 tail migration。
