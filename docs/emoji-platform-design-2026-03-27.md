# ES 统一表情平台方案（仓库规范版）

> 更新时间：2026-03-27
> 基于 `emoji-platform-design-2026-03-26.md` 的规范收敛版。
> 目标：在不破坏现有对外契约前提下，为 chat/comment/forum 提供统一 Inline Emoji + Catalog 能力。

## 1. 当前范围（明确）

- 支持：Inline Emoji（正文内联）+ Emoji Catalog（统一目录）。
- 支持：后台上传与维护系统表情。
- 支持：按表情包（Pack）管理，可同时启用多套。
- 不支持：普通用户上传表情。
- 不支持：Emoji Reaction（本期不落库、不开放 API）。

## 2. EmojiParser 负责什么

`EmojiParser` 是“正文解析层”，负责把输入文本转换为结构化 token，并按场景完成短码解析与容错降级。

### 2.1 输入

- `body: string`
- `scene: 1 | 2 | 3`（1 chat, 2 comment, 3 forum）
- `locale?: string`（默认 `zh-CN`）

### 2.2 输出 token

- `text`：普通文本。
- `emojiUnicode`：Unicode 表情，字段含 `unicodeSequence`。
- `emojiCustom`：自定义表情，字段含 `shortcode`、`packCode`、`imageUrl`、`staticUrl`、`isAnimated`、`ariaLabel`。

### 2.3 核心行为

- 识别 Unicode Emoji 与 `:shortcode:`。
- 根据 `sceneType`（数值数组）与 `isEnabled + deletedAt` 过滤可用包与资产。
- `:shortcode:` 未命中时原样输出（容错，不破坏原文）。
- 包或资产被禁用/软删除时降级为 `text` token。
- 可选输出 `bodyTokens`（jsonb）用于读路径提速；正文仍保存原始文本/Markdown。

### 2.4 非职责

- 不负责数据库写入事务编排。
- 不负责最终 HTML 生成（由业务渲染层处理）。
- 不负责上传与资源处理（由上传模块与资产服务处理）。

### 2.5 类型草案

```ts
export type EmojiScene = 1 | 2 | 3 // 1 chat, 2 comment, 3 forum

export type EmojiToken =
  | { type: 'text', text: string }
  | { type: 'emojiUnicode', unicodeSequence: string }
  | {
      type: 'emojiCustom'
      shortcode: string
      packCode: string
      imageUrl: string
      staticUrl?: string
      isAnimated: boolean
      ariaLabel?: string
    }
```

## 3. 数据模型约束（按仓库规范）

- Drizzle schema 字段名使用 camelCase，数据库列由 `casing: 'snake_case'` 自动映射。
- 状态优先使用 `isEnabled + deletedAt`；避免 `active/disabled/deleted` 字符串枚举直接落库。
- 管理类实体统一保留审计字段：`createdById`、`updatedById`、`createdAt`、`updatedAt`。
- 多对多映射表优先复合主键，不强制增加单独 `id`。
- 场景/类型枚举优先 `smallint`（与现有 schema 风格一致）。
- 关系在 `db/relations/*` 统一维护；schema 不强依赖 `.references(...)`。

## 4. 表设计（规范版）

下述字段名为 Drizzle 代码字段名，实际数据库列将映射为 snake_case。

### 4.1 `emoji_pack`

用途：表情包主表。

- `id`: `integer` pk identity
- `code`: `varchar(64)` not null，唯一（机器标识，如 `default`, `cat_funny`）
- `name`: `varchar(100)` not null
- `description`: `varchar(500)`
- `iconUrl`: `varchar(500)`
- `sortOrder`: `integer` default 0 not null
- `isEnabled`: `boolean` default true not null
- `visibleInPicker`: `boolean` default true not null
- `sceneType`: `smallint[]` not null（场景类型数组：1 chat, 2 comment, 3 forum，默认 `[1,2,3]`）
- `createdById`: `integer`
- `updatedById`: `integer`
- `createdAt`: `timestamp(tz)` defaultNow not null
- `updatedAt`: `timestamp(tz)` onUpdate not null
- `deletedAt`: `timestamp(tz)`

建议索引：

