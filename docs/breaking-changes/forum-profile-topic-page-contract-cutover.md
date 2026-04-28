# Forum Profile Topic Page Contract Cutover

## Scope

- API:
  - `GET app/forum/topic/user/page`
  - `GET app/forum/topic/my/page`
- Domain:
  - forum 用户主页主题列表
  - forum 我的主题管理列表
- Change type:
  - 破坏性更新，无兼容入口

## What Changed

旧版 `app/forum/topic/user/page` 混合承载两套语义：

- `query.userId` 为空时，返回“我的全部未删除主题”
- `query.userId` 有值时，返回“指定用户的主题”

这会把“自助管理视图”和“公开用户主页视图”混在同一个 contract 中，导致他人主页链路绕过公开主题可见性约束。

新版拆成两个独立接口：

- `GET app/forum/topic/user/page`
  - 只承载“指定用户的公开主题页”
  - 必传 `userId`
  - 允许匿名访问
  - 只返回 `auditStatus=APPROVED`、`isHidden=false`、且当前查看者可访问板块内的主题
- `GET app/forum/topic/my/page`
  - 只承载“我的全部未删除主题”
  - 不再接收 `userId`
  - 需要登录
  - 返回治理字段 `auditStatus`

## Read Contract Changes

### Old

`GET app/forum/topic/user/page`

```ts
{
  userId?: number
  sectionId?: number
  pageIndex?: number
  pageSize?: number
}
```

返回体混合“公开主题列表字段”与“我的主题治理字段”：

```ts
{
  list: Array<PublicForumTopicPageItem & { auditStatus: AuditStatusEnum }>
}
```

### New

公开用户主题页：

```ts
GET app/forum/topic/user/page
{
  userId: number
  sectionId?: number
  pageIndex?: number
  pageSize?: number
}
```

返回：

```ts
{
  list: PublicForumTopicPageItem[]
}
```

我的主题页：

```ts
GET app/forum/topic/my/page
{
  sectionId?: number
  pageIndex?: number
  pageSize?: number
}
```

返回：

```ts
{
  list: Array<PublicForumTopicPageItem & { auditStatus: AuditStatusEnum }>
}
```

## Visibility Rules

- `user/page` 严格复用公开主题链路可见性：
  - 主题必须 `auditStatus=APPROVED`
  - 主题必须 `isHidden=false`
  - 主题板块必须对当前查看者可访问
- `my/page` 不复用公开可见性过滤，只保留 `deletedAt is null`

## Migration Guidance

### Public profile topic readers

旧调用：

```ts
GET app/forum/topic/user/page?userId=9
```

新调用：

```ts
GET app/forum/topic/user/page?userId=9
```

说明：

- `userId` 改为必传
- 返回体不再包含 `auditStatus`

### Self topic readers

旧调用：

```ts
GET app/forum/topic/user/page
```

新调用：

```ts
GET app/forum/topic/my/page
```

说明：

- 不再通过 `user/page` 空参隐式表示“我自己”
- 若客户端仍调用旧空参模式，会拿到 DTO 校验失败

## Removed Runtime Behaviors

- `app/forum/topic/user/page` 空 `userId` 时隐式回退到当前登录用户
- 单个接口同时承载“公开用户主页视图”和“我的主题管理视图”
