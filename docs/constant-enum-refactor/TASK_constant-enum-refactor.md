# 常量与枚举重构迁移方案

> 文档版本: v1.1  
> 创建日期: 2025-03-05  
> 更新日期: 2025-03-05  
> 状态: ✅ 已完成

---

## 一、项目背景与目标

### 1.1 背景

当前项目中存在大量常量和枚举定义分散在各个模块中，存在以下问题：

1. **重复定义严重**: 相同语义的枚举在多个文件中重复定义
2. **命名规范不统一**: 部分枚举缺少 `Enum` 后缀，命名风格混用
3. **共享常量分散**: 可复用的常量未统一放置在 `libs/base` 中
4. **维护成本高**: 修改一处需要同步多处，容易遗漏

### 1.2 目标

1. 消除所有重复定义的常量和枚举
2. 将共享常量统一迁移至 `libs/base/src/constant/`
3. 统一命名规范，所有枚举添加 `Enum` 后缀
4. 保持向后兼容，通过类型别名支持旧名称过渡

### 1.3 影响范围

- **新增文件**: 3 个
- **修改文件**: 约 25 个
- **删除重复枚举**: 5 组

---

## 二、重复定义详情

### 2.1 审核状态枚举 (AuditStatus)

**重复次数**: 5 处

| 序号 | 文件路径 | 枚举名称 | 行号 |
|------|----------|----------|------|
| 1 | `libs/interaction/src/common.constant.ts` | `AuditStatus` | 56 |
| 2 | `libs/forum/src/topic/forum-topic.constant.ts` | `ForumTopicAuditStatusEnum` | 4 |
| 3 | `libs/forum/src/reply/forum-reply.constant.ts` | `ForumAuditStatusEnum` | 4 |
| 4 | `libs/content/src/work/comment/work-comment.constant.ts` | `WorkCommentAuditStatusEnum` | 2 |
| 5 | `libs/system-config/src/system-config.constant.ts` | `ContentReviewAuditStatusEnum` | 8 |

**当前定义内容**:

```typescript
// 所有 5 处定义的值完全相同
enum XxxAuditStatusEnum {
  PENDING = 0,   // 待审核
  APPROVED = 1,  // 已通过
  REJECTED = 2,  // 已拒绝
}
```

**引用分析**:

需要搜索每个枚举的使用位置，确保迁移后所有引用都能正确更新。

---

### 2.2 审核角色枚举 (AuditRole)

**重复次数**: 3 处

| 序号 | 文件路径 | 枚举名称 | 行号 |
|------|----------|----------|------|
| 1 | `libs/interaction/src/common.constant.ts` | `AuditRole` | 69 |
| 2 | `libs/forum/src/topic/forum-topic.constant.ts` | `ForumTopicAuditRoleEnum` | 16 |
| 3 | `libs/content/src/work/comment/work-comment.constant.ts` | `WorkCommentAuditRoleEnum` | 12 |

**当前定义内容**:

```typescript
// 所有 3 处定义的值完全相同
enum XxxAuditRoleEnum {
  MODERATOR = 0,  // 版主
  ADMIN = 1,      // 管理员
}
```

---

### 2.3 举报状态枚举 (ReportStatus)

**重复次数**: 3 处

| 序号 | 文件路径 | 枚举名称 | 行号 |
|------|----------|----------|------|
| 1 | `libs/interaction/src/common.constant.ts` | `ReportStatus` | 80 |
| 2 | `libs/content/src/work/comment/work-comment.constant.ts` | `WorkCommentReportStatusEnum` | 20 |
| 3 | `libs/forum/src/report/forum-report.constant.ts` | `ForumReportStatusEnum` | 16 |

**当前定义内容**:

```typescript
// 所有 3 处定义的值完全相同（字符串值）
enum XxxReportStatusEnum {
  PENDING = 'pending',     // 待处理
  PROCESSING = 'processing', // 处理中
  RESOLVED = 'resolved',   // 已解决
  REJECTED = 'rejected',   // 已拒绝
}
```

**⚠️ 注意**: 当前使用字符串值，建议迁移时改为数字值以保持与其他枚举一致。

---

### 2.4 积分/经验规则类型枚举

**重复次数**: 2 处（完全相同）