- `unique(code)`
- `index(isEnabled)`
- `index(sortOrder)`
- `index(deletedAt)`
- `index(isEnabled, deletedAt, sortOrder)`
- `index(sceneType)`（GIN）
- `index(isEnabled, deletedAt)`

### 4.2 `emoji_asset`

用途：表情资产主表（Unicode + 自定义统一）。

- `id`: `integer` pk identity
- `packId`: `integer` not null
- `kind`: `smallint` not null（1 unicode, 2 custom）
- `shortcode`: `varchar(32)`（custom 必填）
- `unicodeSequence`: `varchar(191)`（unicode 必填）
- `imageUrl`: `varchar(500)`（custom 必填）
- `staticUrl`: `varchar(500)`（动图建议有）
- `isAnimated`: `boolean` default false not null
- `category`: `varchar(32)`
- `keywords`: `jsonb`（按语言存关键词）
- `sortOrder`: `integer` default 0 not null
- `isEnabled`: `boolean` default true not null
- `createdById`: `integer`
- `updatedById`: `integer`
- `createdAt`: `timestamp(tz)` defaultNow not null
- `updatedAt`: `timestamp(tz)` onUpdate not null
- `deletedAt`: `timestamp(tz)`

建议索引与约束：

- `index(packId, sortOrder)`
- `index(packId, isEnabled, deletedAt, sortOrder)`
- `index(kind)`
- `index(category)`
- `index(deletedAt)`
- `uniqueIndex(shortcode)` where `shortcode is not null and deletedAt is null`
- `check(kind in (1, 2))`
- `check(kind=1 => unicodeSequence not null)`
- `check(kind=2 => shortcode not null and imageUrl not null)`

### 4.3 `emoji_recent_usage`（推荐）

用途：支持 `recent` 查询，避免完全依赖客户端本地缓存。

- `userId`: `integer` not null
- `scene`: `smallint` not null
- `emojiAssetId`: `integer` not null
- `useCount`: `integer` default 1 not null
- `lastUsedAt`: `timestamp(tz)` not null
- `createdAt`: `timestamp(tz)` defaultNow not null
- `updatedAt`: `timestamp(tz)` onUpdate not null

建议主键与索引：

- `primaryKey(userId, scene, emojiAssetId)`
- `index(userId, scene, lastUsedAt desc)`

## 5. Drizzle schema 草案（关键约束示例）

```ts
import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

export const emojiPack = pgTable('emoji_pack', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  code: varchar({ length: 64 }).notNull(),
  name: varchar({ length: 100 }).notNull(),
  description: varchar({ length: 500 }),
  iconUrl: varchar({ length: 500 }),
  sortOrder: integer().default(0).notNull(),
  isEnabled: boolean().default(true).notNull(),
  visibleInPicker: boolean().default(true).notNull(),
  sceneType: smallint().array().default(sql`ARRAY[1,2,3]::smallint[]`).notNull(),
  createdById: integer(),
  updatedById: integer(),
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
  deletedAt: timestamp({ withTimezone: true, precision: 6 }),
}, (table) => [
  unique('emoji_pack_code_key').on(table.code),
  index('emoji_pack_is_enabled_idx').on(table.isEnabled),
  index('emoji_pack_deleted_at_idx').on(table.deletedAt),
  index('emoji_pack_sort_order_idx').on(table.sortOrder),
  index('emoji_pack_scene_type_idx').using('gin', table.sceneType),
  index('emoji_pack_is_enabled_deleted_at_sort_order_idx').on(
    table.isEnabled,
    table.deletedAt,
    table.sortOrder,
  ),
  check('emoji_pack_scene_type_value_chk', sql`${table.sceneType} <@ ARRAY[1,2,3]::smallint[]`),
  check('emoji_pack_scene_type_non_empty_chk', sql`cardinality(${table.sceneType}) > 0`),
])

export const emojiAsset = pgTable('emoji_asset', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  packId: integer().notNull(),
  kind: smallint().notNull(),
  shortcode: varchar({ length: 32 }),
  unicodeSequence: varchar({ length: 191 }),
  imageUrl: varchar({ length: 500 }),
  staticUrl: varchar({ length: 500 }),
  isAnimated: boolean().default(false).notNull(),
  category: varchar({ length: 32 }),
  keywords: jsonb(),
  sortOrder: integer().default(0).notNull(),
  isEnabled: boolean().default(true).notNull(),
  createdById: integer(),
  updatedById: integer(),
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
  deletedAt: timestamp({ withTimezone: true, precision: 6 }),
}, (table) => [
  index('emoji_asset_pack_id_sort_order_idx').on(table.packId, table.sortOrder),
  index('emoji_asset_pack_id_is_enabled_deleted_at_sort_order_idx').on(
    table.packId,
    table.isEnabled,
    table.deletedAt,
    table.sortOrder,
  ),
  uniqueIndex('emoji_asset_shortcode_live_key')
    .on(table.shortcode)
    .where(sql`${table.shortcode} is not null and ${table.deletedAt} is null`),
  check('emoji_asset_kind_chk', sql`${table.kind} in (1, 2)`),
  check(
    'emoji_asset_kind_unicode_required_chk',
    sql`(${table.kind} <> 1) or (${table.unicodeSequence} is not null)`,
  ),
  check(
    'emoji_asset_kind_custom_required_chk',
    sql`(${table.kind} <> 2) or (${table.shortcode} is not null and ${table.imageUrl} is not null)`,
  ),
])
```

