# 数据表命名规范化开发补充

## 开工条件

- 已确认本轮不存在外部系统直接依赖旧表名，但存在需要保留的线上数据。
- 发布时能够保证“应用代码切换 + 数据库迁移”在同一维护窗口完成，避免旧版本应用长时间访问新表名。
- 迁移通过 `pnpm db:generate` 生成；若出现 rename 识别确认或其他交互，由用户亲自在终端完成。
- 涉及 schema 注释或表注释变更时，同步更新 `db/comments/generated.sql`，并通过 `pnpm db:comments:check` 校验。
- seed 目录使用 schema 导出常量，不允许在本轮保留旧导出兼容层。

## 影响模块

### Schema 与关系定义

- `db/schema/app/*`
- `db/schema/message/*`
- `db/schema/system/*`
- `db/schema/forum/*`
- `db/schema/index.ts`
- `db/relations/app.ts`
- `db/relations/message.ts`
- `db/relations/system.ts`
- `db/relations/forum.ts`
- `db/relations/work.ts`

### 运行时代码

- `apps/app-api/src/modules/*`
- `apps/admin-api/src/modules/*`
- `libs/interaction/src/*`
- `libs/forum/src/*`
- `libs/message/src/*`
- `libs/growth/src/*`
- `libs/config/src/*`
- `libs/content/src/*`
- `libs/app-content/src/*`
- `libs/moderation/sensitive-word/src/*`
- `libs/user/src/*`

### seed 与派生产物

- `db/seed/modules/app/domain.ts`
- `db/seed/modules/forum/domain.ts`
- `db/seed/modules/message/domain.ts`
- `db/seed/modules/system/domain.ts`
- `db/seed/modules/work/domain.ts`
- `db/comments/generated.sql`
- `db/migration/*`

## 统一实现约束

- 物理表名、schema 文件名、导出符号三层命名必须同步收敛，不保留旧名 alias。
- 表名改动后，同表关联的 `index`、`unique`、`check`、`primary key` 等显式命名对象也要同步改到新前缀，避免数据库里留下旧表名痕迹。
- `db/schema/index.ts`、`db/relations/*.ts`、`db/seed/*`、`apps/*`、`libs/*` 中不得残留目标范围内的旧导出符号。
- 业务 service、controller、DTO 文件名不因本轮顺手重构，除非该文件本身承担 schema 导出职责。
- 不新增兼容 view、旧名转发导出、双写逻辑或灰度兼容代码。
- 线上库必须通过 rename 迁移保留现有数据；若生成结果表现为 drop/create 且无法通过交互式 rename 纠正，则立即阻塞，不得手写 migration 兜底。

## 迁移与发布约束

- `pnpm db:generate` 前必须先完成 `P0-01` 与 `P0-02`，否则容易生成中间态迁移。
- 若 `drizzle-kit generate` 出现 rename 交互，需由用户在终端确认“旧表 -> 新表”的对应关系。
- 生成后必须人工检查迁移产物与 `snapshot.json`，确认目标对象是重命名而非删表重建语义。
- 本轮上线顺序固定为：
  - 应用进入维护窗口或停止旧版本写流量
  - 备份数据库
  - 执行迁移
  - 部署新应用
  - 执行冒烟验证
- 若迁移后仍需回滚，优先使用数据库备份和整包回滚，不设计新旧表名长期共存方案。

## 测试与验证重点

- `pnpm type-check`
- `pnpm db:comments:check`
- 变更文件的 `eslint`
- `rg` 搜索源码范围内的目标旧表名、旧导出符号，确认没有残留；固定排除 `docs/audits/table-naming-normalization-work-items/**` 与 `db/migration/**`
- seed 相关代码至少通过 TypeScript 编译路径验证，不因旧 schema 导出失效
- 重点服务与测试至少覆盖以下域：
  - interaction
  - forum
  - message
  - config
  - content
  - moderation
- 迁移产物审查重点：
  - 目标表 rename 是否完整
  - 命名索引/约束/序列是否同步收敛
  - 未出现误删或误建新空表

## 风险提示

- `P0-01` 与 `P0-02` 会同时改 `db/schema/*` 和大量 `libs/*` 引用，若中途停在半改状态，整个仓库会临时不可编译。
- `db/seed/modules/app/domain.ts`、`db/seed/modules/forum/domain.ts`、`db/seed/modules/message/domain.ts` 都直接导入旧 schema 常量，是本轮最容易漏改的路径。
- `libs/content/src/*` 与 `libs/app-content/src/*` 存在旧导出引用和旧表名注释，若范围清单未显式覆盖，容易在编译通过后仍残留过期命名说明。
- `db/comments/generated.sql` 会保留大量旧物理表名文本，如果不同步更新，`db:comments:check` 会失败。
- 线上库已有数据，任何被误识别为 drop/create 的迁移都不可接受。
