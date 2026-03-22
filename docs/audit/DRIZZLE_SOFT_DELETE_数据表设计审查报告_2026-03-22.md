# Drizzle 数据表软删除设计审查报告

- 审查时间：2026-03-22
- 审查方式：静态代码审查
- 审查范围：
  - `db/schema/**/*`
  - `db/extensions/{softDelete,existsActive}.ts`
  - 相关 service：
    - `libs/config/src/dictionary`
    - `libs/content/src/{work,author,tag,category}`
    - `libs/forum/src/{topic,section,section-group,moderator,moderator-application,tag}`
    - `libs/growth/src/{task,badge}`
    - `libs/app-content/src/{page,announcement,agreement}`
    - `apps/admin-api/src/modules/app-user`
- 审查口径：
  - 仅以表结构中是否存在 `deletedAt` 字段作为“支持软删除”的判定标准。
  - `revokedAt`、`leftAt`、`status=删除`、`isEnabled=false` 不计入表级软删除。
  - 合理性评估同时参考表语义、引用关系、service 删除实现、恢复需求与当前仓库的 Drizzle 使用方式。

## 总体结论

当前仓库 `db/schema` 共定义 **61 张表**，其中 **14 张表**显式支持软删除，**47 张表**不支持软删除。

整体上，这套设计方向是 **基本合理** 的：

- 需要保留历史、支持恢复、会影响对外可见性的核心主实体，基本都做了软删除。
- 关系表、日志表、流水表、令牌表、快照/缓存表大多没有做软删除，这也符合它们的表语义。
- 真正需要优先处理的，不是“所有表都加 `deletedAt`”，而是少数表存在：
  - 软删除字段已存在，但 service 仍在硬删。
  - 软删除和唯一约束没有形成完整闭环。
  - 某些后台主数据表仍走硬删，长期可追溯性较弱。

本次审查后的整体判断如下：

- **设计合理或基本合理**：大多数日志表、关系表、交互行为表、令牌表、状态快照表，以及 `app_user`、`user_comment`、`forum_topic`、`forum_section`、`work`、`task` 等核心实体。
- **需要优先整改**：
  - `sys_dictionary` / `sys_dictionary_item`
  - `forum_moderator`
  - `app_page`
  - `app_announcement`
  - `app_agreement`
  - `work_category`
- **建议复核或按产品策略决定**：
  - `work_tag`
  - `forum_tag`
  - `user_badge`
  - `work_chapter`

## 当前支持软删除的表清单

| 域 | 表名 | Schema 结论 | 当前实现判断 | 备注 |
| --- | --- | --- | --- | --- |
| app | `app_user` | 有 `deletedAt` | 合理 | 管理端已实现删除与恢复，见 `apps/admin-api/src/modules/app-user/app-user.service.ts` |
| app | `task` | 有 `deletedAt` | 合理 | `TaskService.deleteTask()` 走软删扩展 |
| app | `task_assignment` | 有 `deletedAt` | 基本合理 | 当前更多是保守预留；未见明确删除入口 |
| app | `user_comment` | 有 `deletedAt` | 合理 | 评论可见性、计数回退与软删联动较完整 |
| forum | `forum_topic` | 有 `deletedAt` | 合理 | 删除主题时会级联软删主题下评论 |
| forum | `forum_section` | 有 `deletedAt` | 合理 | 板块作为内容主实体，适合软删 |
| forum | `forum_section_group` | 有 `deletedAt` | 基本合理 | 主数据适合软删，但名称唯一键删除后不可复用 |
| forum | `forum_moderator` | 有 `deletedAt` | 需修正 | `userId` 唯一键与“软删后重建版主”流程冲突 |
| forum | `forum_moderator_application` | 有 `deletedAt` | 合理 | 申请删除后支持复用旧记录重提 |
| system | `sys_dictionary` | 有 `deletedAt` | 设计与实现不一致 | 表支持软删，但 service 仍在硬删 |
| system | `sys_dictionary_item` | 有 `deletedAt` | 设计与实现不一致 | 表支持软删，但 service 仍在硬删 |
| work | `work` | 有 `deletedAt` | 合理 | 作品主实体适合软删，且删除会同步处理论坛板块 |
| work | `work_author` | 有 `deletedAt` | 基本合理 | 作者主数据适合软删，但名称唯一键删除后不可复用 |
| work | `work_chapter` | 有 `deletedAt` | 基本合理 | 章节适合软删，但 `(workId, sortOrder)` 唯一键会占住已删章节号 |

