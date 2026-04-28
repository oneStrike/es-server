# Forum Topic / Comment Body Contract Breaking Change

## Scope

- API:
  - `POST app/forum/topic/create`
  - `POST app/forum/topic/update`
  - `POST app/comment/post`
  - `POST app/comment/reply`
  - 相关 topic/comment detail / page 读取模型
- Domain:
  - forum topic 正文
  - 全站 comment 正文
- Change type:
  - 破坏性更新，无运行时代码兼容层

## What Changed

正文模型从旧版：

```ts
{
  content: string
  mentions: MentionDraft[]
  bodyTokens?: JsonValue
}
```

切换为新版：

```ts
{
  body: BodyDoc
  bodyVersion: 1
  content: string // 由 body 派生的纯文本
  bodyTokens?: JsonValue // 由 body 派生的缓存
}
```

## Write Contract Changes

### Topic

旧写入：

```ts
{
  title?: string
  content: string
  mentions: MentionDraft[]
  images?: string[]
  videos?: JsonValue
}
```

新写入：

```ts
{
  title?: string
  bodyMode: 'plain' | 'rich'
  plainText?: string
  body?: BodyDoc
  mentions?: MentionDraft[]
  images?: string[]
  videos?: JsonValue
}
```

说明：

- `bodyMode=plain` 时必须传 `plainText`
- `bodyMode=plain` 时必须显式传 `mentions`；无提及时传空数组
- `bodyMode=rich` 时必须传 `body`
- 运行时不再自动猜测输入字符串是不是富文本
- `bodyMode=rich` 继续直接以 `body` 中的 `mentionUser` 节点表达提及事实

### Comment

旧写入：

```ts
{
  content: string
  mentions: MentionDraft[]
}
```

新写入：

```ts
{
  content: string
  mentions: MentionDraft[]
}
```

说明：

- comment 仍以纯文本输入
- 服务端内部会把 `content` 包装成 canonical comment body
- `mentions` 继续作为 plain 输入的显式提及元数据；无提及时传空数组

## Read Contract Changes

- topic/comment 的运行时正文真相源统一为 `body`
- `content` 变为派生纯文本，不再表示客户端原始输入
- `bodyTokens` 变为派生缓存，不再是正文真相源
- 当正文中的 `#话题` 被物化为正式资源时，`body` / `bodyTokens` 会出现 `forumHashtag` 节点
- 搜索、snippet、标题回退、mention fact、emoji recent 等链路统一吃 `body` 派生结果

## New Canonical Body Model

### Comment v1

允许节点：

- `doc`
- `paragraph`
- `text`
- `hardBreak`
- `mentionUser`
- `emojiUnicode`
- `emojiCustom`
- `forumHashtag`（仅 forum topic comment 场景会出现）

### Topic v1

允许节点：

- `doc`
- `paragraph`
- `heading`
- `blockquote`
- `bulletList`
- `orderedList`
- `listItem`
- `text`
- `hardBreak`
- `mentionUser`
- `emojiUnicode`
- `emojiCustom`
- `forumHashtag`
- `bold` / `italic` / `underline` / `link`

说明：

- `topic` 的 `images/videos` 本轮仍在正文外存储，不进入 body block 节点

## Historical Data Migration

- 历史 `forum_topic` 与全表 `user_comment` 必须在 cutover 前通过数据库 migration 刷写到新模型
- 不再提供 `db:backfill:*` 脚本，也不保留运行时 / helper 回放旧正文的路径
- 运行时代码中不保留 `body is null` 的 legacy 兼容分支
- 历史回填只依赖数据库 migration 中可直接执行的 SQL；若后续需要更细的旧数据清洗，必须继续通过新 migration 追加，不再回退到脚本 backfill

## Removed Runtime Behaviors

- 运行时基于字符串自动识别 HTML / JSON 富文本的主链路行为
- 运行时 `body is null` / legacy `content` fallback 的混合读法

## Migration Guidance

### Topic writers

旧：

```ts
{
  content,
  mentions,
}
```

新：

```ts
{
  bodyMode,
  plainText?,
  body?,
  mentions?, // 仅 bodyMode=plain 时显式提供；无提及时传空数组
}
```

### Comment writers

旧：

```ts
{
  content,
  mentions,
}
```

新：

```ts
{
  content,
  mentions, // 显式提及元数据；无提及时传空数组
}
```

### Topic / comment readers

旧：

```ts
{
  content,
  bodyTokens,
}
```

新：

```ts
{
  body,
  content,
  bodyTokens,
}
```

说明：

- `body` 是正文真相源
- `content` 只表示派生纯文本
- `bodyTokens` 只表示派生缓存

## Notes

- 本次为破坏性更新，不提供运行时代码兼容层。
- 所有历史 topic/comment row 必须在上线前刷写完成。
- 若后续需要正文内媒体节点，应在未来 `bodyVersion > 1` 单独扩展。
