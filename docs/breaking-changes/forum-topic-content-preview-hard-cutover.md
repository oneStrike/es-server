# Forum Topic Content Preview Hard Cutover

## Scope

论坛主题列表预览统一使用 `contentPreview`，不再使用旧 `contentSnippet`。`contentPreview.segments` 是列表卡片的结构化语义合同，包含普通文本、用户提及、话题标签与表情。

## New Contract

```ts
contentPreview: {
  plainText: string
  segments: Array<
    | { type: 'text'; text: string }
    | { type: 'mention'; text: string; userId: number; nickname: string }
    | {
        type: 'hashtag'
        text: string
        hashtagId: number
        slug: string
        displayName: string
      }
    | {
        type: 'emoji'
        text: string
        kind: 1 | 2
        unicodeSequence?: string
        shortcode?: string
        emojiAssetId?: number
      }
  >
}
```

## Emoji Boundary

后端只返回表情语义字段，不返回展示资源字段。`emoji` segment 不包含 `imageUrl`、`staticUrl`、`isAnimated` 或 `ariaLabel`。

- `kind=1` 表示 Unicode 表情，前端直接使用 `unicodeSequence` 或 `text` 展示。
- `kind=2` 表示自定义表情，前端使用 `shortcode` 从 emoji catalog 推导展示资源。
- `emojiAssetId` 仅在写入链路已经命中平台资源时返回，作为辅助标识；渲染主路径仍以 catalog 为准。
- catalog 查不到资源时，前端使用 `text` 兜底，例如 `:smile:`。

## Storage Model

`forum_topic.content_preview` 是写入时物化的 JSONB。历史数据在 hard cutover migration 中从 canonical `body` 重新生成语义片段；迁移不会查询或固化表情 URL。

## Frontend Migration Notes

- 列表渲染按 `segment.type` 分派。
- 不再通过正则从 `plainText` 或 `text` 中推导 `@用户`、`#话题` 或 `:shortcode:`。
- 自定义表情图片由前端 emoji catalog 缓存负责解析和更新。
- 未识别或资源缺失的 segment 使用 `segment.text` 展示。