| 序号 | 文件路径 | 枚举名称 | 行号 |
|------|----------|----------|------|
| 1 | `libs/user/src/point/point.constant.ts` | `UserPointRuleTypeEnum` | 2 |
| 2 | `libs/user/src/experience/experience.constant.ts` | `UserExperienceRuleTypeEnum` | 6 |

**当前定义内容**:

```typescript
// 两个枚举的值完全相同
enum UserPointRuleTypeEnum / UserExperienceRuleTypeEnum {
  CREATE_TOPIC = 1,
  CREATE_REPLY = 2,
  TOPIC_LIKED = 3,
  REPLY_LIKED = 4,
  TOPIC_FAVORITED = 5,
  DAILY_CHECK_IN = 6,
  ADMIN = 7,
  TOPIC_VIEW = 8,
  REPORT_CREATE = 9,
  COMIC_WORK_VIEW = 101,
  COMIC_WORK_LIKE = 102,
  COMIC_WORK_FAVORITE = 103,
  COMIC_CHAPTER_READ = 111,
  COMIC_CHAPTER_LIKE = 112,
  COMIC_CHAPTER_PURCHASE = 113,
  COMIC_CHAPTER_DOWNLOAD = 114,
  COMIC_CHAPTER_EXCHANGE = 115,  // 仅积分有此值
}
```

---

### 2.5 认证常量重复

**重复次数**: 2 处

| 序号 | 文件路径 | 常量名称 |
|------|----------|----------|
| 1 | `apps/admin-api/src/modules/auth/auth.constant.ts` | `AuthConstants`, `AuthRedisKeys` |
| 2 | `apps/app-api/src/modules/auth/auth.constant.ts` | `AuthConstants`, `AuthRedisKeys` |

**当前定义内容**:

```typescript
// admin-api/src/modules/auth/auth.constant.ts
export const AuthConstants = {
  LOGIN_MAX_ATTEMPTS: 5,
  LOGIN_FAIL_TTL: 5 * 60,
  ACCOUNT_LOCK_TTL: 30 * 60,
}

export const AuthRedisKeys = {
  LOGIN_FAIL_COUNT: (id: number) => `admin:auth:login:fail:${id}`,
  LOGIN_LOCK: (id: number) => `admin:auth:login:lock:${id}`,
}

// app-api/src/modules/auth/auth.constant.ts
export const AuthConstants = {
  LOGIN_MAX_ATTEMPTS: 5,
  LOGIN_FAIL_TTL: 5 * 60,
  ACCOUNT_LOCK_TTL: 30 * 60,
}

export const AuthRedisKeys = {
  LOGIN_FAIL_COUNT: (userId: number) => `auth:login:fail:${userId}`,
  LOGIN_LOCK: (userId: number) => `auth:login:lock:${userId}`,
}
```

**差异分析**: 
- `AuthConstants` 值完全相同
- `AuthRedisKeys` 的 key 前缀不同（`admin:` vs 无前缀）

---

## 三、命名规范问题详情

### 3.1 缺少 Enum 后缀

| 文件路径 | 当前名称 | 建议名称 |
|----------|----------|----------|
| `libs/interaction/src/common.constant.ts` | `AuditStatus` | `AuditStatusEnum` |
| `libs/interaction/src/common.constant.ts` | `AuditRole` | `AuditRoleEnum` |
| `libs/interaction/src/common.constant.ts` | `ReportStatus` | `ReportStatusEnum` |
| `libs/interaction/src/common.constant.ts` | `InteractionTargetType` | `InteractionTargetTypeEnum` |
| `libs/interaction/src/common.constant.ts` | `InteractionActionType` | `InteractionActionTypeEnum` |
| `libs/interaction/src/common.constant.ts` | `TargetTypeCategory` | `TargetTypeCategoryEnum` |

### 3.2 枚举值命名风格不一致

**问题**: 枚举成员命名风格混用

| 风格 | 示例文件 | 示例值 |
|------|----------|--------|
| SCREAMING_CASE (推荐) | `TaskTypeEnum` | `NEWBIE`, `DAILY`, `ACTIVITY` |
| PascalCase (不推荐) | `UserBadgeTypeEnum` | `System`, `Achievement`, `Activity` |

**建议**: 统一使用 `SCREAMING_CASE` 风格

