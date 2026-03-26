# ES 统一表情平台方案（聊天 / 评论 / 论坛）

> 更新时间：2026-03-26
> 目标：把“表情”升级为平台能力，统一服务聊天、评论、论坛主题/回帖等 UGC 场景。

## 1. 当前范围（明确）

- 支持：Inline Emoji（正文内联表情）+ Emoji Catalog（统一目录）。
- 支持：后台上传与维护系统表情。
- 支持：按“表情包（Pack）”管理，且可同时启用多套。
- 不支持：普通用户上传表情。
- 不支持：Emoji Reaction（本期不做，后续可选）。

## 2. 关键设计原则

### 2.1 Unicode + CLDR 作为基础

- 优先支持 Unicode Emoji（UTS #51）。
- 搜索能力基于 short name / keywords / category（CLDR 思路）。

### 2.2 表情按“包”管理，而不是散点管理

- 每个表情归属一个 `emoji_pack`。
- 包可以启用/禁用、排序、按场景投放（chat/comment/forum）。
- 前端 Picker 以“包”为一级分组，包内再按分类展示。

### 2.3 上传入口仅后台可用

- 上传权限仅管理员/运营角色。
- 普通用户只能使用已发布、已启用的系统表情。

## 3. 能力架构

### 3.1 Inline Emoji（正文内联）

- 正文支持 Unicode 字符和 `:shortcode:`。
- 适用于聊天消息、评论正文、论坛主题和回帖正文。

### 3.2 Emoji Catalog（统一目录）

- 提供按场景返回可用包与表情。
- 提供搜索、热门、最近使用。
- 返回标准化资源信息（静图/动图、可访问性字段等）。

### 3.3 Reaction（后续可选）

- 本期不落库、不开放 API。
- 后续若需要，再独立建模为关系能力。

## 4. 数据模型（多表情包）

### 4.1 表情包表

`emoji_pack`
- `id` (pk)
- `code`（唯一，机器标识，如 `default`, `cat_funny`）
- `name`（展示名）
- `description`
- `icon_url`（包图标，可选）
- `sort_order`（包排序）
- `status` (`active` | `disabled`)
- `visible_in_picker` (bool)
- `created_by`, `updated_by`, `created_at`, `updated_at`

### 4.2 表情资源表

`emoji_asset`
- `id` (pk)
- `pack_id` (fk -> `emoji_pack.id`)
- `kind` (`unicode` | `custom`)
- `shortcode`（`custom` 必填，建议全局唯一）
- `unicode_sequence`（`unicode` 必填）
- `image_url`（`custom` 必填）
- `static_url`（动图建议必填）
- `is_animated` (bool)
- `category`（如 `people`, `food`, `animals`, `brand`）
- `keywords`（json/text，多语言关键词）
- `sort_order`
- `status` (`active` | `disabled` | `deleted`)
- `created_by`, `updated_by`, `created_at`, `updated_at`

### 4.3 表情别名（可选）

`emoji_alias`
- `id`
- `emoji_asset_id`
- `alias`
- `locale`（可选）

### 4.4 场景投放映射（推荐）

`emoji_pack_scene`
- `id`
- `pack_id`
- `scene` (`chat` | `comment` | `forum`)
- `status` (`active` | `disabled`)
- unique: `(pack_id, scene)`

说明：用这张表控制“某个包在哪些业务场景可见”。

## 5. 短码与冲突规则（多包重点）

- 默认规则：`shortcode` 全局唯一，避免 `:smile:` 在不同包冲突。
- 命名规则：`[a-z0-9_]{2,32}`。
- 若导入第三方包发生冲突：
  - 上传时阻止并提示改名，或
  - 自动生成别名并要求运营确认。

## 6. 存储与渲染策略

### 6.1 正文存储

- 正文存原始文本/Markdown，不存最终 HTML。
- 可选缓存 `body_tokens`（解析后 token）用于提速。

### 6.2 解析与容错

解析器 token 建议：
- `text`
- `emoji_unicode`
- `emoji_custom`（含 `shortcode`, `packCode`, `imageUrl`, `staticUrl`）

容错：
- `:shortcode:` 找不到映射时原样输出。
- 包/表情被禁用时降级为文本，不破坏原文。

### 6.3 客户端展示

