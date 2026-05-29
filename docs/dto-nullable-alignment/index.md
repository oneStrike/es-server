# DTO Nullable 字段对齐：破坏性更改

> 日期：2026-05-29
> 类型：breaking change
> 影响面：forum topic、action log、user、growth 模块

## 变更说明

DTO 中数据库 nullable 字段的类型从 `?: T` 改为 `?: T | null`，对齐 Drizzle schema 的 select 推断类型。Service 层同步移除所有 `?? undefined` 适配代码。

API 响应中，空值字段的行为从**省略字段**变为**返回 `null`**。

### 变更前

```json
{
  "id": 1,
  "title": "测试主题",
  "geoCountry": "中国"
  // geoCity、geoIsp 等空值字段不存在
}
```

### 变更后

```json
{
  "id": 1,
  "title": "测试主题",
  "geoCountry": "中国",
  "geoCity": null,
  "geoIsp": null
}
```

## 影响的 API 与字段

### Forum Topic 模块

| API | 受影响字段 |
|-----|-----------|
| 公开主题分页 | `geoCountry`、`geoProvince`、`geoCity`、`geoIsp`、`lastCommentAt` |
| 公开主题详情 | 同上 |
| 我的主题分页 | 同上 |
| 收藏列表主题详情 | 同上 |
| 后台主题详情 | `auditRole`、`auditById`、`auditReason`、`auditAt`、`geoCountry`、`geoProvince`、`geoCity`、`geoIsp`、`geoSource`、`lastCommentAt`、`lastCommentUserId`、`sensitiveWordHits` |
| 后台主题分页 | `auditReason`、`auditAt`、`lastCommentAt`、`lastCommentUserId` |

### User 模块

| API | 受影响字段 |
|-----|-----------|
| 用户中心 - 成长信息 | `levelId`、`levelName`、`levelIcon`、`levelColor` |
| 用户中心 - 登录属地 | `geoCountry`、`geoProvince`、`geoCity`、`geoIsp` |
| 用户中心 - 状态摘要 | `reason`、`until` |
| 用户中心 - 资料信息 | `signature`、`bio`、`banReason`、`banUntil` |
| 用户信息（libs 层） | `phoneNumber`、`emailAddress`、`levelId`、`avatarUrl`、`profileBackgroundImageUrl`、`signature`、`bio`、`birthDate`、`banReason`、`banUntil`、`lastLoginAt`、`lastLoginIp` |
| 登录/注册返回 | `phoneNumber`、`emailAddress`、`avatarUrl`、`profileBackgroundImageUrl`、`birthDate`、`signature`、`bio` |

### Growth 模块

| API | 受影响字段 |
|-----|-----------|
| 等级摘要 | `icon`、`color` |

## 前端影响

前端使用 `?.` 可选链访问这些字段，`null` 和 `undefined`（字段省略）在 `?.` 下行为一致，无需改动。

## 规范冲突声明

`02-controller.md` 要求 breaking change 必须提供 compat 方案与下线计划。本次修改用户明确要求"不允许存在兼容代码"，按 `AGENTS.md` 决策顺序，以用户明确需求为准，不在本次修改中保留兼容层或下线计划。

## Schema 影响声明

本次不改 `db/schema` 定义。`db/comments/generated.sql` 无需重新生成。所有变更字段在 schema 中已经是 nullable（没有 `.notNull()`），DTO 只是补齐 `| null` 使类型与 schema 对齐。

## 测试缺口记录

Forum topic 模块当前没有 `*.spec.ts` 单元测试文件。本次变更涉及 `forum-topic.service.ts` 中 20 处 `?? undefined` 移除，已通过 `pnpm type-check` 验证类型正确性。后续应补充 forum topic 模块的单元测试。

## 改动文件清单

| 文件 | 改动 |
|------|------|
| `libs/forum/src/topic/dto/forum-topic.dto.ts` | `BaseForumTopicDto` 12 个字段加 `\| null` |
| `libs/forum/src/action-log/dto/action-log.dto.ts` | `BaseForumActionLogDto` 5 个字段加 `\| null` |
| `libs/user/src/dto/user-self.dto.ts` | `UserCenterLastLoginGeoDto` 4 个字段 + `UserStatusSummaryDto` 2 个字段 + `UserCenterGrowthDto` 4 个字段加 `\| null` |
| `libs/growth/src/level-rule/dto/level-rule.dto.ts` | `BaseUserLevelRuleDto` 2 个字段加 `\| null` |
| `libs/forum/src/topic/forum-topic.service.ts` | 移除 20 处 `?? undefined` |
| `libs/user/src/user.service.ts` | 移除 13 处 `?? undefined` |
| `apps/app-api/src/modules/user/user.service.ts` | 移除 18 处 `?? undefined` |
| `apps/app-api/src/modules/auth/auth.service.ts` | 移除 7 处 `?? undefined` |
| `apps/app-api/src/modules/user/user.service.spec.ts` | 4 处断言从 `undefined` 改为 `null` |
