# Interaction Module Review Result Checklist

生成时间：2026-04-15

## 审查范围

- `libs/interaction/src/interaction.module.ts`
- `libs/interaction/src/browse-log/*`
- `libs/interaction/src/comment/*`
- `libs/interaction/src/download/*`
- `libs/interaction/src/emoji/*`
- `libs/interaction/src/favorite/*`
- `libs/interaction/src/follow/*`
- `libs/interaction/src/like/*`
- `libs/interaction/src/mention/*`
- `libs/interaction/src/purchase/*`
- `libs/interaction/src/reading-state/*`
- `libs/interaction/src/report/*`
- `libs/interaction/src/user-assets/*`
- 交互模块直接依赖的关键 resolver / schema：
  - `libs/content/src/work/core/resolver/work-reading-state.resolver.ts`
  - `libs/content/src/work/chapter/resolver/*download*.ts`
  - `libs/content/src/work/chapter/resolver/*purchase*.ts`
  - `libs/forum/src/section/resolver/forum-section-follow.resolver.ts`
  - `libs/forum/src/topic/resolver/forum-topic-comment.resolver.ts`
  - `db/schema/app/user-work-reading-state.ts`
  - `db/schema/app/user-download-record.ts`
  - `db/schema/app/user-purchase-record.ts`
  - `db/schema/app/user-comment.ts`
  - `db/schema/app/user-mention.ts`
  - `db/schema/app/emoji-pack.ts`
  - `db/schema/app/emoji-asset.ts`

## 整体结论

- `interaction` 模块拆分粒度总体合理，`comment / like / favorite / follow / report / purchase / download / reading-state / emoji / mention` 的服务边界基本清晰，controller 侧也普遍保持了薄层复用。
- 主要风险不在“是否能编译”，而在三个地方：
  - 运行时注册链路存在隐蔽 bug，部分能力会在真实访问时直接炸掉。
  - 下载历史与购买历史的口径不一致，软删除后的历史展示会出现脏数据。
  - 通知与测试的边界条件没有完全补齐，现有测试基线也已经出现失配。

## 发现清单

### 1. [必须修复] 小说阅读状态解析器注册方式错误，运行时会丢失核心方法

- 位置：
  - `libs/content/src/work/core/resolver/work-reading-state.resolver.ts:38-44`
  - `libs/interaction/src/reading-state/reading-state.service.ts:80-166`
- 问题说明：
  - `onModuleInit()` 里为了复用同一 resolver 处理 `COMIC` 和 `NOVEL`，使用了：
    - `this.readingStateService.registerResolver({ ...this, workType: ContentTypeEnum.NOVEL } as any)`
  - 类实例做对象展开只会拷贝“实例自有字段”，不会拷贝原型方法；`resolveWorkSnapshots / resolveChapterSnapshot / resolveChapterSnapshots / resolveWorkInfoByChapter` 都挂在原型上。
  - 我额外用 `node -e` 做了最小验证，展开后的对象只剩下自有字段，方法类型是 `undefined`。
- 实际影响：
  - 漫画阅读状态正常，小说阅读状态在调用 `getReadingState()` / `getUserReadingHistory()` 等链路时，会在运行时命中“resolver 方法不存在”。
  - 这是线上可触发的功能性故障，不是单纯的类型或风格问题。
- 建议修复：
  - 不要用对象展开复用 class 实例。
  - 方案一：拆成两个显式 resolver。
  - 方案二：提供一个工厂方法，返回真正实现完整接口的新对象。
  - 方案三：让 `ReadingStateService` 支持一个 resolver 绑定多个 `workType`。

### 2. [必须修复] 下载历史查询没有过滤软删除作品/章节，返回口径与购买历史不一致

- 位置：
  - `libs/interaction/src/download/download.service.ts:197-226`
  - `libs/interaction/src/download/download.service.ts:277-315`
- 问题说明：
  - `getDownloadedWorks()` 与 `getDownloadedWorkChapters()` 的原生 SQL 只按 `user_download_record`、`work_chapter`、`work` 做关联，但没有像 `purchase.service.ts` 那样追加：
    - `wc.deleted_at IS NULL`
    - `w.deleted_at IS NULL`
  - 这意味着作品或章节一旦被软删除，用户的下载历史页仍会继续返回这些记录。
- 为什么这是问题：
  - 同模块里的购买历史已经明确把软删除内容排除掉，下载历史却继续暴露，用户侧会出现“已下线内容仍显示在资产页”的口径漂移。
  - 如果后续章节标题、封面被清理，前端还会拿到残缺快照。
- 建议修复：
  - 与购买历史统一，给两处下载查询补上 `wc.deleted_at IS NULL` 和 `w.deleted_at IS NULL`。
  - 如果产品确实要求保留历史快照，则应显式冻结下载快照，而不是继续 join 实时表。

