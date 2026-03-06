# 互动分表改造实施说明（数据库+DTO）

## 已完成（数据库）

### 新增模型

- `prisma/models/app/user-report.prisma`
  - 新统一举报表：`user_report`

### 删除模型（旧表）

- `prisma/models/app/user-comment-report.prisma`
- `prisma/models/forum/forum-report.prisma`
- `prisma/models/work/work-comment-report.prisma`
- `prisma/models/work/work-comment.prisma`
- `prisma/models/forum/forum-reply.prisma`
- `prisma/models/forum/forum-reply-like.prisma`

### 关系清理与并表落地

- `prisma/models/app/app-user.prisma`
  - 删除旧 `WorkComment/ForumReply/ForumReplyLike/ForumReport/UserCommentReport/WorkCommentReport` 关系
  - 新增 `UserReport` 关系：
    - `userReports @relation("UserReportReporter")`
    - `handledUserReports @relation("UserReportHandler")`
- `prisma/models/work/work.prisma`
  - 删除 `comments WorkComment[]`
- `prisma/models/work/work-chapter.prisma`
  - 删除 `comments WorkComment[]`
- `prisma/models/forum/forum-topic.prisma`
  - 删除 `replies ForumReply[]`
- `prisma/models/forum/forum-notification.prisma`
  - 删除 `reply ForumReply?` 关系字段
- `prisma/models/app/user-comment.prisma`
  - 删除 `reports UserCommentReport[]`

## 已完成（DTO + 常量）

### 常量补充（按你要求放到 base constant）

- `libs/base/src/constant/report.constant.ts`
  - 新增 `ReportTargetTypeEnum`
  - 新增 `ReportTargetTypeNames`

### DTO 补充

- `libs/interaction/src/comment/dto/comment-interaction.dto.ts`
  - `BaseCommentReportDto` 增加：
    - `targetType?: ReportTargetTypeEnum`
    - `targetId?: number`
- `libs/forum/src/report/dto/forum-report.dto.ts`
  - `BaseForumReportDto` 增加：`targetType?: ReportTargetTypeEnum`
  - `CreateForumReportDto` 增加 `targetType`
  - `QueryForumReportDto` 增加 `targetType`
- `libs/content/src/work/comment/dto/work-comment.dto.ts`
  - `CreateWorkCommentReportDto` 增加：
    - `targetType?: ReportTargetTypeEnum`
    - `targetId?: number`

## 迁移命令执行结果（严格按你的要求）

已多次执行唯一允许命令：

```bash
pnpm prisma:update
```

结果：

- `prisma generate` 成功
- `prisma migrate dev` 失败，原因是当前执行环境为 non-interactive（无交互终端）
- Prisma 已识别到会删除非空表（如 `work_comment`）

因此：

- 代码层改造已完成
- 数据库真实落库步骤被 `prisma migrate dev` 的交互限制阻断

## 你本地需要执行的唯一命令

请在本地可交互终端执行：

```bash
pnpm prisma:update
```

## 后续业务代码需要改动的文件（本次按限制未改）

- `libs/interaction/src/comment/comment-interaction.service.ts`
  - 从 `prisma.userCommentReport` 切换到 `prisma.userReport`
- `libs/forum/src/report/forum-report.service.ts`
  - 从 `prisma.forumReport` 切换到 `prisma.userReport`
- `libs/content/src/work/comment/work-comment.service.ts`
  - 从 `prisma.workComment` / `prisma.workCommentReport` 切换到 `prisma.userComment` / `prisma.userReport`
- 所有依赖 Prisma 类型 `WorkComment` / `ForumReply` / `ForumReplyLike` / `ForumReport` / `UserCommentReport` 的业务文件

## 风险提示

- 旧表已在 schema 侧删除，若直接落库会删除历史数据
- 若要保留历史，需要在你允许下补一版数据迁移脚本再执行 `pnpm prisma:update`
