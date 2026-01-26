# 任务：重构 Content 模块以支持 Admin 和 App 共享

## 1. 项目上下文分析

### 1.1 现状
- **Admin 项目**: `apps/admin-api` 中包含 `content-management` 模块，负责内容管理（漫画、作者、分类、标签等）。
- **Forum 模块**: `libs/forum` 作为一个独立的库，被 `admin-api` 引用。这是一种成熟的共享模式。
- **目标**: 将 `content-management` 模块的业务逻辑抽取到 `libs/content`，使其成为与 `libs/forum` 类似的共享库，以便 `apps/app-api` 将来可以使用，同时保持 `apps/admin-api` 的现有功能不变。

### 1.2 现有结构
`apps/admin-api/src/modules/content-management` 包含以下子模块：
- `author`: 作者管理
- `category`: 分类管理
- `comic`: 漫画核心管理（包含 `core`, `chapter`, `chapter-content`, `third-party`）
- `tag`: 标签管理

每个子模块通常包含 `controller`, `service`, `dto`, `module`, `constant`。

## 2. 需求理解与确认

### 2.1 核心需求
1.  **抽取业务逻辑**: 将所有 `Service`, `DTO`, `Constant`, `Type/Enum` 移动到 `libs/content`。
2.  **保留 Controller**: `apps/admin-api` 中的 `Controller` 必须保留，以保证 API 接口路径和行为不变。
3.  **引用调整**: 调整 `apps/admin-api` 中的代码，使其从 `libs/content` 导入业务逻辑。
4.  **Admin 稳定性**: 改造后 Admin 项目必须正常运行，Controller 功能不受影响。
5.  **App 预备**: 改造是为了让 App 项目也能使用这些 Service，但本次任务不需要实现 App 端的接入。

### 2.2 架构模式 (参考 Forum)
- **Libs 层 (`libs/content`)**:
    - 包含 `Module`, `Service`, `DTO`, `Entity`。
    - 负责与数据库交互、业务逻辑处理。
    - 命名建议：使用 `Work` 前缀（参考现有的 `WorkComicModule` 等命名），例如 `WorkAuthorService`, `WorkComicService`。
- **Apps 层 (`apps/admin-api`)**:
    - 包含 `Controller`。
    - `Module` 负责导入 Libs 层的 Module。
    - `Controller` 注入 Libs 层的 Service。

### 2.3 边界确认
- **不涉及**: App 端的 API 开发。
- **涉及**: `content-management` 下所有子文件夹的重构。
- **涉及**: 创建 `libs/content` 库结构。
- **涉及**: 修改 `apps/admin-api` 的 `tsconfig` (如果需要别名映射，通常 `libs` 目录下的库会自动映射，如 `@libs/content`)。

## 3. 智能决策策略
- **命名规范**: 遵循现有的 `Work` 前缀惯例（如 `WorkAuthorModule`）。
- **目录结构**: `libs/content` 将镜像原有的目录结构 (`author`, `category`, `comic`, `tag`)。
- **依赖管理**: `libs/content` 将依赖 `@libs/base` (数据库、DTO 基类等)。

## 4. 待确认问题
- 是否存在任何特定于 Admin 的业务逻辑不能共享给 App？
    - **假设**: 大部分 Service 逻辑是通用的。如果存在 Admin 特有逻辑（如特定权限校验），通常在 Controller 层或专门的 AdminService 处理。本次重构将默认移动所有 Service 逻辑。如果有明显不适合共享的（如爬虫/Third-party），我们会仔细评估，但根据描述“同等改造”，应尽量下沉。

## 5. 最终共识 (待用户确认)
- 方案：建立 `libs/content`，迁移逻辑，Admin 仅保留 Controller 和胶水层 Module。
