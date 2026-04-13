# 2026-04-14 App 更新、用户中心与评论回复调整

## 概述

本次改动一次性收口了 3 个业务点：

- `app_update_release` 补齐更新弹窗背景图与背景位置字段。
- 用户中心汇总接口补齐当前等级图标与等级颜色。
- 评论回复相关返回统一调整为「回复主楼时不再拼接 `replyTo` 字段」。

## 详细改动

### 1. App 更新管理模块

- 数据库表 `app_update_release` 新增：
  - `popup_background_image`
  - `popup_background_position`
- 新增迁移文件：
  - `db/migration/20260414103000_app_update_popup_background/migration.sql`
- 后台版本更新 DTO 与 service 已同步支持创建、更新、详情回显。
- App 端 `app/system/update/check` 响应已同步返回：
  - `popupBackgroundImage`
  - `popupBackgroundPosition`
- 默认背景位置统一收口为 `center`，与现有公告弹窗语义保持一致。

### 2. 用户中心汇总接口

- `UserCenterDto.growth` 新增：
  - `levelIcon`
  - `levelColor`
- 共享用户域 `getLevelInfo()` 查询已补齐 `icon` 与 `color` 字段，避免 app 层自行二次查库或拼装。

### 3. 评论回复模块

- `app/comment/reply/page`
- 目标评论列表中的 `previewReplies`
- `app/comment/my/page`

以上 3 条用户侧返回链路已统一调整：

- 当回复目标是主楼评论时，不再返回 `replyTo` 字段。
- 仅当当前回复实际指向某条楼中楼回复时，才返回 `replyTo`。

这样可以避免前端在「回复主楼」场景误展示「回复某人」文案。

## 兼容性说明

- App 更新与用户中心均为新增返回字段，属于向后兼容调整。
- 评论模块属于返回语义收敛：
  - 受影响的只有「回复主楼」场景。
  - 如果前端此前依赖 `replyTo` 是否存在来决定展示「回复某人」，本次调整后行为会更符合业务语义。

## 验证记录

已执行：

```bash
pnpm test -- --runInBand --runTestsByPath apps/app-api/src/modules/user/user.service.spec.ts libs/app-content/src/update/update.service.spec.ts libs/app-content/src/update/dto/update.dto.spec.ts libs/interaction/src/comment/comment.service.spec.ts
pnpm type-check
pnpm exec prettier --check docs/changes/2026-04-14-app-update-user-center-comment-adjustments.md
```
