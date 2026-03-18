# CONSENSUS: DTO 架构设计与重构执行规范

本文件的有效规范内容已合并到 [DTO_SPEC.md](./DTO_SPEC.md)。本文件保留用于记录当时的共识与验收口径演进。

## 1. 明确的需求描述

- **目标**：实现全项目 DTO 的“高复用、低耦合、单一事实源”。
- **标准**：任何业务字段及其基础校验（物理约束）只应定义一次。

## 2. 技术实现方案与约束

### 2.1 分层架构

- **libs 层 (Base DTO)**：
  - 定义 `BaseXxxDto` 包含实体的**全量字段**。
  - **例外情况**：如果实体仅被单个应用使用（如 `AdminUser` 目前仅在 `admin-api` 中），可以将其全量基类 DTO 放在该应用的模块目录下（如 `apps/admin-api/src/modules/admin-user/dto/admin-user.dto.ts`）。
  - **强制约束**：调整基类 DTO 时必须严格对照 Drizzle Table 定义，确保基类字段、类型与数据库表定义 100% 一致。
  - 开启 `validation: true`（默认），包含物理约束（`maxLength`, `enum`, `type`）。
  - Swagger `example` 统一使用 **ISO 8601** 格式（`2024-01-01T00:00:00.000Z`）。
- **Service 层 (Domain Logic)**：
  - 零 DTO 依赖。
  - 入参使用 `Drizzle-ORM` 推导类型。
  - **强制要求**：推导类型（如 `type User = typeof users.$inferSelect`）必须在 **`db/schema` 对应的表定义文件**中定义并导出，以确保 Schema 和 Type 的绝对同步。
- **apps 层 (App DTO)**：
  - 继承 `libs` 的 `BaseXxxDto`。
  - 使用 `PickType`, `OmitType`, `PartialType`, `IntersectionType` 进行组合。
  - 重新声明属性以覆盖差异化校验（如强密码校验）。

### 2.2 命名规范

- **基类**：`BaseXxxDto`
- **请求**：`CreateXxxDto`, `UpdateXxxDto`, `QueryXxxDto`, `XxxTargetDto`
- **响应**：`XxxResponseDto`, `XxxItemDto` (列表项), `XxxBriefDto` (简要)

## 3. 验收标准

- [ ] 所有 DTO 均继承自 `libs/platform/dto` 中的基础类。
- [x] 移除了所有手动重复定义的 `id`, `createdAt`, `updatedAt` 字段。
- [ ] Swagger 文档中的日期示例值统一。
- [ ] Service 层方法签名不直接引用 App 侧 DTO。

## 4. 集成方案

- 优先重构 `admin-user` 模块作为示范。
- 逐步推广至 `app-user`, `interaction` 等核心模块。
