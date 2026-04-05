# DTO / COMMENT 规范整改报告（2026-04-06）

## 依据

- `.trae/rules/DTO_SPEC.md`
- `.trae/rules/COMMENT_SPEC.md`

## 本次改造目标

本次继续处理上一轮遗留的“无歧义、可直接落地”的整改项，重点补齐：

- `apps/admin-api` 中剩余业务 DTO 下沉到 `libs/*`
- `apps/admin-api` 中与 DTO 同构的 `*.type.ts` 镜像输入类型删除
- controller / service 公开签名与 `libs/*` DTO 对齐
- `COMMENT_SPEC` 下已明确指出的热点问题补齐

## 已完成的整改

### 1. admin-api 业务 DTO / type 全量清空

本次已删除以下入口层 DTO / type：

- `apps/admin-api/src/modules/admin-user/dto/admin-user.dto.ts`
- `apps/admin-api/src/modules/admin-user/admin-user.type.ts`
- `apps/admin-api/src/modules/app-user/dto/app-user.dto.ts`
- `apps/admin-api/src/modules/app-user/app-user.type.ts`
- `apps/admin-api/src/modules/auth/dto/auth.dto.ts`
- `apps/admin-api/src/modules/auth/auth.type.ts`
- `apps/admin-api/src/modules/comment/dto/comment.dto.ts`
- `apps/admin-api/src/modules/content/comic/chapter-content/dto/chapter-content.dto.ts`
- `apps/admin-api/src/modules/content/comic/core/dto/comic.dto.ts`
- `apps/admin-api/src/modules/content/comic/third-party/dto/third-party.dto.ts`
- `apps/admin-api/src/modules/content/comic/third-party/third-party.type.ts`
- `apps/admin-api/src/modules/content/novel/dto/novel-content.dto.ts`
- `apps/admin-api/src/modules/forum/search/dto/search.dto.ts`
- `apps/admin-api/src/modules/forum/sensitive-word/dto/sensitive-word.dto.ts`
- `apps/admin-api/src/modules/forum/sensitive-word/dto/sensitive-word-statistics.dto.ts`
- `apps/admin-api/src/modules/forum/sensitive-word/dto/sensitive-word-detect.dto.ts`
- `apps/admin-api/src/modules/forum/tag/dto/forum-tag-response.dto.ts`
- `apps/admin-api/src/modules/forum/topic/dto/forum-topic.dto.ts`
- `apps/admin-api/src/modules/growth/dto/growth.dto.ts`
- `apps/admin-api/src/modules/growth/growth.type.ts`
- `apps/admin-api/src/modules/growth/experience/dto/experience-response.dto.ts`
- `apps/admin-api/src/modules/message/dto/message-monitor.dto.ts`
- `apps/admin-api/src/modules/message/message-monitor.type.ts`
- `apps/admin-api/src/modules/message/dto/message-template.dto.ts`
- `apps/admin-api/src/modules/system/audit/dto/audit.dto.ts`
- `apps/admin-api/src/modules/system/audit/audit.type.ts`
- `apps/admin-api/src/modules/task/dto/task.dto.ts`

### 2. 新增 / 收口到 libs 的契约文件

本次新增的集中 DTO 文件：

- `libs/identity/src/dto/admin-user.dto.ts`
- `libs/identity/src/dto/admin-auth.dto.ts`
- `libs/user/src/dto/admin-app-user.dto.ts`
- `libs/message/src/monitor/dto/message-monitor.dto.ts`
- `libs/growth/src/growth/dto/growth.dto.ts`
- `libs/platform/src/modules/audit/audit.constant.ts`
- `libs/platform/src/modules/audit/dto/audit.dto.ts`
- `libs/content/src/work/content/dto/content.dto.ts`

本次并回已有领域 DTO 文件的管理端响应模型：

- `libs/interaction/src/comment/dto/comment.dto.ts`
- `libs/forum/src/topic/dto/forum-topic.dto.ts`
- `libs/forum/src/tag/dto/forum-tag.dto.ts`
- `libs/growth/src/task/dto/task.dto.ts`
- `libs/growth/src/experience/dto/experience-record.dto.ts`
- `libs/message/src/notification/dto/notification-template.dto.ts`
- `libs/moderation/sensitive-word/src/dto/sensitive-word.dto.ts`

### 3. controller / service 契约对齐

已完成以下链路的 controller / service 公开签名收口：

- `AdminUserController` / `AdminUserService`
- `AuthController` / `AuthService`
- `AppUserController` / `AppUserService`
- `MessageController` / `MessageMonitorService`
- `AuditController` / `AuditService`
- `GrowthController` / `GrowthService`
- `NovelContentController` / `NovelContentService`
- `ChapterContentController` / `ComicContentService` / `ComicArchiveImportService`
- `ComicThirdPartyController` / `ComicThirdPartyService` / `CopyService`

其中：

- `AdminUserService.register()` 已改为直接接收 `UserRegisterDto`，并显式校验 `confirmPassword`
- `AuthService.login/logout/refreshToken()` 已改为直接接收 DTO
- `AppUserService` 公开方法已不再依赖入口层镜像 `Input`
- `SensitiveWordService` / `SensitiveWordDetectService` / `SensitiveWordStatisticsService` 已改为直接消费 / 返回 DTO

### 4. COMMENT_SPEC 已处理项

本次补齐了前序明确指出的热点：

- `libs/message/src/notification/notification-websocket.service.ts`
  - 补齐 WebSocket 服务的方法级注释
- `libs/interaction/src/follow/resolver/user-follow.resolver.ts`
  - 补齐 resolver 方法级注释
- `libs/platform/src/modules/upload/upload.types.ts`
  - 补齐稳定导出类型注释

同时延续上一轮结果：

- `apps/*`、`libs/*`、`db/*`、`scripts/*` 下未再命中 `TODO/FIXME`
- 未再命中“注释掉旧逻辑”类明确违规

## 当前结果

- `apps/app-api/src/modules` 下业务 DTO 文件数：`0`
- `apps/admin-api/src/modules` 下业务 DTO 文件数：`0`
- `apps/admin-api/src/modules` 下镜像 `*.type.ts` 文件数：`0`
- `libs/*` 下 `*public.dto.ts` 文件数：`0`
- `apps/*`、`libs/*`、`db/*`、`scripts/*` 下 `TODO/FIXME`：`0`

## 验证结果

已执行并通过：

```bash
pnpm exec tsc -p apps/app-api/tsconfig.app.json --noEmit --pretty false
pnpm exec tsc -p apps/admin-api/tsconfig.app.json --noEmit --pretty false
pnpm type-check
pnpm exec eslint <当前变更过的全部 .ts 文件>
```

## 说明

本次已完成 DTO 侧剩余的无歧义整改，并补齐了 COMMENT_SPEC 中此前明确点名的热点文件与硬违规项。

如果后续要继续按最严格口径推进 `COMMENT_SPEC`，仍可以再单独开启一轮“全仓 Service / Resolver / Helper 方法级注释补齐”专项；那会是一次明显更大、以文档化为主的批量改造，不属于本次 DTO 收口的直接依赖项。