## 全表合理性矩阵

判断口径说明：

- `合理`：当前表语义与生命周期设计匹配。
- `基本合理`：大方向没问题，但存在约束、恢复策略或演进空间。
- `建议复核`：是否需要软删取决于业务策略，当前设计偏硬。
- `建议改造`：当前更适合软删，或至少不应继续直接硬删。
- `设计与实现不一致`：Schema 与 service 的删除策略未对齐。

### admin 域

| 表名 | 是否支持软删 | 判断 | 说明 |
| --- | --- | --- | --- |
| `admin_user` | 否 | 基本合理 | 后台账号已有 `isEnabled`，多数场景停用即可；若未来需要账号恢复/离职留档，可再评估软删 |
| `admin_user_token` | 否 | 合理 | 令牌生命周期由 `revokedAt` 管理，不属于典型软删场景 |

### app 域

| 表名 | 是否支持软删 | 判断 | 说明 |
| --- | --- | --- | --- |
| `app_agreement` | 否 | 建议改造 | 协议属于运营内容主数据，且存在 `app_agreement_log` 历史引用，直接硬删不利于追溯 |
| `app_agreement_log` | 否 | 合理 | 签署日志是事实记录，应保留原始历史，不需要软删 |
| `app_announcement` | 否 | 建议改造 | 公告是后台内容主数据，且存在已读记录 `app_announcement_read`，更适合软删或下线后留档 |
| `app_announcement_read` | 否 | 合理 | 已读记录是用户行为事实，通常不需要软删 |
| `app_config` | 否 | 合理 | 偏单例配置/当前态配置，不属于普通内容删除模型 |
| `app_page` | 否 | 建议改造 | 页面配置是主数据，且会被公告引用；当前批量硬删不利于回溯和配置恢复 |
| `app_user` | 是 | 合理 | 用户主实体必须保留删除痕迹，并且当前已支持恢复 |
| `app_user_count` | 否 | 合理 | 用户计数是聚合快照，随用户存在；不需要独立软删 |
| `app_user_token` | 否 | 合理 | 与管理端 token 类似，令牌状态应通过撤销/过期控制 |
| `growth_audit_log` | 否 | 合理 | 审计日志天然应保留，不应做软删 |
| `growth_ledger_record` | 否 | 合理 | 资产流水是财务/积分事实记录，不应软删 |
| `growth_rule_usage_slot` | 否 | 合理 | 限流槽位是并发控制辅助表，不是业务主数据 |
| `task` | 是 | 合理 | 任务配置是后台主数据，适合下线而不是硬删 |
| `task_assignment` | 是 | 基本合理 | 分配记录保留软删能力可以接受，但当前未见明确删除/恢复生命周期 |
| `task_progress_log` | 否 | 合理 | 进度日志是事实记录 |
| `user_badge` | 否 | 建议复核 | 徽章是主数据；当前删除会先删发放记录再删徽章，历史可追溯性较弱 |
| `user_badge_assignment` | 否 | 基本合理 | 当前把“撤销徽章”建模为删除关系，能跑；若要保留发放-撤销历史，应改为状态化或软删 |
| `user_browse_log` | 否 | 合理 | 浏览日志应视为行为事实，通常不做软删 |
| `user_comment` | 是 | 合理 | 评论存在审核、隐藏、计数回退等需求，适合软删 |
| `user_download_record` | 否 | 合理 | 下载记录是事实行为，通常不应软删 |
| `user_experience_rule` | 否 | 基本合理 | 规则表已用 `isEnabled` 控生命周期，通常可接受 |
| `user_favorite` | 否 | 合理 | 收藏关系撤销时硬删中间表记录即可 |
| `user_level_rule` | 否 | 基本合理 | 等级规则表更偏配置表，`isEnabled` 足够表达生命周期 |
| `user_like` | 否 | 合理 | 点赞关系撤销时硬删中间表记录即可 |
| `user_point_rule` | 否 | 基本合理 | 与经验规则同类，`isEnabled` 足以表达停用 |
| `user_report` | 否 | 合理 | 举报记录属于审核事实与工单记录，不建议软删 |
| `user_work_reading_state` | 否 | 合理 | 阅读状态是当前态快照，不是历史归档表 |

