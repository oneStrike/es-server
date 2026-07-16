# 种子数据 Schema 对齐修复计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复 `db/seed` 种子文件中与 `db/schema` 表定义不匹配的字段问题，消除运行时失败与语义错误。

**架构：** 纯数据层修复，不涉及业务逻辑变更。按文件分 4 个独立任务，每个任务可独立提交。验证基线为 `pnpm type-check`（仓库不保留测试文件）。

**技术栈：** Drizzle ORM、TypeScript、pnpm

---

## 问题总览

| #   | 严重度          | 文件                | 问题                                                                                   |
| --- | --------------- | ------------------- | -------------------------------------------------------------------------------------- |
| 1   | 🔴 运行时失败   | `system/domain.ts`  | `sensitiveWord` fixture 含不存在的 `version` 列                                        |
| 2   | 🔴 运行时失败   | `message/domain.ts` | `userNotification` 的 `system_announcement` 类型缺少 `announcementId`，违反 CHECK 约束 |
| 3   | 🔴 静默数据丢失 | `work/domain.ts`    | `workChapter` payload 含不存在的 `content` 列，章节内容被丢弃                          |
| 4   | 🟠 逻辑错误     | `app/domain.ts`     | `forumUserActionLog` 去重查询 `actionType` 与插入值不匹配                              |
| 5   | 🟠 语义错误     | `app/domain.ts`     | `userComment`（app）3 处 `targetType` 值错误                                           |
| 6   | 🟠 语义错误     | `app/domain.ts`     | `userLike`（app）2 处 `targetType`/`sceneType` 值错误                                  |
| 7   | 🟠 语义错误     | `app/domain.ts`     | `userReport` 的 `targetType` 值错误                                                    |
| 8   | 🟠 语义错误     | `app/domain.ts`     | `taskInstance`（论坛）`status=2` 但 `completedAt=null`                                 |
| 9   | 🟠 逻辑错误     | `app/domain.ts`     | `taskEventLog` 的 `instanceStepId` 写入了 instance id 而非 step id                     |

---

## 文件结构

| 文件                                | 职责                       | 涉及任务 |
| ----------------------------------- | -------------------------- | -------- |
| `db/seed/modules/system/domain.ts`  | 系统域种子数据             | 任务 1   |
| `db/seed/modules/message/domain.ts` | 消息域种子数据             | 任务 2   |
| `db/seed/modules/work/domain.ts`    | 作品域种子数据             | 任务 3   |
| `db/seed/modules/app/domain.ts`     | App 域种子数据（活动部分） | 任务 4   |

---

## 任务 1：移除 `sensitiveWord` 的无效 `version` 字段

**文件：**

- 修改：`db/seed/modules/system/domain.ts` L106, L116

**背景：** `SENSITIVE_WORD_FIXTURES` 的两个 fixture 对象各包含 `version: 1`，但 `db/schema/moderation/sensitive-word.ts` 中 `sensitiveWord` 表没有 `version` 列。由于 insert/update 使用 `...wordFixture` 展开（L271, L279），Drizzle 会生成引用不存在列的 SQL，导致运行时报错。

- [ ] **步骤 1：移除第一个 fixture 的 `version` 字段**

将 `db/seed/modules/system/domain.ts` L98-108 的第一个 fixture：

```typescript
  {
    word: '赌博',
    replaceWord: '**',
    level: 1,
    type: 5,
    matchMode: 1,
    isEnabled: true,
    version: 1,
    remark: 'seed: 高风险违规内容',
  },
```

改为（删除 `version: 1,` 行）：

```typescript
  {
    word: '赌博',
    replaceWord: '**',
    level: 1,
    type: 5,
    matchMode: 1,
    isEnabled: true,
    remark: 'seed: 高风险违规内容',
  },
```

- [ ] **步骤 2：移除第二个 fixture 的 `version` 字段**

将 L109-119 的第二个 fixture：

