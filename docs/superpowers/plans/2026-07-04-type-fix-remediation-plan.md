# 类型修复 / 去兼容兜底整改实施计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复 `moderation`、`db/seed`、`CurrentUser`、`cache.module.ts`、`rsa.service.ts` 这 5 类问题，并彻底移除相关兼容兜底。

**架构：** 先做 Tranche 0 环境恢复门，再把剩余问题拆成 5 个独立 tranche 收口，最后统一跑结构、类型、行为、边界脚本四类 gate。执行中禁止新增 barrel/index、双事实源、临时 shim、长期测试文件。

**技术栈：** TypeScript 6 + NestJS 11 + Fastify 5 + Drizzle ORM RC + pnpm 10

---

## 任务总览

| 任务 | 目标                           | 关键文件                                                                                         | 独立 gate                             |
| ---- | ------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------- |
| 0    | 环境恢复与验证门定义           | `package.json`                                                                                   | `pnpm type-check` 可归因启动          |
| 1    | `moderation` 结构收口          | （历史）`nest-cli.json`、`libs/moderation/tsconfig.lib.json`                                     | `pnpm build:admin` + `pnpm build:app` |
| 2    | `db/seed` 边界收口             | `db/core/index.ts`、`db/core/drizzle.type.ts`、`db/seed/*`、`scripts/check-db-core-boundary.ts`  | `pnpm db:core:check`                  |
| 3    | `CurrentUser` owner 收口       | `current-user.type.ts`、`current-user.decorator.ts`、`apps/*/global.d.ts`、3 个 direct consumers | `pnpm type-check` + app builds        |
| 4    | `cache.module.ts` 假配置值清除 | `libs/platform/src/modules/cache/cache.module.ts`                                                | 生产态缺 Redis 配置 smoke             |
| 5    | `rsa.service.ts` 协议异常恢复  | `rsa.service.ts` + 5 个 caller                                                                   | caller matrix 验证                    |
| 6    | 汇总验证与交接                 | 无新增写集                                                                                       | 四类 gate 全通过                      |

## 全局硬约束

- [ ] 不使用 `pnpm reinstall`。`package.json:10,31` 会连带执行 `db:migrate`，本计划禁止走这条路径。
- [ ] 不新增 `index.ts`、`module.ts`、DTO workaround、controller compat 入口或任何临时 shim。
- [ ] 不保留 `apps/*/global.d.ts` 与 `libs/platform` 新 owner type 并存的双事实源。
- [ ] 不保留任何测试文件、测试目录、探针脚本；如临时创建，验证后立即删除。
- [ ] 未拿到最新验证输出前，不得声称“已完成”“已修复”“验证通过”。

### 任务 0：环境恢复与验证门定义

**文件：**

- 修改：无代码修改，先记录执行门
- 关注：`package.json:10,18,25,31`

- [ ] **步骤 1：恢复依赖物化**

运行：

```powershell
pnpm install --frozen-lockfile
```

若锁文件与安装状态确有漂移，再运行：

```powershell
pnpm install
```

- [ ] **步骤 2：定义四类 gate**

记录并冻结以下 gate：

1. 静态结构门
2. 类型与构建门
3. 行为门
4. 边界脚本门

- [ ] **步骤 3：验证环境门**

运行：

```powershell
pnpm type-check
```

预期：命令完整启动并返回可归因结果。  
停止条件：如果仍然是依赖物化错误，而不是代码错误，停在任务 0。

### 任务 1：`moderation` 结构收口

> 当前说明（2026-07-15）：仓库已统一为仅构建 `admin-api` 与 `app-api`；所有 `libs` 随应用编译，且不再保留 Nest CLI 的独立 library 项目或 `tsconfig.lib.json`。本任务的原始独立构建配置与命令仅保留为历史记录。

**文件：**

- 历史修改：`nest-cli.json:112-119`
- 历史修改：`libs/moderation/tsconfig.lib.json:3-8`

- [ ] **步骤 1：对齐 `nest-cli.json`**

