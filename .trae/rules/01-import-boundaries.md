# 导入边界规范

适用范围：全仓库 TypeScript/JavaScript 文件的导入语句。

## 核心原则

- 全仓统一使用文件直连导入；业务域不依赖 `index.ts`、`dto/index.ts`、`core/index.ts`、`module/index.ts`、`module.ts`、`contracts.ts` 等转发入口。
- 除命中本规则明确允许的例外外，一律直连具体 owner 文件；不要根据命名“猜测”某个目录入口可用。
- `libs/platform` 和 `db` 仅允许使用本规则“例外白名单”列出的目录级入口；白名单之外的目录路径一律禁止。若确需引用内部实现，必须直连具体 owner 文件，例如 `@libs/platform/modules/upload/upload.service`、`@libs/platform/platform.module`、`@libs/platform/bootstrap/app.setup`。
- DTO 文件默认只依赖稳定 DTO、常量、类型和声明期组合工具；禁止通过 DTO 拉起业务运行时对象。
- Service、Resolver、Module、Controller 直接依赖 owner 文件，不通过中间入口“顺手带出”其他符号。
- 禁止通过“调整导出顺序”掩盖循环依赖；应通过收敛共享字段或调整依赖方向解决根因。

## 明确禁止

- 禁止新增转发入口：`index.ts`、`dto/index.ts`、`core/index.ts`、`module/index.ts`、`module.ts`、`contracts.ts`、`base.ts`（仅转发时）
- 禁止为了缩短路径新增“公共出口文件”
- 唯一例外：`libs/platform/src/**/index.ts` 目录级 public API
- 禁止跨域导入目录语义路径，必须直达具体文件
- 禁止把 framework、ORM 或业务层的运行时对象伪装成“DTO 依赖”带入 DTO 文件

## 分层导入规则

- DTO 文件仅可导入：同域 DTO、跨域 DTO 具体文件、`@libs/platform/*` 基础能力、必要的 `@db/schema` 类型或常量、声明期 DTO 组合工具。
- DTO 文件允许导入 DTO 组合 helper；当前允许：`@nestjs/swagger` 中的 `PickType`、`PartialType`、`OmitType`、`IntersectionType`。这类导入仅用于 DTO 字段裁剪、合并和可选化，不视为“拉起运行时对象”。
- DTO 文件禁止导入：任何 barrel、`*.service.ts`、`*.module.ts`、`*.resolver.ts`，以及会引入业务行为的 provider、service、repository、entity、module 级依赖。
- Service / Resolver / Module / Controller 必须直连具体文件，不通过 DTO barrel。
- 业务域 `types/` 目录下的类型文件同样必须直连具体 `*.type.ts` 文件；禁止导入 `../types`、`@libs/foo/bar/types` 这类目录语义路径。
- `apps/*` 也必须直连具体文件，不是例外。

## 例外白名单

- `libs/platform` 仅允许以下目录级入口：`@libs/platform/config`、`@libs/platform/constant`、`@libs/platform/decorators`、`@libs/platform/dto`、`@libs/platform/exceptions`、`@libs/platform/filters`、`@libs/platform/types`、`@libs/platform/utils`、`@libs/platform/modules/auth`、`@libs/platform/modules/captcha`、`@libs/platform/modules/crypto`、`@libs/platform/modules/eventing`、`@libs/platform/modules/geo`、`@libs/platform/modules/logger`、`@libs/platform/modules/sms`。
- `db` 仅允许以下目录级入口：`@db/core`、`@db/extensions`、`@db/schema`。
- 白名单只豁免目录级入口；白名单外的 `@libs/platform/*`、`@db/*` 若要使用，必须直连具体 owner 文件。
- 明确禁止的目录级入口示例：`@libs/platform`、`@libs/platform/modules`、`@db`、`@db/relations`。
- 除 `libs/platform` 与 `db` 外，其他业务域导入都必须直达具体 owner 文件，例如 `@libs/forum/section/dto/forum-section.dto`。

## 正反例

- 允许：`import { BaseForumSectionDto } from '@libs/forum/section/dto/forum-section.dto'`
- 禁止：`import { BaseForumSectionDto } from '@libs/forum/section/dto'`
- 禁止：`import { BaseForumSectionDto } from '@libs/forum/section'`
- 允许：`import { BaseDto, IdDto } from '@libs/platform/dto'`
- 允许：`import { GeoModule } from '@libs/platform/modules/geo'`
- 允许：`import { UploadService } from '@libs/platform/modules/upload/upload.service'`
- 允许：`import type { GrowthRuleRewardSettlementResult } from '@libs/growth/growth-reward/types/growth-reward-result.type'`
- 允许：`import { PickType } from '@nestjs/swagger'`
- 禁止：`import { UploadModule } from '@libs/platform/modules'`
- 禁止：`import type { GrowthRuleRewardSettlementResult } from '@libs/growth/growth-reward/types'`
- 禁止：`import { relationX } from '@db/relations'`
- 禁止：`import { ForumTopicService } from '../forum-topic.service'`
- 禁止：`import { ForumModule } from '../forum.module'`

## 示例

```ts
import type { Db } from '@db/core'
import type { AppUserSelect, ForumTopicSelect } from '@db/schema'

import { AuditRoleEnum, AuditStatusEnum } from '@libs/platform/constant'

import { ArrayProperty, BooleanProperty } from '@libs/platform/decorators'
import { BaseDto, IdDto, PageDto, UserIdDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
```