```typescript
  {
    word: '诈骗',
    replaceWord: '**',
    level: 1,
    type: 5,
    matchMode: 2,
    isEnabled: true,
    version: 1,
    remark: 'seed: 诈骗场景命中词',
  },
```

改为（删除 `version: 1,` 行）：

```typescript
  {
    word: '诈骗',
    replaceWord: '**',
    level: 1,
    type: 5,
    matchMode: 2,
    isEnabled: true,
    remark: 'seed: 诈骗场景命中词',
  },
```

- [ ] **步骤 3：运行类型检查**

运行：`pnpm type-check`
预期：PASS，无新增错误

- [ ] **步骤 4：Commit**

```bash
git add db/seed/modules/system/domain.ts
git commit -m "fix(seed): remove non-existent version field from sensitiveWord fixtures"
```

---

## 任务 2：为 `system_announcement` 通知补充 `announcementId`

**文件：**

- 修改：`db/seed/modules/message/domain.ts` L371-395

**背景：** 第三个 `notificationFixtures`（L371-395）设置 `categoryKey: 'system_announcement'`，但未设置 `announcementId`。`user_notification` 表有 CHECK 约束 `user_notification_system_announcement_requires_id_chk`：当 `categoryKey = 'system_announcement'` 时 `announcementId` 必须非空。`announcement` 变量在 L264-273 查询获得，其 `id` 已用于 `payload` 和 `projectionKey`，但未映射到 `announcementId` 列。

- [ ] **步骤 1：在第三个 notification fixture 中添加 `announcementId` 字段**

将 `db/seed/modules/message/domain.ts` L371-395 的第三个 fixture：

```typescript
    {
      receiverUserId: userC.id,
      categoryKey: 'system_announcement',
      projectionKey: `announcement:notify:${announcement?.id ?? 42}:user:${userC.id}`,
      actorUserId: null,
      title: '春季版本更新公告',
      content: '系统已更新到 2026.03 seed 版本，包含完整联调数据。',
      payload: {
        object: {
          kind: 'announcement',
          id: announcement?.id ?? 42,
          title: announcement?.title ?? '春季版本更新公告',
          ...(announcement?.announcementType !== undefined
            ? { announcementType: announcement.announcementType }
            : {}),
          ...(announcement?.priorityLevel !== undefined
            ? { priorityLevel: announcement.priorityLevel }
            : {}),
          ...(announcement?.summary ? { summary: announcement.summary } : {}),
        },
      },
      isRead: false,
      readAt: null,
      expiresAt: null,
    },
```

改为（在 `categoryKey` 行后添加 `announcementId` 行）：

```typescript
    {
      receiverUserId: userC.id,
      categoryKey: 'system_announcement',
      announcementId: announcement?.id ?? null,
      projectionKey: `announcement:notify:${announcement?.id ?? 42}:user:${userC.id}`,
      actorUserId: null,
      title: '春季版本更新公告',
      content: '系统已更新到 2026.03 seed 版本，包含完整联调数据。',
      payload: {
        object: {
          kind: 'announcement',
          id: announcement?.id ?? 42,
          title: announcement?.title ?? '春季版本更新公告',
          ...(announcement?.announcementType !== undefined
            ? { announcementType: announcement.announcementType }
            : {}),
          ...(announcement?.priorityLevel !== undefined
            ? { priorityLevel: announcement.priorityLevel }
            : {}),
          ...(announcement?.summary ? { summary: announcement.summary } : {}),
        },
      },
      isRead: false,
      readAt: null,
      expiresAt: null,
    },
```

**注意：** 如果 `announcement` 为 null（公告未创建），`announcementId` 会是 `null`，仍会违反 CHECK 约束。但 seed 流程中 `seedAppCoreDomain` 先于 `seedMessageDomain` 执行，公告一定会存在。若需防御性处理，可在 fixture 构建前添加 `announcement` 存在性校验并跳过该 fixture。

- [ ] **步骤 2：运行类型检查**

运行：`pnpm type-check`
预期：PASS，无新增错误

- [ ] **步骤 3：Commit**

