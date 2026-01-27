# Auth 与 User 模块 DTO 排查报告

## 1. 概述
本报告对 `apps/app-api` (C端) 和 `apps/admin-api` (管理端) 中涉及认证 (`Auth`) 和用户 (`User`) 的 DTO 进行了系统性排查。排查重点在于 DTO 定义与 Prisma 数据库模型 (`schema.prisma`) 及 API 接口契约的一致性。

## 2. 核心实体映射分析

### 2.1 AppUser (C端用户)

**关联文件：**
- **数据库模型**: `prisma/models/app/app-user.prisma` (Model: `AppUser`)
- **DTO 定义**: `apps/app-api/src/modules/auth/dto/auth.dto.ts` (Class: `BaseAppUserDto`)
- **API 接口**: `apps/app-api/src/modules/auth/auth.controller.ts`, `apps/app-api/src/modules/user/user.controller.ts`

**字段映射核对表：**

| 字段名 | 数据库类型 (Prisma) | DTO 类型 (TypeScript) | 必填性 (DB vs DTO) | 状态 | 说明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `Int` (PK) | `number` (via `BaseDto`) | Required / Required | ✅ 一致 | 继承自 `BaseDto` |
| `account` | `Int` (Unique) | `number` | Required / Required | ✅ 一致 | |
| `phone` | `String?` | `string` | **Optional / Required** | ⚠️ 不一致 | 数据库允许为空，但 DTO 标记为必填 (`required: true`) |
| `email` | `String?` | `string?` | Optional / Optional | ✅ 一致 | |
| `levelId` | `Int?` | `number?` | Optional / Optional | ✅ 一致 | |
| `nickname` | `String` | `string` | Required / Required | ✅ 一致 | |
| `password` | `String` | - | Required / - | ✅ 正常 | 响应 DTO 应排除密码 |
| `avatar` | `String?` | `string?` | Optional / Optional | ✅ 一致 | |
| `isEnabled` | `Boolean` | `boolean` | Required / Required | ✅ 一致 | |
| `gender` | `Int` | `GenderEnum` | Required / Required | ✅ 一致 | 枚举映射正常 |
| `birthDate` | `DateTime?` | `Date?` | Optional / Optional | ✅ 一致 | |
| `points` | `Int` | `number` | Required / Required | ✅ 一致 | |
| `experience` | `Int` | `number` | Required / Required | ✅ 一致 | |
| `status` | `Int` | `number` | Required / Required | ✅ 一致 | |
| `banReason` | `String?` | - | Optional / - | ⚠️ 缺失 | DTO 中缺少封禁原因字段 |
| `banUntil` | `DateTime?` | - | Optional / - | ⚠️ 缺失 | DTO 中缺少封禁截止时间字段 |
| `lastLoginAt`| `DateTime?` | `Date?` | Optional / Optional | ✅ 一致 | |
| `lastLoginIp`| `String?` | `string?` | Optional / Optional | ✅ 一致 | |
| `createdAt` | `DateTime` | `Date` (via `BaseDto`) | Required / Required | ✅ 一致 | 继承自 `BaseDto` |
| `updatedAt` | `DateTime` | `Date` (via `BaseDto`) | Required / Required | ✅ 一致 | 继承自 `BaseDto` |
| `deletedAt` | `DateTime?` | - | Optional / - | ℹ️ 忽略 | 软删除字段通常不返回给前端 |

**DTO 冗余/业务字段：**
- `isSignedIn`: `boolean` - 数据库中不存在，推测为运行时计算字段（是否今日已签到），属于正常业务扩展。

### 2.2 AdminUser (管理端用户)

**关联文件：**
- **数据库模型**: `prisma/models/admin/admin-user.prisma` (Model: `AdminUser`)
- **DTO 定义**: `apps/admin-api/src/modules/user/dto/user.dto.ts` (Class: `BaseUserDto`)
- **API 接口**: `apps/admin-api/src/modules/user/user.controller.ts`, `apps/admin-api/src/modules/auth/auth.controller.ts`

**字段映射核对表：**