### 3.3 枚举值类型不一致

| 类型 | 文件示例 | 说明 |
|------|----------|------|
| 数字值 (推荐) | `AuditStatus.PENDING = 0` | 便于数据库存储和比较 |
| 字符串值 | `ReportStatus.PENDING = 'pending'` | 可读性好但不便于存储 |

**建议**: 统一使用数字值，配合名称映射表

---

## 四、迁移方案

### 4.1 新建文件清单

#### 4.1.1 `libs/base/src/constant/audit.constant.ts`

```typescript
/**
 * 审核相关常量定义
 * 统一审核状态与审核角色枚举
 */

/**
 * 审核状态枚举
 * 用于评论、主题、回复等内容的审核流程状态
 */
export enum AuditStatusEnum {
  /** 待审核 - 内容已提交，等待审核 */
  PENDING = 0,
  /** 已通过 - 审核通过，内容可见 */
  APPROVED = 1,
  /** 已拒绝 - 审核拒绝，内容不可见 */
  REJECTED = 2,
}

/**
 * 审核状态名称映射
 */
export const AuditStatusNames: Record<AuditStatusEnum, string> = {
  [AuditStatusEnum.PENDING]: '待审核',
  [AuditStatusEnum.APPROVED]: '已通过',
  [AuditStatusEnum.REJECTED]: '已拒绝',
}

/**
 * 审核角色枚举
 * 用于标识执行审核操作的角色类型
 */
export enum AuditRoleEnum {
  /** 版主 - 论坛版块管理员 */
  MODERATOR = 0,
  /** 管理员 - 系统管理员 */
  ADMIN = 1,
}

/**
 * 审核角色名称映射
 */
export const AuditRoleNames: Record<AuditRoleEnum, string> = {
  [AuditRoleEnum.MODERATOR]: '版主',
  [AuditRoleEnum.ADMIN]: '管理员',
}

// ============ 向后兼容类型别名 ============
// 以下别名用于平滑迁移，将在未来版本中移除

/** @deprecated 请使用 AuditStatusEnum */
export type ForumTopicAuditStatusEnum = AuditStatusEnum

/** @deprecated 请使用 AuditStatusEnum */
export type ForumAuditStatusEnum = AuditStatusEnum

/** @deprecated 请使用 AuditStatusEnum */
export type WorkCommentAuditStatusEnum = AuditStatusEnum

/** @deprecated 请使用 AuditStatusEnum */
export type ContentReviewAuditStatusEnum = AuditStatusEnum

/** @deprecated 请使用 AuditRoleEnum */
export type ForumTopicAuditRoleEnum = AuditRoleEnum

/** @deprecated 请使用 AuditRoleEnum */
export type WorkCommentAuditRoleEnum = AuditRoleEnum
```

#### 4.1.2 `libs/base/src/constant/report.constant.ts`

```typescript
/**
 * 举报相关常量定义
 * 统一举报状态、类型与原因枚举
 */

/**
 * 举报状态枚举
 * 用于举报记录的处理状态
 */
export enum ReportStatusEnum {
  /** 待处理 - 举报已提交，等待处理 */
  PENDING = 0,
  /** 处理中 - 举报正在处理 */
  PROCESSING = 1,
  /** 已解决 - 举报已处理完成 */
  RESOLVED = 2,
  /** 已拒绝 - 举报被驳回 */
  REJECTED = 3,
}

/**
 * 举报状态名称映射
 */
export const ReportStatusNames: Record<ReportStatusEnum, string> = {
  [ReportStatusEnum.PENDING]: '待处理',
  [ReportStatusEnum.PROCESSING]: '处理中',
  [ReportStatusEnum.RESOLVED]: '已解决',
  [ReportStatusEnum.REJECTED]: '已拒绝',
}

/**
 * 举报原因枚举
 */
export enum ReportReasonEnum {
  /** 垃圾信息 */
  SPAM = 1,
  /** 不当内容 */
  INAPPROPRIATE_CONTENT = 2,
  /** 骚扰行为 */
  HARASSMENT = 3,
  /** 版权侵权 */
  COPYRIGHT = 4,
  /** 其他原因 */
  OTHER = 5,
}

/**
 * 举报原因名称映射
 */
export const ReportReasonNames: Record<ReportReasonEnum, string> = {
  [ReportReasonEnum.SPAM]: '垃圾信息',
  [ReportReasonEnum.INAPPROPRIATE_CONTENT]: '不当内容',
  [ReportReasonEnum.HARASSMENT]: '骚扰行为',
  [ReportReasonEnum.COPYRIGHT]: '版权侵权',
  [ReportReasonEnum.OTHER]: '其他原因',
}

// ============ 向后兼容类型别名 ============

/** @deprecated 请使用 ReportStatusEnum */
export type ForumReportStatusEnum = ReportStatusEnum

/** @deprecated 请使用 ReportStatusEnum */
export type WorkCommentReportStatusEnum = ReportStatusEnum

/** @deprecated 请使用 ReportReasonEnum */
export type ForumReportReasonEnum = ReportReasonEnum
```