### forum 域

| 表名 | 是否支持软删 | 判断 | 说明 |
| --- | --- | --- | --- |
| `forum_moderator_action_log` | 否 | 合理 | 操作日志应保留，不需要软删 |
| `forum_moderator_application` | 是 | 合理 | 申请记录需要保留审核历史，软删合理，且当前支持重提复用 |
| `forum_moderator` | 是 | 需修正 | 版主主实体适合软删，但 `userId` 唯一键导致删除后无法按当前实现重新创建 |
| `forum_moderator_section` | 否 | 合理 | 版主-板块关系是中间表，分配/取消分配直接硬删即可 |
| `forum_section_group` | 是 | 基本合理 | 分组主数据适合软删，但 `name` 唯一键删除后不可复用 |
| `forum_section` | 是 | 合理 | 板块需要支持下线/历史保留，软删正确 |
| `forum_tag` | 否 | 建议复核 | 标签是典型主数据，当前既有 `isEnabled` 又提供删除接口，更偏向“禁用+软删”组合 |
| `forum_topic` | 是 | 合理 | 主题作为用户内容主实体，软删是合理选择 |
| `forum_topic_tag` | 否 | 合理 | 主题-标签关系是中间表，解除绑定时硬删即可 |
| `forum_user_action_log` | 否 | 合理 | 用户操作日志应保留原始记录 |

### message 域

| 表名 | 是否支持软删 | 判断 | 说明 |
| --- | --- | --- | --- |
| `chat_conversation` | 否 | 基本合理 | 会话表当前更像当前态快照；若未来支持“会话归档/删除”，可再评估 |
| `chat_conversation_member` | 否 | 合理 | 成员退出已由 `leftAt` 表达，不需要额外软删 |
| `chat_message` | 否 | 合理 | 消息生命周期已由 `status`、`editedAt`、`revokedAt` 表达，不必再叠加表级软删 |
| `message_outbox` | 否 | 合理 | 外盒表是可靠投递基础设施表，应按状态驱动而非软删 |
| `message_ws_metric` | 否 | 合理 | 指标/度量表不需要软删 |
| `user_notification` | 否 | 基本合理 | 通知已由 `isRead`、`expiredAt` 管理；若未来需要“删除通知但保留审计”，再评估单独归档方案 |

### system 域

| 表名 | 是否支持软删 | 判断 | 说明 |
| --- | --- | --- | --- |
| `sys_request_log` | 否 | 合理 | 请求日志应保留历史 |
| `sensitive_word` | 否 | 基本合理 | 敏感词库当前更像配置主数据，`isEnabled` 已可表达停用；若要保留删除审计，可再补软删 |
| `sys_config` | 否 | 合理 | 系统配置偏单例当前态，不属于普通删除模型 |
| `sys_dictionary` | 是 | 设计与实现不一致 | Schema 已支持软删，但 service 仍硬删且查询未统一过滤 `deletedAt` |
| `sys_dictionary_item` | 是 | 设计与实现不一致 | 与字典主表同类问题 |

### work 域

| 表名 | 是否支持软删 | 判断 | 说明 |
| --- | --- | --- | --- |
| `work` | 是 | 合理 | 作品主实体适合软删，且当前删除会同步处理关联论坛板块 |
| `work_author` | 是 | 基本合理 | 作者主数据适合软删，但 `name` 唯一键删除后不可复用 |
| `work_author_relation` | 否 | 合理 | 作品-作者关系是中间表，变更关系时硬删即可 |
| `work_category` | 否 | 建议改造 | 分类是典型主数据，当前却直接硬删；同时 service 的“有关联作品禁止删除”检查尚未实现 |
| `work_category_relation` | 否 | 合理 | 作品-分类关系是中间表 |
| `work_chapter` | 是 | 基本合理 | 章节是用户内容的一部分，软删方向正确；但删除后会持续占用章节序号唯一键 |
| `work_comic` | 否 | 合理 | 漫画子表依附 `work` 主表生命周期，不需要独立软删 |
| `work_novel` | 否 | 合理 | 小说子表依附 `work` 主表生命周期，不需要独立软删 |
| `work_tag` | 否 | 建议复核 | 标签是主数据，当前既支持禁用又支持硬删，长期更偏向软删或只禁用 |
| `work_tag_relation` | 否 | 合理 | 作品-标签关系是中间表 |

## 重点问题