```bash
git add db/seed/modules/message/domain.ts
git commit -m "fix(seed): add announcementId to system_announcement notification fixture"
```

---

## 任务 3：将 `workChapter` 的 `content` 映射到类型专属内容列

**文件：**

- 修改：`db/seed/modules/work/domain.ts` L646-671

**背景：** `chapterPayload`（L646-671）包含 `content: chapterFixture.content`，但 `workChapter` schema 没有统一的 `content` 列。schema 将内容拆分为：

- `novelContentPath` varchar(1000) nullable — 小说章节（workType=2）的内容文件路径
- `comicContentManifest` jsonb nullable — 漫画章节（workType=1）的图片路径数组

CHECK 约束 `work_chapter_content_type_valid_chk` 要求：

- `workType=1`（漫画）时 `novelContentPath` 必须为 null
- `workType=2`（小说）时 `comicContentManifest` 必须为 null

另有约束：`comicContentManifest` 为 null 或 JSON 数组类型；`novelContentPath` 为 null 或非空白字符串。

当前 fixture 的 `content` 是原始文本。对于 seed 数据：

- 漫画章节（type=1）：构造图片路径数组 manifest
- 小说章节（type=2）：直接将文本存入 `novelContentPath`（虽然语义上是"文件路径"，但 seed 数据用于本地联调，直接存文本可接受）

- [ ] **步骤 1：修改 `chapterPayload`，将 `content` 替换为类型专属字段**

将 `db/seed/modules/work/domain.ts` L646-671 的 `chapterPayload`：

```typescript
const chapterPayload = {
  workId: currentWork.id,
  workType: workFixture.type,
  title: chapterFixture.title,
  subtitle: chapterFixture.subtitle,
  cover: workFixture.cover,
  description: `${workFixture.name} ${chapterFixture.title}`,
  sortOrder: chapterFixture.sortOrder,
  isPublished: chapterFixture.isPublished,
  isPreview: chapterFixture.isPreview,
  publishAt,
  viewRule: chapterFixture.viewRule,
  requiredViewLevelId: chapterFixture.viewRule === 3 ? requiredLevelId : null,
  price: chapterFixture.price,
  canDownload: true,
  canComment: true,
  content: chapterFixture.content,
  wordCount: chapterFixture.wordCount,
  viewCount: existingChapter?.viewCount ?? 0,
  likeCount: existingChapter?.likeCount ?? 0,
  commentCount: existingChapter?.commentCount ?? 0,
  purchaseCount: existingChapter?.purchaseCount ?? 0,
  downloadCount: existingChapter?.downloadCount ?? 0,
  remark: 'seed: 章节内容',
}
```

改为（移除 `content`，添加 `novelContentPath` 和 `comicContentManifest`，按 `workFixture.type` 分流）：

