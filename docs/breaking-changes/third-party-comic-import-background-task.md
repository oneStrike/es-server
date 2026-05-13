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
  status: 1
  payload: Record<string, unknown>
  progress: Record<string, unknown>
}
```

Clients must persist `taskId`, poll `GET admin/background-task/detail` for progress, success result, cancellation, failure, and rollback error information, and stop expecting `ThirdPartyComicImportResultDto` from confirm.

Delivery notes, PR notes, Swagger/API docs, and client-facing migration notes must all name the same admin client integration lane owner/path above so rollout status remains auditable.

## Removed Semantics

- No synchronous import execution in the confirm HTTP request.
- No `ThirdPartyComicImportResultDto` response from confirm.
- No `partial_failed` confirm response. A failed background execution is rolled back and reported through background task status/error fields.
- No runtime compatibility layer, legacy route, compatibility response mapper, response shim, fallback, or dual old/new path.

## Background Task Operations

- `GET admin/background-task/page`
- `GET admin/background-task/detail`
- `POST admin/background-task/cancel`
- `POST admin/background-task/retry`

Only `SUCCESS` tasks may retain business side effects. `FAILED` and `CANCELLED` tasks must complete rollback first. If rollback cannot clean all residue, the task is reported as `ROLLBACK_FAILED`.