### P1. `sys_dictionary` / `sys_dictionary_item` 的 Schema 与 service 删除语义不一致

- 证据：
  - `db/schema/system/system-dictionary.ts`
  - `libs/config/src/dictionary/dictionary.service.ts`
- 现状：
  - 表结构有 `deletedAt`，说明设计意图是支持软删。
  - 但 service 仍然执行 `delete(...)`，分页/查询也未统一过滤 `deletedAt is null`。
- 影响：
  - 当前软删除字段形同虚设。
  - 后续若有人按 schema 直觉使用 `existsActive`/`softDelete`，会与现有 service 行为冲突。
- 建议：
  - 二选一，尽快统一：
    - 若保留软删设计：service 全量改为软删，并统一过滤未删除数据。
    - 若确认字典就该硬删：移除 `deletedAt` 字段，避免误导。

### P1. `forum_moderator` 软删后无法按当前流程重新创建

- 证据：
  - `db/schema/forum/forum-moderator.ts`
  - `libs/forum/src/moderator/moderator.service.ts`
- 现状：
  - 表上对 `userId` 有唯一约束。
  - 删除版主时只更新 `deletedAt`。
  - 创建版主时只检查“是否存在未删除记录”，不会复用已软删记录。
- 影响：
  - 同一用户一旦被移除版主，再授予版主身份时会撞数据库唯一约束。
- 建议：
  - 推荐做法：
    - 创建时若发现同 `userId` 的软删记录，优先恢复并重置字段。
  - 或者：
    - 调整唯一约束策略，例如改为部分唯一索引，仅限制未删除记录。

### P1. `work_chapter` 软删会永久占用章节序号

- 证据：
  - `db/schema/work/work-chapter.ts`
  - `libs/content/src/work/chapter/work-chapter.service.ts`
- 现状：
  - `work_chapter` 支持软删。
  - 但 `(workId, sortOrder)` 仍是全局唯一，不区分 `deletedAt`。
- 影响：
  - 删除章节后，原章节号无法复用。
  - 如果业务希望“删除错误章节后补回同序号”，当前设计会变得别扭。
- 建议：
  - 如果章节号允许复用，应把唯一约束调整为只约束未删除记录。
  - 如果章节号一经使用就永久保留，则当前设计可接受，但应在业务文档中明确。

### P1. `app_page` / `app_announcement` / `app_agreement` 更像应保历史的后台主数据

- 证据：
  - `libs/app-content/src/page/page.service.ts`
  - `libs/app-content/src/announcement/announcement.service.ts`
  - `libs/app-content/src/agreement/agreement.service.ts`
  - `db/schema/app/app-announcement-read.ts`
  - `db/schema/app/app-agreement.ts`
- 现状：
  - 三者目前都走硬删。
  - 但这几张表本质上都是后台运营内容或配置主数据，而且已经产生了下游引用/历史记录。
- 影响：
  - 删除后不利于回溯上线内容、已读记录来源、协议版本历史。
- 建议：
  - 优先考虑改为软删。
  - 至少对外语义应以“停用/下线”为主，而不是直接物理删除。

### P1. `work_category` 当前硬删风险偏高

- 证据：
  - `db/schema/work/work-category.ts`
  - `libs/content/src/category/category.service.ts`
- 现状：
  - 分类表不支持软删。
  - service 提供删除接口，但 `checkCategoryHasWorks()` 当前直接返回 `false`。
- 影响：
  - 一旦执行删除，无法保证没有关联作品。
  - 即使短期不改软删，当前也至少应补真实关联校验。
- 建议：
  - 最低要求：补上真实的“分类仍被作品引用”校验。
  - 更稳妥做法：为 `work_category` 增加 `deletedAt`，删除改为软删。

### P2. `work_tag` / `forum_tag` / `user_badge` 这类主数据当前偏向硬删

- 现状：
  - 它们都不是典型日志表或关系表，而是运营侧主数据。
  - 其中 `work_tag`、`forum_tag` 已同时存在 `isEnabled` 与删除接口。
  - `user_badge` 删除时还会连同发放关系一起物理删除。
- 判断：
  - 当前并非一定错误，但整体风格偏“不可追溯”。
  - 若产品更重视历史留档、误删恢复、运营回滚，这几张表更适合软删或“仅禁用、不删除”。

### P3. 软删字段与命名/索引仍有少量不一致