```typescript
const chapterPayload = {
  workId: currentWork.id,
  workType: workFixture.type,
  title: chapterFixture.title,
  subtitle: chapterFixture.subtitle,
  cover: workFixture.cover,
  description: `${workFixture.name} ${chapterFixture.title}`,
  sortOrder: chapterFixture.sortOrder,
  isPublished: chapterFixture.isPublished,
  isPreview: chapterFixture.isPreview,
  publishAt,
  viewRule: chapterFixture.viewRule,
  requiredViewLevelId: chapterFixture.viewRule === 3 ? requiredLevelId : null,
  price: chapterFixture.price,
  canDownload: true,
  canComment: true,
  novelContentPath: workFixture.type === 2 ? chapterFixture.content : null,
  comicContentManifest:
    workFixture.type === 1
      ? [
          {
            page: 1,
            url: `https://static.example.com/works/${workFixture.key}/chapters/${chapterFixture.sortOrder}/page-1.png`,
          },
        ]
      : null,
  wordCount: chapterFixture.wordCount,
  viewCount: existingChapter?.viewCount ?? 0,
  likeCount: existingChapter?.likeCount ?? 0,
  commentCount: existingChapter?.commentCount ?? 0,
  purchaseCount: existingChapter?.purchaseCount ?? 0,
  downloadCount: existingChapter?.downloadCount ?? 0,
  remark: 'seed: 章节内容',
}
```

**说明：**

- `workFixture.type === 2`（小说）时，`novelContentPath` 存原始文本，`comicContentManifest` 为 null
- `workFixture.type === 1`（漫画）时，`comicContentManifest` 存图片路径数组（每章一张占位图），`novelContentPath` 为 null
- `workFixture.key` 是 fixture 中的 `key` 字段（如 `'aot'`、`'demon-slayer'`），用于构造唯一 URL

- [ ] **步骤 2：运行类型检查**

运行：`pnpm type-check`
预期：PASS，无新增错误

- [ ] **步骤 3：Commit**

```bash
git add db/seed/modules/work/domain.ts
git commit -m "fix(seed): map workChapter content to novelContentPath/comicContentManifest"
```

---

## 任务 4：修复 App 域种子数据中的语义与逻辑错误

**文件：**

- 修改：`db/seed/modules/app/domain.ts`

本任务包含 6 个子修复，均在同一文件中。按子修复顺序执行，全部完成后统一运行类型检查和提交。

### 子修复 4a：修复 `forumUserActionLog` 去重查询的 `actionType` 不匹配

**位置：** L2448-2457

**问题：** 去重查询用 `actionType: 3`（点赞主题），但插入用 `actionType: 2`（创建评论），导致每次运行都产生重复记录。

- [ ] **步骤 1：将去重查询的 `actionType` 从 `3` 改为 `2`**

将 L2448-2457：

```typescript
const existingAction = await db.query.forumUserActionLog.findFirst({
  where: {
    AND: [
      { userId: comment.userId },
      { targetId: comment.id },
      { actionType: 3 },
    ],
  },
  columns: { id: true },
})
```

改为：

```typescript
const existingAction = await db.query.forumUserActionLog.findFirst({
  where: {
    AND: [
      { userId: comment.userId },
      { targetId: comment.id },
      { actionType: 2 },
    ],
  },
  columns: { id: true },
})
```

### 子修复 4b：修复 `userComment`（app）的 `targetType` 值

**位置：** L2312, L2323, L2355, L2366, L2398, L2408

**问题：** Schema 文档定义 `targetType`：`1=漫画作品, 2=小说作品, 3=漫画章节, 4=小说章节, 5=论坛主题, 6=评论`。当前值与目标对象不匹配。

需修改 3 处 payload 和对应的去重查询（共 6 处）：

- [ ] **步骤 1：修复章节评论的 `targetType`（L2312 查询 + L2323 payload）**

将 L2309-2319 的去重查询中 `{ targetType: 2 }` 改为 `{ targetType: 3 }`：

```typescript
const existingChapterComment = await db.query.userComment.findFirst({
  where: {
    AND: [
      { targetType: 3 },
      { targetId: aotChapterTwo.id },
      { userId: userA.id },
      { content: '第二话的节奏明显收紧，购买后继续读的体验很顺。' },
    ],
  },
  columns: { id: true, likeCount: true },
})
```

将 L2322-2337 的 `chapterCommentPayload` 中 `targetType: 2` 改为 `targetType: 3`：

```typescript
const chapterCommentPayload = {
  targetType: 3,
  targetId: aotChapterTwo.id,
  userId: userA.id,
  ...buildSeedCommentBody('第二话的节奏明显收紧，购买后继续读的体验很顺。'),
  floor: 1,
  isHidden: false,
  auditStatus: 1,
  auditById: moderatorUser.id,
  auditRole: 0,
  auditReason: 'seed: 通过',
  auditAt: addHours(SEED_TIMELINE.previousDay, 3),
  likeCount: existingChapterComment?.likeCount ?? 0,
  sensitiveWordHits: [],
  createdAt: addHours(SEED_TIMELINE.previousDay, 3),
}
```

- [ ] **步骤 2：修复论坛根评论的 `targetType`（L2355 查询 + L2366 payload）**

将 L2352-2362 的去重查询中 `{ targetType: 3 }` 改为 `{ targetType: 5 }`：

```typescript
const existingForumRootComment = await db.query.userComment.findFirst({
  where: {
    AND: [
      { targetType: 5 },
      { targetId: aotTopic.id },
      { userId: userB.id },
      { content: '我觉得第一卷就把未来冲突埋得很深。' },
    ],
  },
  columns: { id: true, likeCount: true },
})
```

将 L2365-2380 的 `forumRootCommentPayload` 中 `targetType: 3` 改为 `targetType: 5`：

```typescript
const forumRootCommentPayload = {
  targetType: 5,
  targetId: aotTopic.id,
  userId: userB.id,
  ...buildSeedCommentBody('我觉得第一卷就把未来冲突埋得很深。'),
  floor: 1,
  isHidden: false,
  auditStatus: 1,
  auditById: moderatorUser.id,
  auditRole: 0,
  auditReason: 'seed: 通过',
  auditAt: addHours(SEED_TIMELINE.previousDay, 4),
  likeCount: existingForumRootComment?.likeCount ?? 0,
  sensitiveWordHits: [],
  createdAt: addHours(SEED_TIMELINE.previousDay, 4),
}
```

- [ ] **步骤 3：修复论坛回复评论的 `targetType`（L2398 查询 + L2408 payload）**

将 L2395-2405 的去重查询中 `{ targetType: 3 }` 改为 `{ targetType: 5 }`：

```typescript
const existingForumComment = await db.query.userComment.findFirst({
  where: {
    AND: [
      { targetType: 5 },
      { targetId: aotTopic.id },
      { userId: userA.id },
      { content: '而且艾伦和调查兵团的立场差异很早就有预警。' },
    ],
  },
  columns: { id: true, likeCount: true },
})
```

将 L2407-2424 的 `forumCommentPayload` 中 `targetType: 3` 改为 `targetType: 5`：

```typescript
const forumCommentPayload = {
  targetType: 5,
  targetId: aotTopic.id,
  userId: userA.id,
  ...buildSeedCommentBody('而且艾伦和调查兵团的立场差异很早就有预警。'),
  floor: 2,
  replyToId: forumRootComment.id,
  actualReplyToId: forumRootComment.id,
  isHidden: false,
  auditStatus: 1,
  auditById: moderatorUser.id,
  auditRole: 0,
  auditReason: 'seed: 通过',
  auditAt: addHours(SEED_TIMELINE.previousDay, 5),
  likeCount: existingForumComment?.likeCount ?? 0,
  sensitiveWordHits: [],
  createdAt: addHours(SEED_TIMELINE.previousDay, 5),
}
```

### 子修复 4c：修复 `userLike`（app）的 `targetType`/`sceneType` 值

**位置：** L2474-2507

**问题：** Schema 文档定义 `targetType`：`1=漫画作品, 2=小说作品, 3=论坛主题, 4=漫画章节, 5=小说章节, 6=评论`；`sceneType`：`1=漫画作品场景, 2=小说作品场景, 3=论坛主题场景, 10=漫画章节场景, 11=小说章节场景, 12=评论场景`。

4 个 like fixture 中 fixture 2 和 fixture 4 的值与目标对象不匹配。

- [ ] **步骤 1：修复 like fixture 2（评论点赞）**

将 L2483-2490：

```typescript
    {
      targetType: 4,
      targetId: forumRootComment.id,
      sceneType: 3,
      sceneId: aotTopic.id,
      userId: userA.id,
      commentLevel: 1,
    },