#### 4.1.3 `libs/base/src/constant/sort.constant.ts`

```typescript
/**
 * 排序相关常量定义
 */

/**
 * 排序顺序枚举
 */
export enum SortOrderEnum {
  /** 升序 */
  ASC = 'asc',
  /** 降序 */
  DESC = 'desc',
}

/**
 * 排序顺序名称映射
 */
export const SortOrderNames: Record<SortOrderEnum, string> = {
  [SortOrderEnum.ASC]: '升序',
  [SortOrderEnum.DESC]: '降序',
}

// ============ 向后兼容类型别名 ============

/** @deprecated 请使用 SortOrderEnum */
export type ForumReplySortOrderEnum = SortOrderEnum

/** @deprecated 请使用 SortOrderEnum */
export type WorkCommentSortOrderEnum = SortOrderEnum
```

#### 4.1.4 更新 `libs/base/src/constant/index.ts`

```typescript
export * from './audit.constant'
export * from './base.constant'
export * from './logger.constant'
export * from './report.constant'
export * from './sort.constant'
export * from './user.constant'
export * from './work-type.constant'
```

---

### 4.2 需要修改的文件清单

#### 4.2.1 libs/interaction/src/common.constant.ts

**修改前**:

```typescript
export enum AuditStatus {
  PENDING = 0,
  APPROVED = 1,
  REJECTED = 2,
}

export enum AuditRole {
  MODERATOR = 0,
  ADMIN = 1,
}

export enum ReportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}
```

**修改后**:

```typescript
// 从 libs/base 重新导出，保持向后兼容
export {
  AuditStatusEnum,
  AuditRoleEnum,
  ReportStatusEnum,
  AuditStatusNames,
  AuditRoleNames,
  ReportStatusNames,
} from '@libs/base/constant'

// 向后兼容别名
/** @deprecated 请使用 AuditStatusEnum */
export const AuditStatus = AuditStatusEnum

/** @deprecated 请使用 AuditRoleEnum */
export const AuditRole = AuditRoleEnum

/** @deprecated 请使用 ReportStatusEnum */
export const ReportStatus = ReportStatusEnum
```

#### 4.2.2 libs/forum/src/topic/forum-topic.constant.ts

**修改前**:

```typescript
export enum ForumTopicAuditStatusEnum {
  PENDING = 0,
  APPROVED = 1,
  REJECTED = 2,
}

export enum ForumTopicAuditRoleEnum {
  MODERATOR = 0,
  ADMIN = 1,
}
```

**修改后**:

```typescript
// 从 libs/base 重新导出，保持向后兼容
export {
  AuditStatusEnum as ForumTopicAuditStatusEnum,
  AuditRoleEnum as ForumTopicAuditRoleEnum,
} from '@libs/base/constant'
```

#### 4.2.3 libs/forum/src/reply/forum-reply.constant.ts

**修改前**:

```typescript
export enum ForumAuditStatusEnum {
  PENDING = 0,
  APPROVED = 1,
  REJECTED = 2,
}
```

**修改后**:

```typescript
// 从 libs/base 重新导出，保持向后兼容
export {
  AuditStatusEnum as ForumAuditStatusEnum,
  SortOrderEnum as ForumReplySortOrderEnum,
} from '@libs/base/constant'
```

#### 4.2.4 libs/content/src/work/comment/work-comment.constant.ts

**修改前**:

