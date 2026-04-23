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

## Notes

- 本次变更必须与 `db/schema`、tail migration、`db/comments/generated.sql`、DTO、runtime、tests 同轮一致。
- 已存在 migration 文件不再继续承载本轮新合同；正式 DDL 仅收口到新的 tail migration。
