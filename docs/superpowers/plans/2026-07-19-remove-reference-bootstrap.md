# 移除离线 Reference Bootstrap 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 以 `admin-api` 启动期的实时 Controller 权限扫描作为唯一 RBAC 初始化路径，并移除离线 reference bootstrap。

**架构：** 保留 `AdminRbacSyncService` 与 `AdminRbacService` 的现有 Nest 生命周期路径。删除仅被离线 CLI、权限 manifest 生成和 Docker 构建步骤使用的 `db/bootstrap` 代码；同步删除入口并更新当前运维文档，明确 migration 仍独立执行、demo seed 必须在一次管理端启动之后执行。

**技术栈：** NestJS 11、Drizzle ORM、pnpm、TypeScript、Docker。

---

## 文件结构

- 删除：`db/bootstrap/admin-rbac-permissions.generated.ts` — 冻结权限 manifest。
- 删除：`db/bootstrap/reference-rbac.ts` — 离线 bootstrap 的直接数据库写入 helper。
- 删除：`db/bootstrap/reference.ts` — 离线 bootstrap CLI 与可选管理员创建。
- 删除：`scripts/generate-admin-rbac-reference-permissions.ts` — manifest 生成器。
- 修改：`package.json` — 删除四个 bootstrap 命令。
- 修改：`Dockerfile` — 删除 admin 构建时 manifest 生成。
- 修改：`README.md`、`.trae/rules/07-drizzle.md`、`.trae/rules/07-drizzle-operations.md` — 记录新的运行顺序。
- 修改：`db/seed/index.ts` — 将已删除的 reference bootstrap 作业锁名收敛为 demo seed 专用锁。
- 修改：`db/seed/modules/admin/domain.ts` — 将 demo seed 的缺失角色报错改为启动期同步前置条件。

### 任务 1：锁定废弃链路的删除契约

**文件：**

- 测试：临时 Node 静态检查（不写入仓库）

- [ ] **步骤 1：运行失败的静态检查**

运行：使用 Node 断言 `db/bootstrap` 和 manifest 生成器不存在，`package.json` 不含 `db:bootstrap:reference*`，Dockerfile 不含 bootstrap manifest 命令。

预期：失败，因为旧离线 bootstrap 链路仍存在。

- [ ] **步骤 2：确认失败原因**

预期：错误只列出仍存在的 bootstrap 文件或引用，不连接数据库、不执行 seed、migration 或应用启动。

### 任务 2：删除离线运行时与构建入口

**文件：**

- 删除：`db/bootstrap/admin-rbac-permissions.generated.ts`
- 删除：`db/bootstrap/reference-rbac.ts`
- 删除：`db/bootstrap/reference.ts`
- 删除：`scripts/generate-admin-rbac-reference-permissions.ts`
- 修改：`package.json:27-30`
- 修改：`Dockerfile:44-46`

- [ ] **步骤 1：删除仅由离线 bootstrap 使用的源文件**

删除上述四个文件，不改动 `AdminRbacSyncService` 或 `AdminRbacService`；它们继续作为唯一的 RBAC 数据同步 owner。

- [ ] **步骤 2：删除脚本与 Docker 调用点**

从 `package.json` 删除所有 `db:bootstrap:reference` 命令，从 Dockerfile 删除 admin manifest 生成注释和 `RUN` 指令。

- [ ] **步骤 3：运行静态删除检查**

运行：任务 1 的同一 Node 静态检查。

预期：通过，证明没有可执行的离线 bootstrap 入口遗留。

### 任务 3：收敛运维文档和 demo seed 前置条件

**文件：**

- 修改：`README.md:54-61`
- 修改：`.trae/rules/07-drizzle.md:84-90`
- 修改：`.trae/rules/07-drizzle-operations.md:58-71`
- 修改：`db/seed/index.ts:35`
- 修改：`db/seed/modules/admin/domain.ts:65-72`

- [ ] **步骤 1：更新当前运维说明**

将 reference bootstrap 说明替换为：migration 完成后，由 `admin-api` 启动时扫描 Controller 权限并同步 RBAC；应用启动仍不得执行 migration、reset 或 demo seed。

- [ ] **步骤 2：更新 demo seed 报错语义**

将缺少 `super_admin` 角色的错误明确为“需要先启动一次 admin-api 完成 RBAC 同步”，不让 demo seed 承担 RBAC 初始化。

同时将 `reference-data-bootstrap` 作业锁名改为 `demo-seed`，避免已删除职责名称继续作为运行时锁资源。

- [ ] **步骤 3：执行文档格式检查**

运行：`pnpm exec prettier --check README.md .trae/rules/07-drizzle.md .trae/rules/07-drizzle-operations.md docs/superpowers/specs/2026-07-19-startup-rbac-sync-only-design.md docs/superpowers/plans/2026-07-19-remove-reference-bootstrap.md`

预期：exit 0。

### 任务 4：验证

**文件：**

- 验证：当前工作区

- [ ] **步骤 1：运行 TypeScript 类型检查**

运行：`pnpm type-check`

预期：exit 0，或只报告实施前已存在的仓库基线问题。

- [ ] **步骤 2：运行管理端构建**

运行：`pnpm build:admin`

预期：exit 0，证明 Docker 构建不再需要 manifest 生成器后，管理端仍能编译。

- [ ] **步骤 3：检查最终引用和工作区差异**

运行：`rg -n -S "db:bootstrap:reference|generate-admin-rbac-reference-permissions|admin-rbac-permissions.generated|db/bootstrap/reference" package.json Dockerfile README.md .trae/rules db scripts apps libs`，然后检查 `git diff --check` 与 `git diff --stat`。

预期：当前运行代码、构建入口和当前规则没有离线 bootstrap 引用；历史计划文档可保留其历史记录。
