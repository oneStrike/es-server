# DTO / COMMENT 规范整改报告（2026-04-05）

## 依据

- `.trae/rules/DTO_SPEC.md`
- `.trae/rules/COMMENT_SPEC.md`

## 本次改造范围

本次只处理“无歧义、可直接落地”的整改项，重点覆盖：

- `apps/app-api` 中遗留的业务场景 DTO 下沉到 `libs/*`
- `apps/app-api` 中与 DTO 同构的 `auth.type.ts`、`user.type.ts` 镜像输入类型删除
- app/public 公开响应中会泄露后台字段的契约收紧
- `COMMENT_SPEC` 下明确违规的注释掉旧代码清理

## 已完成的整改

### 1. app-api 业务 DTO 全量下沉

已删除以下 app 层 DTO / type 文件：

- `apps/app-api/src/modules/auth/dto/auth.dto.ts`
- `apps/app-api/src/modules/auth/auth.type.ts`
- `apps/app-api/src/modules/comment/dto/comment.dto.ts`
- `apps/app-api/src/modules/emoji/dto/emoji.dto.ts`
- `apps/app-api/src/modules/favorite/dto/favorite.dto.ts`
- `apps/app-api/src/modules/follow/dto/follow.dto.ts`
- `apps/app-api/src/modules/forum/dto/forum-section.dto.ts`
- `apps/app-api/src/modules/forum/dto/forum-section-group.dto.ts`
- `apps/app-api/src/modules/like/dto/like.dto.ts`
- `apps/app-api/src/modules/message/dto/message.dto.ts`
- `apps/app-api/src/modules/task/dto/task.dto.ts`
- `apps/app-api/src/modules/user/dto/user.dto.ts`
- `apps/app-api/src/modules/user/dto/user-point.dto.ts`
- `apps/app-api/src/modules/user/user.type.ts`
- `apps/app-api/src/modules/work/dto/work.dto.ts`
- `apps/app-api/src/modules/work/dto/work-chapter.dto.ts`

对应 DTO 已下沉到以下 libs 目录：

- `libs/platform/src/modules/auth/dto/auth-scene.dto.ts`
- `libs/interaction/src/comment/dto/comment.dto.ts`
- `libs/interaction/src/emoji/dto/emoji.dto.ts`
- `libs/interaction/src/favorite/dto/favorite.dto.ts`
- `libs/interaction/src/follow/dto/follow.dto.ts`
- `libs/forum/src/section/dto/forum-section.dto.ts`
- `libs/forum/src/section-group/dto/forum-section-group.dto.ts`
- `libs/interaction/src/like/dto/like.dto.ts`
- `libs/growth/src/task/dto/task.dto.ts`
- `libs/message/src/chat/dto/chat.dto.ts`
- `libs/message/src/notification/dto/notification.dto.ts`
- `libs/message/src/inbox/dto/inbox.dto.ts`
- `libs/user/src/dto/user-self.dto.ts`
- `libs/content/src/work/core/dto/work.dto.ts`
- `libs/content/src/work/chapter/dto/work-chapter.dto.ts`

同时已补齐各自 `index.ts` 导出，controller 全部改为直接消费 `libs/*` 契约；原先新增的 `*.public.dto.ts` 已全部并回对应 schema DTO 文件，不再保留额外 public 文件。

### 2. Service 公开方法与 DTO 对齐

已收敛的典型链路：

- `AuthService`
  - `login/register/logout/refreshToken` 改为直接使用 libs DTO
- `PasswordService`
  - `forgotPassword/changePassword` 改为直接使用 libs DTO
- `SmsService`
  - `sendVerifyCode/validateVerifyCode` 改为直接使用 libs DTO
- `UserService`
  - `updateUserProfile/changeMyPhone/getUserPointRecords/getUserExperienceRecords/getUserBadges` 改为直接使用 libs DTO

### 3. app/public 契约收紧

已处理的公开字段泄露点：