```

改为（`targetType` 从 `4` 改为 `6`，`sceneType` 从 `3` 改为 `12`）：

```typescript
    {
      targetType: 6,
      targetId: forumRootComment.id,
      sceneType: 12,
      sceneId: aotTopic.id,
      userId: userA.id,
      commentLevel: 1,
    },
```

- [ ] **步骤 2：修复 like fixture 4（章节点赞）**

将 L2499-2506：

```typescript
    {
      targetType: 2,
      targetId: aotChapterTwo.id,
      sceneType: 2,
      sceneId: aotChapterTwo.id,
      userId: userA.id,
      commentLevel: null,
    },
```

改为（`targetType` 从 `2` 改为 `4`，`sceneType` 从 `2` 改为 `10`）：

```typescript
    {
      targetType: 4,
      targetId: aotChapterTwo.id,
      sceneType: 10,
      sceneId: aotChapterTwo.id,
      userId: userA.id,
      commentLevel: null,
    },
```

### 子修复 4d：修复 `userReport` 的 `targetType` 值

**位置：** L2776

**问题：** `targetType: 4`（小说章节），但目标是 `forumRootComment`（评论），应为 `6`（评论）。

- [ ] **步骤 1：将 `reportFixture` 的 `targetType` 从 `4` 改为 `6`**

将 L2774-2785：

```typescript
const reportFixture = {
  reporterId: userC.id,
  targetType: 4,
  targetId: forumRootComment.id,
  sceneType: 3,
  sceneId: aotTopic.id,
  commentLevel: 1,
  reasonType: 1,
  description: 'seed: 用于举报流程联调。',
  evidenceUrl: 'https://static.example.com/evidence/report-seed.png',
  status: 1,
}
```

改为：

```typescript
const reportFixture = {
  reporterId: userC.id,
  targetType: 6,
  targetId: forumRootComment.id,
  sceneType: 3,
  sceneId: aotTopic.id,
  commentLevel: 1,
  reasonType: 1,
  description: 'seed: 用于举报流程联调。',
  evidenceUrl: 'https://static.example.com/evidence/report-seed.png',
  status: 1,
}
```

### 子修复 4e：修复 `taskInstance`（论坛）的 `completedAt`

**位置：** L3241

**问题：** 论坛任务实例 `status: 2`（已完成）但 `completedAt: null`，语义矛盾。

- [ ] **步骤 1：为论坛任务实例设置 `completedAt`**

将 L3230-3243 的 `forumAssignmentPayload`：

```typescript
const forumAssignmentPayload = {
  taskId: forumTask.id,
  userId: userB.id,
  cycleKey: '20260320',
  status: 2,
  rewardApplicable: 1,
  rewardSettlementId: null,
  snapshotPayload: { code: forumTask.code, title: forumTask.title },
  context: { source: 'seed', topicId: whiteNightTopic.id },
  version: 1,
  claimedAt: addHours(SEED_TIMELINE.seedAt, -1),
  completedAt: null,
  expiredAt: null,
}
```

改为（`completedAt` 从 `null` 改为与 `claimedAt` 一致的时间）：

```typescript
const forumAssignmentPayload = {
  taskId: forumTask.id,
  userId: userB.id,
  cycleKey: '20260320',
  status: 2,
  rewardApplicable: 1,
  rewardSettlementId: null,
  snapshotPayload: { code: forumTask.code, title: forumTask.title },
  context: { source: 'seed', topicId: whiteNightTopic.id },
  version: 1,
  claimedAt: addHours(SEED_TIMELINE.seedAt, -1),
  completedAt: addHours(SEED_TIMELINE.seedAt, -1),
  expiredAt: null,
}
```

### 子修复 4f：修复 `taskEventLog` 的 `instanceStepId`

**位置：** L3128-3129, L3138-3198（read-chapter 部分）, L3282-3283, L3297-3316（forum 部分）

**问题：** `instanceStepId` 被设置为 `currentAssignment.id`（task_instance 的 id），而非 `task_instance_step` 的 id。根因是 `taskInstanceStep` 插入时未用 `.returning()` 捕获返回的 id。

需修改两处：read-chapter 任务（L3108-3135）和 forum 任务（L3265-3289），以及对应的 `taskEventLog` fixture 中的 `instanceStepId`。

- [ ] **步骤 1：修改 read-chapter 的 `taskInstanceStep` 插入，捕获返回的 id**

将 L3108-3135：

```typescript
if (readChapterStep) {
  const existingStep = await db.query.taskInstanceStep.findFirst({
    where: {
      AND: [
        { instanceId: currentAssignment.id },
        { stepId: readChapterStep.id },
      ],
    },
    columns: { id: true },
  })
  const stepPayload = {
    instanceId: currentAssignment.id,
    stepId: readChapterStep.id,
    status: 2,
    currentValue: 1,
    targetValue: 1,
    completedAt: addHours(SEED_TIMELINE.seedAt, -2),
    context: { chapterId: aotChapterTwo.id },
    version: 1,
  }
  if (!existingStep) {
    await db.insert(taskInstanceStep).values(stepPayload)
  } else {
    await db
      .update(taskInstanceStep)
      .set(stepPayload)
      .where(eq(taskInstanceStep.id, existingStep.id))
  }
}
```

改为（新增 `readChapterInstanceStepId` 变量，insert/update 均捕获返回 id）：

```typescript
let readChapterInstanceStepId: number | null = null
if (readChapterStep) {
  const existingStep = await db.query.taskInstanceStep.findFirst({
    where: {
      AND: [
        { instanceId: currentAssignment.id },
        { stepId: readChapterStep.id },
      ],
    },
    columns: { id: true },
  })
  const stepPayload = {
    instanceId: currentAssignment.id,
    stepId: readChapterStep.id,
    status: 2,
    currentValue: 1,
    targetValue: 1,
    completedAt: addHours(SEED_TIMELINE.seedAt, -2),
    context: { chapterId: aotChapterTwo.id },
    version: 1,
  }
  if (!existingStep) {
    const [createdStep] = await db
      .insert(taskInstanceStep)
      .values(stepPayload)
      .returning({ id: taskInstanceStep.id })
    readChapterInstanceStepId = createdStep?.id ?? null
  } else {
    await db
      .update(taskInstanceStep)
      .set(stepPayload)
      .where(eq(taskInstanceStep.id, existingStep.id))
    readChapterInstanceStepId = existingStep.id
  }
}
```

- [ ] **步骤 2：修改 read-chapter 的 `progressLogs` 中的 `instanceStepId`**

将 L3138-3198 中三处 `instanceStepId: currentAssignment.id` 改为 `instanceStepId: readChapterInstanceStepId`。

具体将 L3143:

```typescript
        instanceStepId: currentAssignment.id,
