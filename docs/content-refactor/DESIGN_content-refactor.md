# 设计方案：Content 模块重构

## 1. 总体架构

采用与 `libs/forum` 一致的架构模式，将核心业务逻辑下沉至共享库。

```mermaid
graph TD
    subgraph "Apps Layer"
        AdminAPI[Admin API (apps/admin-api)]
        AppAPI[App API (apps/app-api)]
    end

    subgraph "Libs Layer"
        ContentLib[Content Lib (libs/content)]
        BaseLib[Base Lib (libs/base)]
    end

    subgraph "Data Layer"
        DB[(Database)]
    end

    AdminAPI --> ContentLib
    AppAPI -.-> ContentLib
    ContentLib --> BaseLib
    BaseLib --> DB
```

## 2. 详细设计

### 2.1 目录结构调整

#### 新建 `libs/content`
```text
libs/content/src/
├── author/
│   ├── dto/
│   ├── author.constant.ts
│   ├── author.module.ts  (Export: WorkAuthorService)
│   └── author.service.ts (Class: WorkAuthorService)
├── category/
├── comic/
│   ├── chapter/
│   ├── chapter-content/
│   ├── core/
│   └── third-party/
├── tag/
├── content.module.ts (Export: WorkContentModule)
└── index.ts
```

#### 调整 `apps/admin-api/src/modules/content-management`
```text
apps/admin-api/src/modules/content-management/
├── author/
│   ├── author.controller.ts (Import: WorkAuthorService from @libs/content)
│   └── author.module.ts     (Import: WorkAuthorModule from @libs/content)
├── category/
├── comic/
├── tag/
└── content.module.ts
```

### 2.2 类名与命名规范

为了避免冲突并保持一致性，`libs/content` 中的服务和模块将采用 `Work` 前缀（参考现有代码中的命名习惯，如 `WorkComicModule`）。

| 模块 | 原 Admin 类名 | 新 Lib 类名 | 备注 |
| :--- | :--- | :--- | :--- |
| Author | AuthorService | WorkAuthorService | |
| Author | AuthorModule | WorkAuthorModule | |
| Category | CategoryService | WorkCategoryService | |
| Comic | ComicService | WorkComicService | |
| Tag | TagService | WorkTagService | |

DTO 类名通常保持不变，或者根据需要添加前缀（如 `WorkAuthorDto`），但在 `forum` 中似乎直接使用了 `CreateForumSectionDto` 等。我们将检查现有 DTO 命名，尽量保持兼容或最小化修改。

### 2.3 依赖关系

- `libs/content` 将依赖:
    - `@libs/base`: 用于数据库访问 (`PrismaService`)、通用 DTO、工具函数。
    - `@nestjs/common`, `@nestjs/core` 等基础框架。

- `apps/admin-api` 将依赖:
    - `@libs/content`: 引用业务逻辑。

### 2.4 接口契约

- **Controller**: 保持不变。API 路径、参数、返回值完全兼容。
- **Service**: 方法签名尽量保持不变，仅移动位置。

## 3. 异常处理策略

- **编译错误**: 移动代码后，由于路径变化，会导致大量 import 错误。将使用脚本或手动批量修复路径。
- **运行时错误**: 确保 `libs/content` 正确导出 Provider，并在 `apps/admin-api` 中正确导入 Module。

## 4. 验证计划

1.  **编译检查**: 确保 `libs/content` 和 `apps/admin-api` 均无 TypeScript 错误。
2.  **启动检查**: 启动 `apps/admin-api` 服务，确保无依赖注入错误。
3.  **功能检查**: 选取几个核心接口（如获取漫画列表、详情）进行冒烟测试。
