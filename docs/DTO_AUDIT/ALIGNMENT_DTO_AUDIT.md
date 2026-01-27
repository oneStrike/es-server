# DTO 审计与排查任务对齐文档 (ALIGNMENT_DTO_AUDIT)

## 1. 项目上下文分析

### 1.1 项目结构
本项目基于 NestJS 框架，采用 Monorepo 结构，主要包含两个应用端：
- **App API (`apps/app-api`)**: 面向终端用户的 API 服务。
- **Admin API (`apps/admin-api`)**: 面向管理员的后台管理 API 服务。
- **Shared Libs (`libs/base`)**: 共享的基础模块、DTO、装饰器和 Prisma 客户端。

### 1.2 数据持久化
项目使用 Prisma ORM 进行数据持久化，数据库模型定义在 `prisma/models` 目录下，主要涉及：
- **AppUser (`app_user`)**: 终端用户表。
- **AdminUser (`admin_user`)**: 管理员用户表。

### 1.3 核心模块
本次排查重点关注以下模块：
- `apps/app-api/src/modules/auth`
- `apps/app-api/src/modules/user` (实际上复用了 auth 模块的 DTO)
- `apps/admin-api/src/modules/auth`
- `apps/admin-api/src/modules/user`

## 2. 需求理解与确认

### 2.1 任务目标
全面排查项目中所有与认证 (`auth`) 和用户 (`user`) 相关的 DTO，确保其与数据库表结构及 API 接口契约的一致性。

### 2.2 任务范围
- **识别**: 找出所有相关 DTO 文件。
- **核对**:
  - DTO vs DB: 字段名、类型、可空性、遗漏、冗余。
  - DTO vs API: 接口契约、验证规则 (`class-validator`)、响应完整性。
- **梳理**: DTO 继承关系和使用场景。
- **产出**: 详细的排查报告。

### 2.3 约束条件
- **只读**: 在未经确认前，不得修改任何代码。
- **交付**: 生成结构清晰的排查报告。

## 3. 智能决策策略

### 3.1 DTO 继承分析
项目使用了基类 `BaseDto` (位于 `libs/base/src/dto/base.dto.ts`)，包含 `id`, `createdAt`, `updatedAt`。所有主要 DTO 均继承自此基类，因此默认包含这些字段。

### 3.2 字段映射标准
- **密码字段**: DTO 中用于响应的类必须排除密码字段。
- **敏感信息**: 手机号、邮箱等敏感信息在某些场景下可能需要脱敏（当前任务主要关注字段存在性，脱敏策略暂不作为“缺失字段”报错，但可作为优化建议）。
- **计算字段**: DTO 中可能存在数据库中没有的计算字段（如 `isSignedIn`），需标记为“业务字段”而非“冗余字段”。

## 4. 最终共识
我们将生成一份详细的报告 `docs/DTO_AUDIT/REPORT.md`，列出所有发现的问题和不一致点。此文档将作为后续修复工作的依据。
