# Forum Topic / Comment HTML Contract Hard Cutover

## Scope

- API:
  - `POST app/forum/topic/create`
  - `POST app/forum/topic/update`
  - `POST app/comment/post`
  - `POST app/comment/reply`
  - 相关 topic/comment detail / page 读取模型
  - admin forum topic / comment detail 读取模型
- Domain:
  - forum topic 正文
  - forum topic comment 正文
  - 周边消费链：search / profile snippet / hashtag comment page / notification excerpt
- Change type:
  - 破坏性更新
  - 无运行时代码兼容层
  - 历史数据仅通过数据库 migration 刷写

## Final Contract

### External write contract

对外写入合同统一为：

```ts
{
  html: string
}
```

说明：

- 纯文本编辑器也必须输出最小 HTML
- 不再接受 `bodyMode`
- 不再接受 `plainText`
- 不再接受 `body`
- 不再接受 `mentions`

### External read contract

对外正文返回统一为：

```ts
{
  html: string
}
```

说明：

- forum topic / comment 对外不再暴露 `body`
- forum topic / comment 对外不再暴露 `content`
- forum topic / comment 对外不再暴露 `bodyTokens`
- `contentSnippet`、`commentExcerpt` 这类 purpose-specific 摘要字段可继续保留

## Storage Model

持久化基线调整为：

```ts
{
  html: string
  content: string
  body: BodyDoc
  bodyVersion: 1
}
```

说明：

- `html`：对外唯一正文表示，同时作为回显值存储
- `content`：内部纯文本派生列，只供搜索、摘要、审核、通知摘录等链路复用
- `body`：内部 canonical 语义中间表示，不再作为外部合同暴露
- `bodyTokens`：从 `forum_topic` 与 `user_comment` 表中删除

## Why `body` Stays Internal

- HTML 是传输格式，不是后端统一语义层
- `body` 已经承接 validator / hashtag materialize / body compile 主链
- 若直接把 HTML 当唯一真相源，后端结构约束、语义演进与正文回放都会被 HTML 解析细节绑死

## Peripheral Consumer Alignment

以下链路继续依赖内部 `content`，但不再从外部 DTO 暴露 raw content：

- forum search snippet
- profile topic snippet
- forum hashtag comment page 摘要链路
- comment like / reply / mention 通知摘录
- 审核与敏感词检测链路

## Historical Data Migration

- 新增 `html` 列到 `forum_topic`、`user_comment`
- 使用 SQL migration 从已存在的 `body` 反向渲染规范化 HTML
- 同 migration 内重写 `content`
- 同 migration 内删除 `body_tokens`
- 不新增 backfill 脚本
- 不保留 `body is null`、`content fallback`、`bodyTokens fallback` 运行时兼容分支

## Removed Runtime Behaviors

- `topic` 写路径的 `bodyMode=plain|rich`
- `comment` 写路径的 `content + mentions`
- 在线写路径中对 JSON rich body 的直接接收
- topic/comment 对外 DTO 中的 `bodyTokens`
- topic/comment 对外 DTO 中把 `content` 当正文原始值的行为

## Norm Exception

- `.trae/rules/02-controller.md` 默认要求 breaking change 提供 versioning / compat 方案与下线计划
- 本次 cutover 由用户显式覆盖该要求，采用：
  - 原路由一次性硬切
  - 同版本替换 DTO 合同
  - 不提供运行时代码兼容层
  - 不保留版本化双路由

这是本轮唯一显式规范例外，其余规则仍正常遵守

## Notes

- 本次改造不触碰 chat/message 正文协议；chat 仍可继续保留自己的 `bodyTokens`
- 后续若要支持新的正文标签或媒体 block，必须在内部 `body` 语义层扩展，再决定 HTML 白名单如何映射