## 6. 关系定义建议（`db/relations`）

relations 命名区分“目标实体集合”和“中间表记录集合”：

- `emojiPack.assets`
- `emojiAsset.pack`
- `emojiAsset.recentUsages`

避免裸 `emojis`/`scenes` 造成歧义。

## 7. API 设计（按 Controller 动作规范）

### 7.1 app-api

建议 controller：`@Controller('app/emoji')`

- `GET /api/app/emoji/catalog/list?scene=1|2|3`
- `GET /api/app/emoji/search/list?q=...&scene=1|2|3`
- `GET /api/app/emoji/recent/list?scene=1|2|3`
- `POST /api/app/emoji/recent/report-use`（可选，记录最近使用）

### 7.2 admin-api

建议按资源拆分 controller，动作名对齐仓库约定。

`@Controller('admin/emoji-pack')`

- `GET page`
- `GET detail`
- `POST create`
- `POST update`
- `POST delete`
- `POST update-enabled`
- `POST swap-sort-order`
- `POST update-scene-type`（更新 `sceneType`，示例 `[1,3]`）

`@Controller('admin/emoji-asset')`

- `GET page`
- `GET detail`
- `POST create`
- `POST update`
- `POST delete`
- `POST update-enabled`
- `POST swap-sort-order`

上传建议复用既有上传能力：

- `POST /api/admin/upload/file/upload`（拿资源 URL）
- 再调用 `emoji-asset/create` 落业务资产记录（两步法）

## 8. 存储与渲染策略

- 正文始终存原始文本/Markdown，不存最终 HTML。
- 可选缓存 `bodyTokens`（jsonb）做读路径提速。
- 弱网优先 `staticUrl`，客户端自行降级。
- 输出包含 `ariaLabel` 以支持可访问性。

## 9. 落地阶段

### Phase 1（底座）

- 新建 `emoji_pack`、`emoji_asset`、`emoji_recent_usage`。
- 实现 `EmojiCatalogService`、`EmojiParser`。
- 补齐 `db/relations`、schema export、migration。

### Phase 2（后台）

- 上线包管理、资产管理、场景投放。
- 上传走“先上传后建资产”两步法。

### Phase 3（业务接入）

- chat/comment/forum 接入统一 parser 与 catalog。
- 前端 Picker 支持 pack -> category -> asset。

### Phase 4（治理）

- 审计日志、异常资源告警、使用率统计。

## 10. 与旧版文档差异（关键）

- 状态建模由 `status(active/disabled/deleted)` 调整为 `isEnabled + deletedAt`。
- 字段命名按 Drizzle 代码层 camelCase 统一，数据库自动映射 snake_case。
- 场景投放由独立表收敛为 `emoji_pack.sceneType`（`smallint[]`，数值类型）。
- 本期删除 `emoji_alias`，短码冲突先走“全局唯一 + 运营改名”策略。
- admin 路由动作名收敛到 `create/update/delete/update-enabled/swap-sort-order`。
- 增加 `emoji_recent_usage`，使 `recent` 可服务端稳定返回。
