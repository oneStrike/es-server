# ALIGNMENT: DTO 架构重构与规范化

本文件的有效规范内容已合并到 [DTO_SPEC.md](./DTO_SPEC.md)。本文件保留用于记录当时的需求对齐过程。

## 1. 原始需求
排查项目中所有 DTO 相关文件，提出优化建议并执行改造。核心要求：
- **高复用性**：字段不重复定义，利用继承和映射类型。
- **基础 DTO 复用**：充分利用 `libs/platform` 中的 `BaseDto`, `IdDto`, `PageDto`。
- **职责解耦**：libs 层定义基类，apps 层定制业务 DTO。
- **基类约束**：调整基类 DTO 时必须严格对照 Drizzle Table 定义，确保基类字段、类型与数据库表定义 100% 一致。
- **类型安全**：Service 层应尽量使用 ORM 推导类型以降低维护成本。

## 2. 边界确认
- **涉及模块**：全项目 DTO，优先重构 `admin-user`, `app-user`, `like`, `favorite` 等核心业务模块。
- **技术栈约束**：NestJS, Swagger (@nestjs/swagger), class-validator, Drizzle-ORM。
- **非目标**：不改动底层数据库 Schema，不修改现有的业务逻辑，仅重构数据传输层。

## 3. 需求理解与现状分析
- **现状**：目前 DTO 存在大量重复定义的字段（如 `id`, `createdAt`），且 libs 层 DTO 与 apps 层 DTO 职责边界模糊。
- **挑战**：重构时需确保 Swagger 文档不丢失描述信息，且 class-validator 的校验逻辑在继承后依然生效。

## 4. 疑问澄清
- **libs 基类校验**：确认 libs 基类开启基础校验（物理约束），apps 层负责差异化业务校验。
- **Service 依赖**：确认 Service 层应与 DTO 解耦，使用数据库推导类型。