把 `moderation` 项目的 `root` / `entryFile` / `sourceRoot` 对齐到真实的 `libs/moderation/sensitive-word/src` owner 结构。

- [ ] **步骤 2：对齐 `tsconfig.lib.json`**

把 `include` / `outDir` 与真实 sourceRoot 对齐，禁止继续假设 `libs/moderation/src/**/*` 存在。

- [ ] **步骤 3：验证**

当时运行：

```powershell
pnpm exec nest build moderation
```

当前替代验证：

```powershell
pnpm build:admin
pnpm build:app
```

### 任务 2：`db/seed` 边界收口

> 历史说明：此计划完成后，检查器曾位于
> `db/operations/check-db-core-boundary.ts`；该文件和 `pnpm db:core:check` 已于 2026-07-13 删除。

**文件：**

- 修改：`db/core/index.ts`
- 修改：`db/core/drizzle.type.ts`
- 修改：`db/seed/db-client.ts`
- 修改：`db/seed/db-client.type.ts`
- 修改：`scripts/check-db-core-boundary.ts`

- [ ] **步骤 1：新增 seed 专用公共导出**

> 历史计划说明：本节的 `seedRelations` alias 已被 RQB v2 breaking migration 移除。
> 当前唯一 relation owner 为 `relations`，seed 直接消费它，不保留别名兼容层。

在 `@db/core` 公开：

- `relations`
- `SeedDb`

禁止新增 relation alias。

- [ ] **步骤 2：迁移 seed 调用点**

把 `db/seed/db-client.ts` 与 `db/seed/db-client.type.ts` 改成只依赖 `@db/core` / `@db/schema`。  
若为了控制改动面保留 seed 内部 `Db` 名称，别名只能收敛在 `db/seed` 局部层。

- [ ] **步骤 3：更新 allowlist**

在 `scripts/check-db-core-boundary.ts` 中仅新增 `relations` 与 `SeedDb` 这两个名字。

- [ ] **步骤 4：验证**

运行：

```powershell
rg -n "../core/drizzle-relations" db/seed -g "*.ts" -g "*.d.ts"
pnpm db:core:check
```

预期：`rg` 无命中，`db:core:check` 通过。  
停止条件：任一失败都停在任务 2。

### 任务 3：`CurrentUser` owner 收口

**文件：**

- 修改：`libs/platform/src/decorators/current-user.type.ts`
- 修改：`libs/platform/src/decorators/current-user.decorator.ts`
- 修改：`apps/admin-api/src/global.d.ts`
- 修改：`apps/app-api/src/global.d.ts`
- 修改：`apps/admin-api/src/common/interceptors/audit.interceptor.ts`
- 修改：`apps/admin-api/src/modules/auth/admin-user-status.guard.ts`
- 修改：`apps/app-api/src/modules/auth/app-user-status.guard.ts`

- [ ] **步骤 1：建立唯一 owner**

在 `current-user.type.ts` 内新增显式 request owner type，继续以 `JwtUserInfoInterface` 作为字段基础来源。

- [ ] **步骤 2：迁移 direct consumers**

让 decorator、interceptor、两处 guard 全部使用命名 request owner type，禁止继续保留匿名 `getRequest<...>()` 类型。

- [ ] **步骤 3：删除 app 侧共享 ambient 声明**

移除两端 `apps/*/global.d.ts` 中的 `user?: JwtUserInfoInterface` 共享声明；如果文件仍需保留其它扩展，只保留非共享内容。

- [ ] **步骤 4：验证**

运行：

```powershell
rg -n "request\\.user|user\\?: JwtUserInfoInterface" apps/admin-api/src/global.d.ts apps/app-api/src/global.d.ts
pnpm type-check
pnpm build:admin
pnpm build:app
```

预期：无共享 ambient 残留，admin/app build 通过。  
停止条件：只要仍报 `request.user` / `FastifyRequest` / `@CurrentUser` 类型错误，就停在任务 3。

### 任务 4：`cache.module.ts` 假配置值清除

**文件：**

- 修改：`libs/platform/src/modules/cache/cache.module.ts`