- 评论回复分页
  - `CommentService.getReplies()` 改为显式 `pick` 公开字段，不再返回审核/隐藏/敏感词等内部字段
- 作品详情
  - app/public 详情显式映射公开字段，不再透出 `remark`
  - 同时移除了公开详情中的 `recommendWeight`
  - admin 详情仍通过 `bypassVisibilityCheck` 走完整字段
- 章节详情
  - app/public 详情显式映射公开字段，不再透出 `remark`、`deletedAt`、后台挂载对象
  - 匿名访问也返回稳定的交互状态字段：`liked=false`、`downloaded=false`、`purchased=false`
  - admin 详情通过 `bypassVisibilityCheck` 保持完整字段
- 登录响应
  - 新增 `AuthUserDto`，统一登录返回的用户快照字段，避免 `BaseAppUserDto` 过宽且注册/登录返回不一致
- 无歧义内部字段排除
  - `chat` / `notification` 的 `bizKey` 已补 `contract: false`
  - `work` / `workChapter` / `forumSection` 的 `deletedAt` 已补 `contract: false`
  - 仍被后台请求或后台响应直接使用的字段未做一刀切隐藏，避免误伤 admin 契约

### 4. COMMENT_SPEC 明确违规项清理

- 已清理 `apps/admin-api/src/modules/content/comic/third-party/libs/copy.service.ts` 中注释掉的旧逻辑

## 当前阶段结果

- `apps/app-api/src/modules` 下业务 DTO 文件数：`0`
- `apps/app-api/src/modules` 下 `auth.type.ts` / `user.type.ts` 镜像输入类型：`0`
- `libs/*` 下 `*public.dto.ts` 文件数：`0`
- `apps/admin-api/src/modules` 下 DTO 文件数：`20`
- `apps/*`、`libs/*`、`db/*`、`scripts/*` 下 `TODO/FIXME/注释掉旧代码` 扫描结果：本次扫描未命中

## 验证结果

已执行并通过：

```bash
pnpm exec eslint libs/interaction/src/comment/dto/comment.dto.ts libs/content/src/work/core/dto/work.dto.ts libs/content/src/work/chapter/dto/work-chapter.dto.ts libs/forum/src/section/dto/forum-section.dto.ts libs/forum/src/section-group/dto/forum-section-group.dto.ts libs/interaction/src/emoji/dto/emoji.dto.ts libs/interaction/src/favorite/dto/favorite.dto.ts libs/interaction/src/follow/dto/follow.dto.ts libs/interaction/src/like/dto/like.dto.ts libs/growth/src/task/dto/task.dto.ts libs/message/src/chat/dto/chat.dto.ts libs/message/src/notification/dto/notification.dto.ts libs/message/src/inbox/dto/inbox.dto.ts libs/content/src/work/core/index.ts libs/content/src/work/chapter/index.ts libs/growth/src/task/index.ts libs/message/src/notification/index.ts libs/message/src/inbox/index.ts libs/message/src/chat/index.ts libs/forum/src/section-group/index.ts libs/interaction/src/emoji/index.ts libs/forum/src/section/index.ts libs/interaction/src/comment/index.ts libs/interaction/src/like/index.ts libs/interaction/src/favorite/index.ts libs/interaction/src/follow/index.ts
pnpm exec tsc -p apps/app-api/tsconfig.app.json --noEmit --pretty false
pnpm exec tsc -p apps/admin-api/tsconfig.app.json --noEmit --pretty false
pnpm type-check
```

## 仍未覆盖的后续整改面

本次没有继续展开的部分：

- `apps/admin-api` 中剩余 `20` 个 DTO 文件的下沉
- 全仓 `Service/Resolver/Helper` 方法级注释的系统性补齐
- 历史 admin/public DTO 进一步按暴露面拆分的深度收敛

这些项仍建议继续按模块批次推进，但不影响本次已完成整改的通过状态。