```

改为：

```typescript
        instanceStepId: readChapterInstanceStepId,
```

将 L3162 同样改为：

```typescript
        instanceStepId: readChapterInstanceStepId,
```

将 L3183 同样改为：

```typescript
        instanceStepId: readChapterInstanceStepId,
```

- [ ] **步骤 3：修改 forum 的 `taskInstanceStep` 插入，捕获返回的 id**

将 L3265-3289：

```typescript
if (forumStep) {
  const existingStep = await db.query.taskInstanceStep.findFirst({
    where: {
      AND: [{ instanceId: currentAssignment.id }, { stepId: forumStep.id }],
    },
    columns: { id: true },
  })
  const stepPayload = {
    instanceId: currentAssignment.id,
    stepId: forumStep.id,
    status: 0,
    currentValue: 0,
    targetValue: 1,
    completedAt: null,
    context: { topicId: whiteNightTopic.id },
    version: 1,
  }
  if (!existingStep) {
    await db.insert(taskInstanceStep).values(stepPayload)
  } else {
    await db
      .update(taskInstanceStep)
      .set(stepPayload)
      .where(eq(taskInstanceStep.id, existingStep.id))
  }
}
```

改为（新增 `forumInstanceStepId` 变量）：

```typescript
let forumInstanceStepId: number | null = null
if (forumStep) {
  const existingStep = await db.query.taskInstanceStep.findFirst({
    where: {
      AND: [{ instanceId: currentAssignment.id }, { stepId: forumStep.id }],
    },
    columns: { id: true },
  })
  const stepPayload = {
    instanceId: currentAssignment.id,
    stepId: forumStep.id,
    status: 0,
    currentValue: 0,
    targetValue: 1,
    completedAt: null,
    context: { topicId: whiteNightTopic.id },
    version: 1,
  }
  if (!existingStep) {
    const [createdStep] = await db
      .insert(taskInstanceStep)
      .values(stepPayload)
      .returning({ id: taskInstanceStep.id })
    forumInstanceStepId = createdStep?.id ?? null
  } else {
    await db
      .update(taskInstanceStep)
      .set(stepPayload)
      .where(eq(taskInstanceStep.id, existingStep.id))
    forumInstanceStepId = existingStep.id
  }
}
```

- [ ] **步骤 4：修改 forum 的 `taskEventLog` 中的 `instanceStepId`**

将 L3297-3316 中 L3302 的 `instanceStepId: currentAssignment.id` 改为 `instanceStepId: forumInstanceStepId`。

具体将 L3302:

```typescript
        instanceStepId: currentAssignment.id,