- [ ] **步骤 1：删除空连接 fallback**

移除 `configService.get<RedisConfigInterface>('redis') ?? { connection: '' }`。

- [ ] **步骤 2：写死非开发环境非空校验**

在创建 redis store / `createKeyv` 前对 `connection.trim()` 做显式判空；只要为空串、全空白或缺失，就直接失败。

- [ ] **步骤 3：验证**

先构建：

```powershell
pnpm build:admin
```

再在 `NODE_ENV=production` 下，用空白/缺失的 `redis.connection` 启动编译产物，验证在创建 redis store 前失败。  
停止条件：若仍能继续进入成功监听流程，停在任务 4。

### 任务 5：`rsa.service.ts` 协议异常恢复

**文件：**

- 修改：`libs/platform/src/modules/crypto/rsa.service.ts`
- 修改：`apps/app-api/src/modules/auth/password.service.ts`
- 修改：`apps/app-api/src/modules/auth/auth.service.ts`
- 修改：`apps/admin-api/src/modules/auth/auth.service.ts`
- 修改：`apps/admin-api/src/modules/app-user/app-user-command.service.ts`
- 修改：`libs/config/src/system-config/system-config.service.ts`

- [ ] **步骤 1：在 owner 层恢复协议异常**

让 `RsaService` 不再把坏密文抛成 `BusinessException`。

- [ ] **步骤 2：按 caller matrix 核对结果**

目标行为：

- `password.service.ts`：坏密文直接抛协议异常
- `app-user-command.service.ts`：坏密文直接抛协议异常
- `app-api auth.service.ts`：caller catch，保留登录失败记录流程
- `admin-api auth.service.ts`：caller catch，保留失败计数并返回 `UnauthorizedException('账号或密码错误')`
- `system-config.service.ts`：保留“按明文回退再 AES 加密”的既有 fallback，并把它作为显式保留行为验证

- [ ] **步骤 3：验证**

优先复用现有调用链；若缺少直接 smoke 入口，允许创建临时 focused spec / probe，验证后立即删除。

静态验证：

```powershell
rg -n "BusinessException" libs/platform/src/modules/crypto/rsa.service.ts
```

预期：owner 层不再有坏密文 `BusinessException`。  
停止条件：任一 caller 的表现与 matrix 不一致，停在任务 5。

### 任务 6：汇总验证与交接

**文件：**

- 无新增代码写集

- [ ] **步骤 1：执行静态结构门**

```powershell
rg -n "../core/drizzle-relations" db/seed -g "*.ts" -g "*.d.ts"
rg -n "connection: ''" libs/platform/src/modules/cache/cache.module.ts
rg -n "BusinessException" libs/platform/src/modules/crypto/rsa.service.ts
rg -n "request\\.user|user\\?: JwtUserInfoInterface" apps/admin-api/src/global.d.ts apps/app-api/src/global.d.ts
```

- [ ] **步骤 2：执行类型与构建门**

```powershell
pnpm type-check
pnpm build:admin
pnpm build:app
```

- [ ] **步骤 3：执行边界脚本门**

```powershell
pnpm db:core:check
```

- [ ] **步骤 4：确认无临时测试残留**

删除所有临时 spec / probe / 一次性夹具。

- [ ] **步骤 5：发布执行入口**

把批准版计划同步到：

- `E:/Code/es/es-server/.omx/plans/type-fix-remediation-plan-20260704T054901Z.md`
- `E:/Code/es/es-server/docs/superpowers/plans/2026-07-04-type-fix-remediation-plan.md`

只有这一步完成后，才允许 handoff 到 `$ultragoal` / `$team` / `$ralph`。

## 执行建议

1. **子代理驱动（推荐）** - Lane 1 做 `moderation + cache`，Lane 2 做 `db/core + seed`，Lane 3 做 `CurrentUser + rsa`，Lane 4 做验证与证据收集。
2. **内联执行** - 在当前会话按任务 0 → 6 顺序推进，每个任务关门后再进入下一个。
