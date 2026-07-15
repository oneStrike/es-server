# 导入边界规范

适用范围：全仓库 TypeScript/JavaScript 文件的导入语句。

## TL;DR

- 何时看：改导入路径、文件放置、barrel、`libs/platform` / `db` 入口时先看本篇。
- 必做：业务域默认直连 owner 文件；命中 `libs/platform`、`db` 时只走白名单公共入口；所有 runtime edge 同时遵循唯一 package DAG。
- 不要：新增转发入口、反向 package edge 或循环依赖，不要用目录语义路径代替具体文件，也不要直连 `libs/platform` / `db` 具体文件。
- 最低验证：`pnpm type-check` 与对应 import/owner static gate；不得引用不存在的 `pnpm boundaries:check`。

本篇只定义导入路径形状与 public API 白名单；package 方向、provider owner、port/event 和 composition root 以 [09-nestjs-architecture.md](./09-nestjs-architecture.md) 为单一事实源。

## 核心原则

- 全仓统一使用文件直连导入；业务域不依赖 `index.ts`、`dto/index.ts`、`core/index.ts`、`module/index.ts`、`module.ts`、`contracts.ts` 等转发入口。
- 除命中本规则明确允许的例外外，一律直连具体 owner 文件；不要根据命名“猜测”某个目录入口可用。
- `libs/platform` 和 `db` 是本规则的强例外：只能使用“例外白名单”列出的公共入口，不允许直连未授权的具体文件。
- 对 `@libs/platform/*`、`@db/*` 而言，“文件是否存在”“owner 文件更短”“当前只用一个符号”都不构成直连理由；必须回到白名单目录入口拿符号。
- DTO 文件默认只依赖稳定 DTO、常量、类型和声明期组合工具；禁止通过 DTO 拉起业务运行时对象。
- Service、Resolver、Module、Controller 直接依赖 owner 文件，不通过中间入口“顺手带出”其他符号。
- 文件直连不等于允许跨越 package DAG；任何 runtime import 都必须同时满足 09 规则定义的方向。
- 禁止通过“调整导出顺序”、`forwardRef()`、动态 lookup 或 barrel 掩盖循环依赖；应删除反向边并收敛 owner。
- 不保留 deprecated import alias、旧 module 入口或第二套公共路径。

## 明确禁止

- 禁止新增转发入口：`index.ts`、`dto/index.ts`、`core/index.ts`、`module/index.ts`、`module.ts`、`contracts.ts`、`base.ts`（仅转发时）
- 禁止为了缩短路径新增“公共出口文件”
- 唯一例外：`libs/platform/src/**/index.ts` 目录级 public API
- 禁止跨域导入目录语义路径，必须直达具体文件
- 禁止直连 `libs/platform` 与 `db` 下的具体文件，例如 `@libs/platform/dto/base.dto`、`@libs/platform/decorators/validate/string-property`、`@db/core/query/page-query`、`@db/schema/app/app-user`
- 禁止使用 `@libs/platform/modules/<name>` 根入口；`modules` 目录下必须继续下沉到具体子模块，例如 `dto`、`helpers`、`types`、`*.module.ts`、`*.service.ts`、`*.constant.ts`
- 禁止把 framework、ORM 或业务层的运行时对象伪装成“DTO 依赖”带入 DTO 文件
- 禁止新增不符合唯一 package DAG 的 runtime import、Nest imports edge 或跨域反向依赖
- 禁止为打破循环建立中央万能 `contracts`、`integration`、repository 或 service locator 包

## 分层导入规则

- DTO 文件仅可导入：同域 DTO、跨域 DTO 具体文件、`@libs/platform/*` 基础能力、必要的 `@db/schema` 类型或常量、声明期 DTO 组合工具。
- DTO 文件允许导入 DTO 组合 helper；当前允许：`@nestjs/swagger` 中的 `PickType`、`PartialType`、`OmitType`、`IntersectionType`。这类导入仅用于 DTO 字段裁剪、合并和可选化，不视为“拉起运行时对象”。
- DTO / Service / Resolver / Module / Controller 一旦依赖 `libs/platform` 或 `db`，统一走白名单目录入口；不要在同一文件里混用目录入口和具体文件入口。
- `@libs/platform/decorators`、`@libs/platform/dto`、`@libs/platform/utils`、`@db/core`、`@db/schema` 等白名单目录入口是正式稳定契约；其下具体文件路径不属于可选等价写法。
- `@libs/platform/modules/*` 采用“模块域 + 具体子模块”规则：允许 `@libs/platform/modules/auth/dto`、`@libs/platform/modules/auth/helpers`、`@libs/platform/modules/auth/types`、`@libs/platform/modules/auth/auth.module`、`@libs/platform/modules/crypto/rsa.service`、`@libs/platform/modules/upload/dto` 这类具体子模块入口；禁止停留在 `@libs/platform/modules/auth`、`@libs/platform/modules/crypto`、`@libs/platform/modules/upload` 这类根入口。
- DTO 文件禁止导入：任何 barrel、`*.service.ts`、`*.module.ts`、`*.resolver.ts`，以及会引入业务行为的 provider、service、repository、entity、module 级依赖。
- Service / Resolver / Module / Controller 必须直连具体文件，不通过 DTO barrel。
- 业务域 `types/` 目录下的类型文件同样必须直连具体 `*.type.ts` 文件；禁止导入 `../types`、`@libs/foo/bar/types` 这类目录语义路径。
- `apps/*` 也必须直连具体文件，不是例外；它只做 composition、transport、启动与 adapter 绑定。
- 跨域同步接口由 consumer owner 定义，adapter 由 app composition 绑定；异步事实 contract 由 producer owner 定义。导入方向不得因此反转。
- owner service 可以按 09 规则直接依赖 `DrizzleService`；禁止为了“统一边界”把所有数据库调用搬进通用 repository/port。