```

改为：

```typescript
        instanceStepId: forumInstanceStepId,
```

- [ ] **步骤 5：运行类型检查**

运行：`pnpm type-check`
预期：PASS，无新增错误

- [ ] **步骤 6：Commit**

```bash
git add db/seed/modules/app/domain.ts
git commit -m "fix(seed): correct targetType values, actionType dedup, completedAt and instanceStepId in app activity seed"
```

---

## 自检

### 1. 规格覆盖度

| 问题                               | 对应任务 | 覆盖 |
| ---------------------------------- | -------- | ---- |
| #1 sensitiveWord.version           | 任务 1   | ✅   |
| #2 userNotification.announcementId | 任务 2   | ✅   |
| #3 workChapter.content             | 任务 3   | ✅   |
| #4 forumUserActionLog dedup        | 任务 4a  | ✅   |
| #5 userComment targetType          | 任务 4b  | ✅   |
| #6 userLike targetType/sceneType   | 任务 4c  | ✅   |
| #7 userReport targetType           | 任务 4d  | ✅   |
| #8 taskInstance completedAt        | 任务 4e  | ✅   |
| #9 taskEventLog instanceStepId     | 任务 4f  | ✅   |

### 2. 占位符扫描

无占位符。所有步骤均包含完整的 old/new 代码块和精确行号。

### 3. 类型一致性

- `readChapterInstanceStepId` 在步骤 4f-1 定义，在步骤 4f-2 使用 — 类型一致（`number | null`）
- `forumInstanceStepId` 在步骤 4f-3 定义，在步骤 4f-4 使用 — 类型一致（`number | null`）
- `taskInstanceStep.id` 的 returning 类型为 `number`，与 `instanceStepId` 列（`integer nullable`）兼容

### 4. 未纳入本计划的问题

以下问题经评估后**不纳入本计划**，原因如下：

- **`updatedAt` NOT NULL 无 DB DEFAULT（代码库级问题）**：这是全代码库的模式（`.$onUpdate(() => new Date()).notNull()` 无 `.defaultNow()`），影响所有表而非仅种子。如果应用整体能运行，说明 Drizzle 或 DB 层有补偿机制。需单独评估，不宜在种子修复中处理。
- **`appUserCount` 关注类计数器未重建**：seed 不创建任何关注数据，关注计数器在 INSERT 时默认为 0 且无数据使其偏离 0，因此当前不影响数据正确性。
- **`forumTopic`/`userComment`（forum 模块）`...body` 展开引入非 schema 字段**：`mentionFacts`/`hashtagFacts`/`contentPreview` 被 Drizzle 静默忽略，不影响运行时，仅是代码整洁度问题。
- **`requestLog` UPDATE 覆盖 `createdAt`**：seed 重新运行时重置历史日志时间戳，语义上可接受（seed 数据不是生产数据）。