| 字段名 | 数据库类型 (Prisma) | DTO 类型 (TypeScript) | 必填性 (DB vs DTO) | 状态 | 说明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `Int` (PK) | `number` (via `BaseDto`) | Required / Required | ✅ 一致 | 继承自 `BaseDto` |
| `username` | `String` (Unique) | `string` | Required / Required | ✅ 一致 | |
| `password` | `String` | - | Required / - | ✅ 正常 | 响应 DTO 应排除密码 |
| `mobile` | `String?` | `string` | **Optional / Required** | ⚠️ 不一致 | 数据库允许为空，但 DTO 标记为必填 |
| `avatar` | `String?` | `string?` | Optional / Optional | ✅ 一致 | |
| `role` | `Int` | `UserRoleEnum` | Required / Required | ✅ 一致 | 枚举映射正常 |
| `isEnabled` | `Boolean` | `boolean?` | Required / Optional | ⚠️ 不一致 | 数据库有默认值且必填，DTO 标记为可选（可能意为不传则使用默认值，作为响应体时应为必填） |
| `lastLoginAt`| `DateTime?` | `Date?` | Optional / Optional | ✅ 一致 | |
| `lastLoginIp`| `String?` | `string?` | Optional / Optional | ✅ 一致 | |
| `createdAt` | `DateTime` | `Date` (via `BaseDto`) | Required / Required | ✅ 一致 | 继承自 `BaseDto` |
| `updatedAt` | `DateTime` | `Date` (via `BaseDto`) | Required / Required | ✅ 一致 | 继承自 `BaseDto` |

**DTO 冗余/业务字段：**
- `isLocked`: `boolean` - 数据库中不存在。`AdminUser` 表中有 `isEnabled`，`BaseUserDto` 中同时存在 `isEnabled` 和 `isLocked`。需确认 `isLocked` 是否为 `!isEnabled` 的别名或者是废弃字段。

## 3. DTO 结构与使用场景梳理

### 3.1 App API (Client)
- **BaseAppUserDto** (`auth.dto.ts`):
  - **用途**: 作为基础用户信息的响应结构。
  - **问题**: 缺少封禁相关字段 (`banReason`, `banUntil`)，如果前端需要展示封禁信息，这些字段是必要的。
- **LoginDto**:
  - **用途**: 登录请求。
  - **结构**: `Pick(BaseAppUserDto, ['account'])` + `CheckVerifyCodeDto` + `password`。
  - **分析**: 结构合理，复用了 `account` 定义。
- **LoginResponseDto**:
  - **用途**: 登录成功响应。
  - **结构**: `tokens` (TokenDto) + `user` (BaseAppUserDto)。
  - **分析**: 结构标准。
- **UserDeviceDto** (`device.dto.ts`):
  - **用途**: 展示登录设备列表。
  - **分析**: 字段完整，包含 `id`, `jti`, `deviceInfo`, `ipAddress`, `lastUsedAt`。

### 3.2 Admin API (Admin)
- **BaseUserDto** (`user.dto.ts`):
  - **用途**: 管理员用户列表、详情响应。
  - **问题**: `isLocked` 字段来源不明，需确认业务逻辑。
- **UserRegisterDto**:
  - **用途**: 创建管理员。
  - **结构**: `Pick(BaseUserDto, ['username', 'mobile', 'avatar', 'role'])` + `password` + `confirmPassword`。
  - **分析**: 结构合理。
- **UpdateUserDto**:
  - **用途**: 更新管理员信息。
  - **结构**: `Pick(BaseUserDto, ['id', 'username', 'avatar', 'mobile', 'isEnabled', 'role'])`。
  - **分析**: 结构合理。

## 4. 发现的问题汇总与建议

1.  **必填性不一致 (Priority: Medium)**
    - **AppUser**: `phone` 在数据库中可选，在 `BaseAppUserDto` 中必填。建议确认业务逻辑：如果手机号必须绑定，则数据库定义需收紧；如果允许未绑定手机号，则 DTO 应改为可选。
    - **AdminUser**: `mobile` 在数据库中可选，在 `BaseUserDto` 中必填。建议同上。

2.  **字段缺失 (Priority: Low)**
    - **BaseAppUserDto**: 缺少 `banReason` (封禁原因) 和 `banUntil` (封禁截止时间)。建议补充这两个字段，以便在用户被封禁时前端能展示相关信息。

3.  **字段冗余/语义模糊 (Priority: Low)**
    - **BaseUserDto (Admin)**: 存在 `isLocked` 字段，且同时存在 `isEnabled`。数据库只有 `isEnabled`。需确认 `isLocked` 的取值逻辑，避免数据冗余或歧义。

4.  **类型定义建议**
    - `BaseAppUserDto` 中的 `status` 字段为 `number`，建议定义对应的 Enum (如 `UserStatusEnum`) 以提高代码可读性，就像 `gender` 使用 `GenderEnum` 一样。

## 5. 下一步行动计划
等待审核确认后，可执行以下修复：
1.  修正 DTO 中的 Optional/Required 属性以匹配数据库实际约束。
2.  在 `BaseAppUserDto` 中添加缺失的封禁字段。
3.  清理 `BaseUserDto` 中的 `isLocked` 字段或明确其计算逻辑。
4.  为 `status` 字段引入枚举类型。