### 3. [建议修改] mention 通知没有排除自己，用户可以通过自提及给自己发通知

- 位置：
  - `libs/interaction/src/mention/mention.service.ts:184-215`
  - `libs/interaction/src/mention/mention.service.ts:226-254`
- 问题说明：
  - `dispatchCommentMentionsInTx()` 和 `dispatchTopicMentionsInTx()` 会直接遍历 `receiverUserIds` 发通知，没有过滤 `receiverUserId === input.actorUserId`。
  - `replaceMentionsInTx()` 也允许把自己写入 mention 事实，只要用户存在且可用即可。
- 影响：
  - 用户在评论或主题里 `@自己` 时，会生成自己的 mention 通知。
  - 这与 `comment like / comment reply / user follow` 等通知链路里显式跳过自通知的处理方式不一致。
- 建议修复：
  - 在 dispatch 前过滤当前 actor。
  - 同时补一条“自提及不发通知、但 mention token 仍保留”的单测。

### 4. [建议修改] `comment-growth` 单测已经失配，当前 interaction 目标测试集并非全绿

- 位置：
  - `libs/interaction/src/comment/comment-growth.service.ts:16-22`
  - `libs/interaction/src/comment/comment-growth.service.spec.ts:21-27`
  - `libs/interaction/src/comment/comment-growth.service.spec.ts:53-59`
- 问题说明：
  - `CommentGrowthService.rewardCommentCreated()` 现在签名是 `(tx, params)` 两个参数。
  - 但现有 spec 仍按旧签名只传一个对象，导致 Jest 在编译测试文件时直接报 `TS2554: Expected 2 arguments, but got 1`。
- 影响：
  - 这不是“断言失败”，而是测试文件本身已经无法通过编译。
  - 说明 interaction 模块的测试基线与当前实现不同步，后续 CI 很容易被这类陈旧 spec 卡住。
- 建议修复：
  - 按新签名更新 spec。
  - 补上一个真实的 `tx` mock，并校验 `dispatchDefinedEvent` 接收到 `tx` 与 `eventEnvelope`。

## 测试覆盖与审查观察

- 已有较稳定覆盖的区域：
  - `comment.service`
  - `comment.dto`
  - `comment-like.resolver`
  - `mention.service`
  - `user-follow.resolver`
- 明显缺口：
  - `reading-state`
  - `download`
  - `purchase`
  - `report`
  - `favorite`
  - `browse-log`
  - `user-assets`
- 这次两个最高优先级问题里：
  - `reading-state` 运行时注册 bug 没有任何 spec 覆盖。
  - `download` 历史口径漂移也没有 spec 覆盖。

## 验证结果

- `pnpm type-check`
  - 结果：通过
- `pnpm test -- --runInBand --runTestsByPath libs/interaction/src/comment/comment.service.spec.ts libs/interaction/src/comment/dto/comment.dto.spec.ts libs/interaction/src/comment/resolver/comment-like.resolver.spec.ts libs/interaction/src/mention/mention.service.spec.ts libs/interaction/src/follow/resolver/user-follow.resolver.spec.ts`
  - 结果：通过（5 个 test suites，20 个 tests）
- `pnpm test -- --runInBand --runTestsByPath libs/interaction/src/comment/comment.service.spec.ts libs/interaction/src/comment/comment-growth.service.spec.ts libs/interaction/src/comment/dto/comment.dto.spec.ts libs/interaction/src/comment/resolver/comment-like.resolver.spec.ts libs/interaction/src/mention/mention.service.spec.ts libs/interaction/src/follow/resolver/user-follow.resolver.spec.ts`
  - 结果：失败
  - 失败原因：`libs/interaction/src/comment/comment-growth.service.spec.ts` 仍按旧方法签名调用 `rewardCommentCreated()`
- `node -e "class A{m(){return 1}} const a=new A(); const b={...a,x:1}; console.log(JSON.stringify({keys:Object.keys(b), hasMethod:typeof b.m}))"`
  - 结果：输出 `{\"keys\":[\"x\"],\"hasMethod\":\"undefined\"}`
  - 用途：验证第 1 条里“对象展开不会复制 class 原型方法”的运行时事实

## 建议的整改优先级

- P0：
  - 修复 `work-reading-state.resolver.ts` 的小说 resolver 注册方式。
  - 修复下载历史 SQL 的软删除过滤。
- P1：
  - 给 mention 通知补自通知过滤。
  - 修复 `comment-growth.service.spec.ts`，恢复 interaction 测试基线。
- P2：
  - 给 `reading-state / download / purchase / report / user-assets` 补最小行为测试，至少覆盖运行时注册、软删除口径、历史查询和奖励/通知边界。

## 备注

- 本次仅做代码审查与本地清单生成，没有修改 interaction 模块源码。
- 工作区中存在其他未提交改动，本清单只对本次 interaction 模块审查负责。