```typescript
export enum WorkCommentAuditStatusEnum {
  PENDING = 0,
  APPROVED = 1,
  REJECTED = 2,
}

export enum WorkCommentAuditRoleEnum {
  MODERATOR = 0,
  ADMIN = 1,
}

export enum WorkCommentReportStatusEnum {
  PENDING = 'pending',
  PROCESSING = 'processing',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}
```

**修改后**:

```typescript
// 从 libs/base 重新导出，保持向后兼容
export {
  AuditStatusEnum as WorkCommentAuditStatusEnum,
  AuditRoleEnum as WorkCommentAuditRoleEnum,
  ReportStatusEnum as WorkCommentReportStatusEnum,
  SortOrderEnum as WorkCommentSortOrderEnum,
} from '@libs/base/constant'
```

#### 4.2.5 libs/forum/src/report/forum-report.constant.ts

**修改前**:

```typescript
export enum ForumReportStatusEnum {
  PENDING = 'pending',
  PROCESSING = 'processing',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

export enum ForumReportReasonEnum {
  SPAM = 'spam',
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  HARASSMENT = 'harassment',
  COPYRIGHT = 'copyright',
  OTHER = 'other',
}
```

**修改后**:

```typescript
// 从 libs/base 重新导出，保持向后兼容
export {
  ReportStatusEnum as ForumReportStatusEnum,
  ReportReasonEnum as ForumReportReasonEnum,
} from '@libs/base/constant'
```

#### 4.2.6 libs/system-config/src/system-config.constant.ts

**修改前**:

```typescript
export enum ContentReviewAuditStatusEnum {
  PENDING = 0,
  APPROVED = 1,
  REJECTED = 2,
}
```

**修改后**:

```typescript
// 从 libs/base 重新导出，保持向后兼容
export {
  AuditStatusEnum as ContentReviewAuditStatusEnum,
} from '@libs/base/constant'
```

---

### 4.3 积分/经验规则枚举合并方案

#### 4.3.1 新建 `libs/user/src/growth-rule.constant.ts`

```typescript
/**
 * 用户成长规则类型枚举
 * 统一积分规则与经验规则的类型定义
 */

/**
 * 成长规则类型枚举
 * 同时用于积分规则和经验规则
 */
export enum GrowthRuleTypeEnum {
  // 论坛相关
  /** 发表主题 */
  CREATE_TOPIC = 1,
  /** 发表回复 */
  CREATE_REPLY = 2,
  /** 主题被点赞 */
  TOPIC_LIKED = 3,
  /** 回复被点赞 */
  REPLY_LIKED = 4,
  /** 主题被收藏 */
  TOPIC_FAVORITED = 5,
  /** 每日签到 */
  DAILY_CHECK_IN = 6,
  /** 管理员操作 */
  ADMIN = 7,
  /** 主题浏览 */
  TOPIC_VIEW = 8,
  /** 举报 */
  REPORT_CREATE = 9,

  // 漫画作品相关
  /** 漫画浏览 */
  COMIC_WORK_VIEW = 101,
  /** 漫画点赞 */
  COMIC_WORK_LIKE = 102,
  /** 漫画收藏 */
  COMIC_WORK_FAVORITE = 103,

  // 漫画章节相关
  /** 章节阅读 */
  COMIC_CHAPTER_READ = 111,
  /** 章节点赞 */
  COMIC_CHAPTER_LIKE = 112,
  /** 章节购买 */
  COMIC_CHAPTER_PURCHASE = 113,
  /** 章节下载 */
  COMIC_CHAPTER_DOWNLOAD = 114,
  /** 章节兑换 (仅积分) */
  COMIC_CHAPTER_EXCHANGE = 115,
}

/**
 * 成长规则类型名称映射
 */
export const GrowthRuleTypeNames: Record<GrowthRuleTypeEnum, string> = {
  [GrowthRuleTypeEnum.CREATE_TOPIC]: '发表主题',
  [GrowthRuleTypeEnum.CREATE_REPLY]: '发表回复',
  [GrowthRuleTypeEnum.TOPIC_LIKED]: '主题被点赞',
  [GrowthRuleTypeEnum.REPLY_LIKED]: '回复被点赞',
  [GrowthRuleTypeEnum.TOPIC_FAVORITED]: '主题被收藏',
  [GrowthRuleTypeEnum.DAILY_CHECK_IN]: '每日签到',
  [GrowthRuleTypeEnum.ADMIN]: '管理员操作',
  [GrowthRuleTypeEnum.TOPIC_VIEW]: '主题浏览',
  [GrowthRuleTypeEnum.REPORT_CREATE]: '举报',
  [GrowthRuleTypeEnum.COMIC_WORK_VIEW]: '漫画浏览',
  [GrowthRuleTypeEnum.COMIC_WORK_LIKE]: '漫画点赞',
  [GrowthRuleTypeEnum.COMIC_WORK_FAVORITE]: '漫画收藏',
  [GrowthRuleTypeEnum.COMIC_CHAPTER_READ]: '章节阅读',
  [GrowthRuleTypeEnum.COMIC_CHAPTER_LIKE]: '章节点赞',
  [GrowthRuleTypeEnum.COMIC_CHAPTER_PURCHASE]: '章节购买',
  [GrowthRuleTypeEnum.COMIC_CHAPTER_DOWNLOAD]: '章节下载',
  [GrowthRuleTypeEnum.COMIC_CHAPTER_EXCHANGE]: '章节兑换',
}

/**
 * 获取成长规则类型名称
 */
export function getGrowthRuleTypeName(type: GrowthRuleTypeEnum): string {
  return GrowthRuleTypeNames[type] ?? '未知规则'
}

// ============ 向后兼容类型别名 ============

/** @deprecated 请使用 GrowthRuleTypeEnum */
export type UserPointRuleTypeEnum = GrowthRuleTypeEnum

/** @deprecated 请使用 GrowthRuleTypeEnum */
export type UserExperienceRuleTypeEnum = GrowthRuleTypeEnum

/** @deprecated 请使用 GrowthRuleTypeNames */
export const USER_POINT_RULE_TYPE_NAMES = GrowthRuleTypeNames
```