- 按 `pack -> category -> emoji` 展示 Picker。
- 动图弱网降级静图（`staticUrl`）。
- 提供 `aria-label` 文本以支持可访问性。

## 7. API 设计

### 7.1 业务侧目录 API（前台）

- `GET /api/emoji/catalog?scene=chat|comment|forum&cursor=...`
- `GET /api/emoji/search?q=...&scene=...`
- `GET /api/emoji/recent?scene=...`

返回建议：
- packs: `packCode/name/icon/sortOrder`
- assets: `emojiKey/kind/shortcode/unicodeSequence/imageUrl/staticUrl/category/keywords`

### 7.2 管理后台 API（上传与维护）

- `POST /api/admin/emoji/packs`（新建包）
- `PATCH /api/admin/emoji/packs/:id`（改包信息）
- `POST /api/admin/emoji/packs/:id/disable`
- `POST /api/admin/emoji/packs/:id/enable`
- `PATCH /api/admin/emoji/packs/:id/sort`
- `PATCH /api/admin/emoji/packs/:id/scenes`（配置 chat/comment/forum 可见性）

- `POST /api/admin/emoji/upload`（上传文件，返回资源 URL）
- `POST /api/admin/emoji/assets`（在指定 pack 下创建表情）
- `PATCH /api/admin/emoji/assets/:id`
- `POST /api/admin/emoji/assets/:id/disable`
- `POST /api/admin/emoji/assets/:id/enable`
- `PATCH /api/admin/emoji/assets/:id/sort`

### 7.3 上传策略建议

- 先上传文件到受信对象存储，再创建资产记录（两步法，便于失败回滚）。
- 上传后进行异步处理：缩放、生成静图、内容审查（可接第三方审核）。

## 8. 安全与治理

### 8.1 上传安全基线（OWASP）

- 扩展名白名单 + MIME 检测 + 文件签名检测。
- 文件名重写（UUID），禁止原文件名直出。
- 文件大小限制（建议先 `<= 256KB`，可按业务再调）。
- 存储隔离（对象存储/私有桶 + CDN 域名白名单）。
- 仅后台角色可调用上传 API。

### 8.2 运营治理

- 包和表情均支持 `active/disabled`。
- 支持审计日志：谁在何时上传/修改/禁用。
- 支持场景级启停：包可只在 chat 可见，不在 forum/comment 可见。

## 9. 落地路线图

### Phase 1（底座）
- 新建 `emoji_pack`、`emoji_asset`、`emoji_alias`、`emoji_pack_scene`。
- 实现 `EmojiCatalogService`、`EmojiParser`。
- 上线后台：包管理 + 文件上传 + 资产维护。

### Phase 2（业务接入）
- chat/comment/forum 接入统一 parser 与 catalog。
- 前端 Picker 支持多套包切换、包内分类与搜索。

### Phase 3（治理完善）
- 上线审计日志、禁用回退、异常资源告警。
- 上线统计面板：包使用率、表情使用率、场景覆盖率。

### Phase 4（增强）
- 租户级/组织级包隔离。
- 后续按需求评估 Reaction。

## 10. 与现有枚举关系

- `ChatMessageTypeEnum.SYSTEM`：建议严格“仅服务端可发”。
- `ChatMessageTypeEnum.EMOJI`：可保留为聊天 UI 样式，不承担平台表情主能力。
- 原 `STICKER` 命名统一为“表情（EMOJI）”。

## 11. 参考资料（互联网）

- Unicode UTS #51（Unicode Emoji 标准）
  https://www.unicode.org/reports/tr51/

- Unicode Emoji Data Files
  https://www.unicode.org/Public/emoji/latest/

- CLDR Emoji Names & Keywords
  https://cldr.unicode.org/translation/characters/short-names-and-keywords

- Mastodon CustomEmoji（shortcode/url/static_url/visible_in_picker/category）
  https://docs.joinmastodon.org/entities/CustomEmoji/

- Discord Custom Emojis（命名、格式、权限）
  https://support.discord.com/hc/en-us/articles/360036479811-How-to-Add-Custom-Emojis-on-Discord

- Discourse Custom Emoji 配置
  https://meta.discourse.org/t/configure-custom-emoji/23365

- OWASP File Upload Cheat Sheet
  https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html

- Twemoji
  https://github.com/twitter/twemoji
