# Third-Party Comic Import Background Task Cutover

## Scope

- API: `POST admin/content/comic/third-party/import/confirm`
- New API: `admin/background-task/*`
- Domain: third-party comic import execution lifecycle
- Change type: 破坏性更新，无兼容层
- Controller-rule exception: 已批准破坏性切换；不得新增运行时兼容层、legacy route、响应 shim、fallback 或旧/新双路径。兼容计划只通过 PR notes、delivery notes、Swagger/API docs 与客户端迁移说明协同完成。
- Downline owner/path: owner 为漫画三方导入页的 admin client integration lane；迁移路径为 confirm-import polling migration，从 `POST admin/content/comic/third-party/import/confirm` 的同步结果读取，切换到持久化 `taskId` 并轮询 `GET admin/background-task/detail`。

## Contract Changes

`POST admin/content/comic/third-party/import/confirm` no longer returns per-work/per-chapter synchronous import results.

The endpoint now creates a generic background task and returns `BackgroundTaskDto`:

```ts
{
  taskId: string
  taskType: 'content.third-party-comic-import'
  operatorType: 1
  operatorUserId: number
  status: 1
  payload: Record<string, unknown>
  progress: Record<string, unknown>
}
```

Clients must persist `taskId`, poll `GET admin/background-task/detail` for task detail when they already hold a concrete task id, and stop expecting `ThirdPartyComicImportResultDto` from confirm. Header/global notification polling must use `GET admin/background-task/my/page`; `GET admin/background-task/page` remains the full management view and is not user-scoped.

`GET admin/background-task/my/page` is intentionally a lightweight polling contract and returns `BackgroundTaskNotificationDto[]` instead of full `BackgroundTaskDto[]`:

```ts
{
  taskId: string
  taskType: string
  status: 1 | 2 | 3 | 4 | 5 | 6 | 7
  progress: {
    percent?: number
    message?: string
  }
  updatedAt: string
}
```

The polling response does not include heavy diagnostic fields such as `payload`, `result`, `error`, `residue`, or `rollbackError`. Clients must navigate with `taskId` and read `GET admin/background-task/detail` when they need full task diagnostics.

`background_task` now records explicit operator metadata:

- `operatorType = 1` means an admin user created the task and `operatorUserId` is required.
- `operatorType = 2` means a system or historical task and `operatorUserId` must be null.
- Existing rows are migrated to `operatorType = 2` and `operatorUserId = null`; no sentinel admin user is fabricated.

Delivery notes, PR notes, Swagger/API docs, and client-facing migration notes must all name the same admin client integration lane owner/path above so rollout status remains auditable.

## Removed Semantics

- No synchronous import execution in the confirm HTTP request.
- No `ThirdPartyComicImportResultDto` response from confirm.
- No `partial_failed` confirm response. A failed background execution is rolled back and reported through background task status/error fields.
- No runtime compatibility layer, legacy route, compatibility response mapper, response shim, fallback, or dual old/new path.

## Background Task Operations

- `GET admin/background-task/page`
- `GET admin/background-task/my/page`
- `GET admin/background-task/detail`
- `POST admin/background-task/cancel`
- `POST admin/background-task/retry`

Only `SUCCESS` tasks may retain business side effects. `FAILED` and `CANCELLED` tasks must complete rollback first. If rollback cannot clean all residue, the task is reported as `ROLLBACK_FAILED`.