#### 4.3.2 修改 `libs/user/src/point/point.constant.ts`

**修改后**:

```typescript
// 从 growth-rule.constant.ts 重新导出
export {
  GrowthRuleTypeEnum as UserPointRuleTypeEnum,
  GrowthRuleTypeNames as USER_POINT_RULE_TYPE_NAMES,
  getGrowthRuleTypeName as getPointRuleTypeName,
} from '../growth-rule.constant'
```

#### 4.3.3 修改 `libs/user/src/experience/experience.constant.ts`

**修改后**:

```typescript
// 从 growth-rule.constant.ts 重新导出
export {
  GrowthRuleTypeEnum as UserExperienceRuleTypeEnum,
} from '../growth-rule.constant'
```

---

### 4.4 认证常量合并方案

#### 4.4.1 修改 `libs/base/src/modules/auth/auth.constant.ts`

**新增内容**:

```typescript
/**
 * 认证通用常量
 * 覆盖令牌注销原因与错误文案
 */

/**
 * 创建认证 Redis Key 生成器
 * @param prefix - 应用前缀 (如 'admin' 或 'app')
 */
export const createAuthRedisKeys = (prefix: string) => ({
  /** 登录失败计数 Key */
  LOGIN_FAIL_COUNT: (id: number) => `${prefix}:auth:login:fail:${id}`,
  /** 账号锁定 Key */
  LOGIN_LOCK: (id: number) => `${prefix}:auth:login:lock:${id}`,
})

/**
 * 认证通用常量
 */
export const AuthConstants = {
  /** 最大登录失败尝试次数 */
  LOGIN_MAX_ATTEMPTS: 5,
  /** 失败计数过期时间（秒）：5分钟 */
  LOGIN_FAIL_TTL: 5 * 60,
  /** 账号锁定时间（秒）：30分钟 */
  ACCOUNT_LOCK_TTL: 30 * 60,
}

/**
 * 认证默认值
 */
export const AuthDefaultValue = {
  /** 未知 IP 标识 */
  IP_ADDRESS_UNKNOWN: 'unknown',
}

/**
 * 令牌注销原因枚举
 */
export enum RevokeTokenReasonEnum {
  /** 密码变更 */
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  /** 用户主动注销 */
  USER_LOGOUT = 'USER_LOGOUT',
  /** 管理员主动注销 */
  ADMIN_REVOKE = 'ADMIN_REVOKE',
  /** 安全问题答案错误 */
  SECURITY = 'SECURITY',
  /** 令牌过期 */
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
}

/**
 * 对外抛出的错误信息常量
 */
export const AuthErrorConstant = {
  /** 登录失效 */
  LOGIN_INVALID: '登录失效，请重新登录！',
  /** 账号异地登录 */
  ACCOUNT_LOGGED_IN: '账号已在其他设备登录，请重新登录！',
}
```