## 例外白名单

- `libs/platform` 与 `db` 的允许入口详见 [导入边界白名单附录](./01-import-boundaries-whitelist.md)。
- 白名单是 `libs/platform` / `db` 的唯一允许入口集合；命中这两个命名空间时，不存在“改用具体 owner 文件也可以”的第二套规则。
- 白名单之外的 `@libs/platform/*`、`@db/*` 一律禁止导入；若确需暴露能力，应先回到对应公共入口维护导出，再由调用方走白名单目录入口。
- 明确禁止的目录级入口示例：`@libs/platform`、`@libs/platform/modules`、`@db`、`@db/relations`。
- 除 `libs/platform` 与 `db` 外，其他业务域导入都必须直达具体 owner 文件，例如 `@libs/forum/section/dto/forum-section.dto`。

## 正反例

- 允许：`import { BaseForumSectionDto } from '@libs/forum/section/dto/forum-section.dto'`
- 禁止：`import { BaseForumSectionDto } from '@libs/forum/section/dto'`
- 禁止：`import { BaseForumSectionDto } from '@libs/forum/section'`
- 允许：`import { BaseDto, IdDto } from '@libs/platform/dto'`
- 允许：`import { GeoModule } from '@libs/platform/modules/geo/geo.module'`
- 允许：`import { JwtAuthGuard } from '@libs/platform/modules/auth/auth.guard'`
- 允许：`import { JwtAuthModule } from '@libs/platform/modules/auth/auth.module'`
- 允许：`import { TokenDto, RefreshTokenDto } from '@libs/platform/modules/auth/dto'`
- 允许：`import { AuthErrorMessages, createAuthRedisKeys } from '@libs/platform/modules/auth/helpers'`
- 允许：`import type { ITokenStorageService } from '@libs/platform/modules/auth/types'`
- 允许：`import { UploadModule } from '@libs/platform/modules/upload/upload.module'`
- 允许：`import { UploadService } from '@libs/platform/modules/upload/upload.service'`
- 允许：`import { setupApp, logStartupInfo } from '@libs/platform/bootstrap'`
- 允许：`import { AuditActionTypeEnum } from '@libs/observability/audit/audit-action.constant'`
- 允许：`import { AuditItemDto } from '@libs/observability/audit/dto'`
- 禁止：`import { BaseDto } from '@libs/platform/dto/base.dto'`
- 禁止：`import { StringProperty } from '@libs/platform/decorators/validate/string-property'`
- 禁止：`import { GeoService } from '@libs/platform/modules/geo'`
- 禁止：`import { JwtAuthModule } from '@libs/platform/modules/auth'`
- 禁止：`import { UploadService } from '@libs/platform/modules/upload'`
- 禁止：`import { TokenDto } from '@libs/platform/modules/auth/dto/auth-scene.dto'`
- 禁止：`import { createAuthRedisKeys } from '@libs/platform/modules/auth/auth.helpers'`
- 禁止：`import type { ITokenStorageService } from '@libs/platform/modules/auth/token-storage.type'`
- 禁止：`import { setupApp } from '@libs/platform/bootstrap/app.setup'`
- 禁止：`import { buildDrizzlePageQuery } from '@db/core/query/page-query'`
- 禁止：`import { appUser } from '@db/schema/app/app-user'`
- 允许：`import type { GrowthRuleRewardSettlementResult } from '@libs/growth/growth-reward/types/growth-reward-result.type'`
- 允许：`import { PickType } from '@nestjs/swagger'`
- 禁止：`import { UploadModule } from '@libs/platform/modules'`
- 禁止：`import type { GrowthRuleRewardSettlementResult } from '@libs/growth/growth-reward/types'`
- 禁止：`import { relationX } from '@db/relations'`
- 禁止：`import { ForumTopicService } from '../forum-topic.service'`
- 禁止：`import { ForumModule } from '../forum.module'`