- `work.deletedAt` 使用了 `"deletedAt"` 作为数据库列名，而仓库其他表大多是 `deleted_at` 风格，见 `db/schema/work/work.ts`。
- 部分软删表没有单独的 `deletedAt` 索引，例如 `app_user`、`work`、`work_chapter`、`sys_dictionary`、`sys_dictionary_item`。
- 这类问题当前更多是可维护性和性能细节，不是第一优先级，但后续可以统一收口。

## 对“没有软删除”的表应如何看待

不能简单把“没有 `deletedAt`”等同于设计错误。当前仓库里有几类表，本来就不适合或不急于做软删：

### 1. 关系表

- 例如：
  - `user_like`
  - `user_favorite`
  - `work_author_relation`
  - `work_category_relation`
  - `work_tag_relation`
  - `forum_topic_tag`
  - `forum_moderator_section`
  - `user_badge_assignment`
- 这类表更像“当前关系是否存在”的表达，取消关系时直接硬删通常是合理的。

### 2. 日志、流水、审计表

- 例如：
  - `sys_request_log`
  - `growth_audit_log`
  - `growth_ledger_record`
  - `task_progress_log`
  - `forum_user_action_log`
  - `forum_moderator_action_log`
  - `user_browse_log`
  - `user_report`
  - `app_agreement_log`
- 这类表保留原始事实更重要，通常不应该做“假删除”。

### 3. 令牌、投递、限流、状态快照表

- 例如：
  - `admin_user_token`
  - `app_user_token`
  - `message_outbox`
  - `growth_rule_usage_slot`
  - `user_work_reading_state`
  - `app_user_count`
- 这类表主要承担基础设施职责或当前态职责，通常通过状态字段、过期时间或重建策略管理生命周期。

### 4. 通过业务状态表达生命周期的表

- 例如：
  - `chat_message` 通过 `status`、`revokedAt` 表达撤回/删除
  - `chat_conversation_member` 通过 `leftAt` 表达退出
  - `admin_user`、`sensitive_word`、`user_level_rule`、`user_point_rule`、`user_experience_rule` 通过 `isEnabled` 表达停用
- 这类表不是绝对不能做软删，但当前已有业务态字段，继续不加 `deletedAt` 是可以自洽的。

## 建议优先级

### 第一优先级

1. 统一 `sys_dictionary` / `sys_dictionary_item` 的 schema 与 service 删除语义。
2. 修正 `forum_moderator` 的“软删后无法重新创建”问题。
3. 补 `work_category` 的真实关联校验，避免误删已被使用的分类。

### 第二优先级

1. 评估 `app_page` / `app_announcement` / `app_agreement` 改为软删的成本与收益。
2. 评估 `work_chapter` 是否允许章节序号复用，并据此决定是否调整唯一约束。
3. 对 `work_tag` / `forum_tag` / `user_badge` 明确产品策略：
   - 只禁用，不删除
   - 允许删除，但保留软删
   - 维持硬删并接受不可追溯

### 第三优先级

1. 统一软删字段命名与索引风格。
2. 补充软删设计约束文档，明确：
   - 哪些表支持恢复
   - 哪些表删除后允许复用唯一键
   - 哪些表必须永久保留历史

## 与当前规则的冲突点

仓库规则 `drizzle-guidelines.md` 明确要求：

- 表存在 `deletedAt` 字段时应走软删。
- 不存在 `deletedAt` 字段时走硬删。

当前最明显的冲突点是：

1. `sys_dictionary` / `sys_dictionary_item` 已有 `deletedAt`，但实际 service 仍走硬删。
2. 少数“看起来更适合软删”的后台主数据表目前仍没有 `deletedAt`，例如 `app_page`、`app_announcement`、`app_agreement`、`work_category`。

这些冲突不代表当前系统马上不可用，但说明“schema 设计”和“业务删除语义”还没有完全收敛到一套一致的生命周期模型。

## 附：本次审查涉及的软删扩展

- `db/extensions/softDelete.ts`
  - 提供 `softDelete` / `softDeleteMany`
  - 要求表必须包含 `deletedAt`
- `db/extensions/existsActive.ts`
  - 对包含 `deletedAt` 的表执行“仅查未删除记录”的存在性判断

这说明仓库已经有明确的软删基础设施，后续更适合做的是“对齐现有设计”，而不是重新发明删除模式。