#### 4.4.2 修改 `apps/admin-api/src/modules/auth/auth.constant.ts`

**修改后**:

```typescript
/**
 * 管理端认证模块常量
 */
import { AuthConstants, createAuthRedisKeys } from '@libs/base/modules/auth'

export enum CacheKey {
  /** 登录验证码 Key 前缀 */
  CAPTCHA = 'admin:auth:login:captcha:',
}

// 重新导出通用常量
export { AuthConstants }

// 创建管理端专用的 Redis Keys
export const AuthRedisKeys = createAuthRedisKeys('admin')
```

#### 4.4.3 修改 `apps/app-api/src/modules/auth/auth.constant.ts`

**修改后**:

```typescript
/**
 * 应用端认证常量定义
 */
import { AuthConstants, createAuthRedisKeys, AuthDefaultValue } from '@libs/base/modules/auth'

// 重新导出通用常量
export { AuthConstants, AuthDefaultValue }

// 创建应用端专用的 Redis Keys
export const AuthRedisKeys = createAuthRedisKeys('app')

/**
 * 认证错误文案
 */
export const AuthErrorMessages = {
  /** 账号或密码错误 */
  ACCOUNT_OR_PASSWORD_ERROR: '账号或密码错误',
  /** 账号已禁用 */
  ACCOUNT_DISABLED: '账号已被禁用，请联系管理员',
  // ... 其他错误文案
} as const
```

---

## 五、迁移步骤

### 5.1 阶段一：创建新的统一枚举文件

**步骤**:

1. 创建 `libs/base/src/constant/audit.constant.ts`
2. 创建 `libs/base/src/constant/report.constant.ts`
3. 创建 `libs/base/src/constant/sort.constant.ts`
4. 更新 `libs/base/src/constant/index.ts` 导出新文件
5. 创建 `libs/user/src/growth-rule.constant.ts`
6. 更新 `libs/base/src/modules/auth/auth.constant.ts`

**验证**:
- 运行 `pnpm build` 确保编译通过
- 运行单元测试确保无破坏性变更

### 5.2 阶段二：更新引用文件

**按以下顺序逐个修改**:

1. `libs/interaction/src/common.constant.ts`
2. `libs/forum/src/topic/forum-topic.constant.ts`
3. `libs/forum/src/reply/forum-reply.constant.ts`
4. `libs/content/src/work/comment/work-comment.constant.ts`
5. `libs/forum/src/report/forum-report.constant.ts`
6. `libs/system-config/src/system-config.constant.ts`
7. `libs/user/src/point/point.constant.ts`
8. `libs/user/src/experience/experience.constant.ts`
9. `apps/admin-api/src/modules/auth/auth.constant.ts`
10. `apps/app-api/src/modules/auth/auth.constant.ts`

**每修改一个文件后**:
- 运行 `pnpm build` 确保编译通过
- 运行相关模块的单元测试

### 5.3 阶段三：更新业务代码引用

**搜索并更新所有使用旧枚举名称的地方**:

```bash
# 搜索需要更新的引用
grep -r "AuditStatus\." --include="*.ts" apps libs
grep -r "AuditRole\." --include="*.ts" apps libs
grep -r "ReportStatus\." --include="*.ts" apps libs
```

**注意**: 由于使用了向后兼容别名，现有代码无需立即修改，但建议逐步迁移到新名称。

### 5.4 阶段四：数据库迁移（如需要）

**如果举报状态从字符串改为数字**:

1. 创建数据库迁移脚本
2. 更新 Prisma schema
3. 执行数据迁移

```sql
-- 示例迁移 SQL
UPDATE forum_report SET status = 0 WHERE status = 'pending';
UPDATE forum_report SET status = 1 WHERE status = 'processing';
UPDATE forum_report SET status = 2 WHERE status = 'resolved';
UPDATE forum_report SET status = 3 WHERE status = 'rejected';
```

---

## 六、风险评估与应对

### 6.1 风险列表

| 风险 | 等级 | 影响 | 应对措施 |
|------|------|------|----------|
| 编译错误 | 中 | 构建失败 | 使用类型别名保持向后兼容 |
| 运行时错误 | 高 | 功能异常 | 充分测试，逐步发布 |
| 数据库不兼容 | 高 | 数据丢失 | 保持值不变，仅改名称 |
| 第三方依赖 | 低 | 类型不匹配 | 检查所有外部依赖引用 |

### 6.2 回滚方案

如果迁移出现问题：

1. **代码回滚**: 使用 Git 回退到迁移前的 commit
2. **类型别名保留**: 即使回滚，保留类型别名定义以支持渐进迁移
3. **数据库回滚**: 如果修改了数据库值，执行逆向迁移脚本

---

## 七、验收标准

### 7.1 功能验收

- [ ] 所有重复枚举已合并
- [ ] 所有文件编译通过 (`pnpm build`)
- [ ] 所有单元测试通过 (`pnpm test`)
- [ ] 所有 E2E 测试通过 (`pnpm test:e2e`)
- [ ] 类型检查通过 (`pnpm typecheck`)

### 7.2 代码质量验收

- [ ] ESLint 检查通过 (`pnpm lint`)
- [ ] 无 TypeScript 类型错误
- [ ] 所有枚举命名符合规范（带 Enum 后缀）
- [ ] 所有导出正确配置

### 7.3 文档验收

- [ ] 更新相关 API 文档
- [ ] 更新 CHANGELOG
- [ ] 标记废弃的类型别名

---

## 八、时间估算

| 阶段 | 任务 | 预计时间 |
|------|------|----------|
| 阶段一 | 创建新枚举文件 | 1 小时 |
| 阶段二 | 更新引用文件 | 2 小时 |
| 阶段三 | 更新业务代码 | 2 小时 |
| 阶段四 | 数据库迁移（如需要） | 1 小时 |
| 测试验证 | 全面测试 | 2 小时 |
| **总计** | | **8 小时** |

---

## 九、附录

### A. 完整文件修改清单

| 序号 | 文件路径 | 操作类型 |
|------|----------|----------|
| 1 | `libs/base/src/constant/audit.constant.ts` | 新建 |
| 2 | `libs/base/src/constant/report.constant.ts` | 新建 |
| 3 | `libs/base/src/constant/sort.constant.ts` | 新建 |
| 4 | `libs/base/src/constant/index.ts` | 修改 |
| 5 | `libs/base/src/modules/auth/auth.constant.ts` | 修改 |
| 6 | `libs/user/src/growth-rule.constant.ts` | 新建 |
| 7 | `libs/interaction/src/common.constant.ts` | 修改 |
| 8 | `libs/forum/src/topic/forum-topic.constant.ts` | 修改 |
| 9 | `libs/forum/src/reply/forum-reply.constant.ts` | 修改 |
| 10 | `libs/content/src/work/comment/work-comment.constant.ts` | 修改 |
| 11 | `libs/forum/src/report/forum-report.constant.ts` | 修改 |
| 12 | `libs/system-config/src/system-config.constant.ts` | 修改 |
| 13 | `libs/user/src/point/point.constant.ts` | 修改 |
| 14 | `libs/user/src/experience/experience.constant.ts` | 修改 |
| 15 | `apps/admin-api/src/modules/auth/auth.constant.ts` | 修改 |
| 16 | `apps/app-api/src/modules/auth/auth.constant.ts` | 修改 |

### B. 向后兼容策略

所有被废弃的类型和常量将通过以下方式保持兼容：

1. **类型别名**: 使用 `export type OldName = NewName`
2. **常量别名**: 使用 `export const OldName = NewName`
3. **JSDoc 注释**: 使用 `@deprecated` 标记废弃项

示例：
```typescript
/** @deprecated 请使用 AuditStatusEnum，此别名将在 v2.0.0 移除 */
export type AuditStatus = AuditStatusEnum
```

### C. 未来版本清理计划

在 v2.0.0 版本中：

1. 移除所有向后兼容类型别名
2. 移除所有向后兼容常量别名
3. 更新所有业务代码使用新名称
4. 清理废弃的导出
