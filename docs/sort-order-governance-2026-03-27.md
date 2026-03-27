# sortOrder 统一治理改造方案 V2 (2026-03-27)

## 1. 背景

当前仓库的排序行为存在两个并行问题：

- 同类资源在不同模块中的默认排序不一致
- 一部分列表虽然有排序字段，但分页稳定性、范围约束、写入维护策略并没有真正收口

关系表结构改造已经独立完成，详见 [relation-table-refactor-2026-03-27.md](./relation-table-refactor-2026-03-27.md)。

因此，本轮不再讨论“关系表是否去 `id` / 去通用时间字段”，而是在既有结构基础上，把排序语义和实现路径收口为一套可执行的改造方案。

## 2. 本轮目标

本轮要解决的是“怎么改”而不是“长期规范百科”。

目标只有 4 个：

1. 统一真正受管理资源的默认排序语义
2. 收口分页查询的稳定排序行为
3. 收口范围内成员排序的交换与新增逻辑
4. 为后续唯一约束和数据修复提供清晰前提

## 2.1 当前进展（2026-03-27 更新）

截至当前实现，以下收口已经落地：

- `content/category`、`content/tag`、`forum/section-group`、`forum/section`、`forum/tag`、`work_chapter`、`sys_dictionary_item`、`user_level_rule`、`user_badge` 的管理端分页默认排序已对齐到 `sortOrder asc`
- `forum_tag`、`forum_section_group`、`forum_section`、`sys_dictionary_item`、默认等级选择路径已补齐稳定决胜字段
- `buildDrizzlePageQuery()` / `buildDrizzleOrderBy()` 的职责已经拆开，service 层统一通过 `buildPage()` / `buildOrderBy()` 复用
- `maxOrder` 已收紧为强类型列引用 helper，不再接受字符串字段名，也不再存在“字段不存在静默返回 0”的路径

本方案后续阶段应主要聚焦：

- 范围唯一约束与重复数据审计
- 范围内新增写路径的并发语义

## 3. 本轮非目标

为了避免过度改造，本轮明确不做以下事情：

- 不重新裁决关系表 `id` / 时间字段方案
- 不维护全仓库逐模块、逐页面的长期排序百科
- 不为了形式统一，把所有没有 `sortOrder` 的模块都改成同一种业务排序
- 不在基础设施层维护一个“按表名注册全仓库排序策略”的中心表
- 不把数据库唯一约束作为本轮的强制前置条件

## 4. 改造前提

本方案默认以下事实已经成立：

- 关系表结构改造已完成
- 当前 schema 为本轮真实依据
- 若 schema、service 实现与旧文档冲突，以当前 schema 为准

这意味着本轮不再重复讨论已经落地的关系表结论。

明确对齐如下：

- `work_author_relation` 仍承载成员排序语义
- `work_category_relation` 仍承载成员排序语义
- `work_tag_relation` 已退出成员排序语义，不再纳入 `sortOrder` 治理

## 5. 目标状态

### 5.1 受管理资源

对于真正用于人工排列的资源或成员：

- 默认顺序统一为 `sortOrder asc` + 稳定决胜字段
- `sortOrder` 语义统一为“小值在前”
- `admin` 与 `app` 默认共享同一排序契约
- 时间视图只作为显式切换能力存在，不再作为默认回退

### 5.2 非 `sortOrder` 模块

对于不依赖人工排序的模块：

- 不再推断或补入 `sortOrder`
- 模块优先声明自己的业务默认排序
- 如果模块没有声明业务默认，则统一由分页辅助回退到 `id desc`
- 没有 `id` 的表必须显式声明排序与稳定决胜字段

这里要强调：

- `id desc` 是工程回退，不是业务语义

### 5.3 稳定排序

所有分页查询和默认列表都必须满足：

- 非唯一主排序字段后追加稳定决胜字段
- 有 `id` 时优先追加 `id`
- 无 `id` 时追加主键剩余列或唯一字段
- `db.query.*`、手写 `select().orderBy(...)`、手写 SQL 一律遵守同一规则

### 5.4 范围内排序

所有成员排序统一视为“范围内排序”：

- 顺序只在所有者范围内有效
- 交换、拖拽、批量重排不得跨范围
- 是否同范围，必须在 service 层显式校验

典型范围：

- `workId`
- `packId`
- `dictionaryCode`
- `groupId`

## 6. 当前缺口

本轮改造主要针对以下真实缺口：

### 6.1 用户可见默认顺序不一致

这部分核心缺口已基本完成，当前不再把它视为阻塞项。

已完成对齐的模块：

- `content/category`
- `content/tag`
- `forum/section-group`
- `forum/section`
- `forum/tag`
- `work_chapter`
- `sys_dictionary_item`
- `user_level_rule`
- `user_badge`

说明：

- `work_chapter` 的相邻章节导航仍按 `(workId, sortOrder)` 语义工作，这里依赖 schema 中已存在的唯一约束，不额外补 `id` 决胜字段

### 6.2 基础设施语义仍偏宽松

当前基础设施还不够收口：

- `buildDrizzlePageQuery()` 已收口为纯分页 helper，但排序治理还需要继续通过 `buildDrizzleOrderBy()` 和 service 显式声明落到旧调用面
- `max(sortOrder) + 1` 的使用方式还没有明确并发失败语义

### 6.3 约束与写路径尚未闭环

- 一部分 `sortOrder` 表只有普通索引，还没有范围唯一约束
- 约束未补前，重复值仍可能出现
- 约束一旦补上，新增和交换路径又必须具备明确的冲突处理策略

## 7. 改造策略

本轮采用“先统一可见行为，再收口基础设施，最后决定是否补约束”的策略，不做一次性大爆改。

### 7.1 第一类改造：先统一默认排序行为

优先处理直接影响后台和前台感知的模块。

本轮优先对齐到统一默认顺序的对象：

- `content/category`
- `content/tag`
- `forum/section-group`
- `forum/section`
- `forum/tag`
- `work_chapter`
- `emoji_pack`
- `emoji_asset`
- `sys_dictionary_item`
- `user_level_rule`
- `user_badge`

改造要求：

- 默认排序改为 `sortOrder asc` + 稳定决胜字段
- 保留显式自定义排序入参能力
- 不再把时间排序当作默认回退

### 7.2 第二类改造：收口范围内排序行为

对真正存在成员顺序语义的范围表，统一收口交换与新增行为。

本轮纳入：

- `work_chapter`
- `work_author_relation`
- `work_category_relation`
- `emoji_asset`
- `sys_dictionary_item`
- `forum_section`

改造要求：

- 新增时在范围内追加到尾部
- 交换时校验同范围
- 后续若增加批量重排，也必须在同一范围内执行

明确排除：

- `work_tag_relation`

它已经不是成员排序表，本轮不再为它设计 `sortOrder` 写入或唯一约束。

### 7.3 第三类改造：补齐共享辅助，但只做小收口

本轮可以沉淀共享能力，但只沉淀“不会复制业务知识”的那部分。

建议补的能力：

- 稳定排序构造器
- `sortOrder` 默认排序构造器
- 范围一致性校验辅助

不建议补的能力：

- `isSortOrderManagedResource(tableName)`
- 通过字符串 `tableName` 推断默认排序
- 维护“仓库里每张表该怎么排”的中心注册表

原因是这类做法会形成第二事实来源，后续很容易再次和 schema / service 漂移。

### 7.4 第四类改造：为后续唯一约束做准备

唯一约束可以补，但不建议和“默认排序行为对齐”绑成一个大批次。

更稳的顺序是：

1. 先把默认排序与写路径维护逻辑改对
2. 再审计重复数据
3. 再决定是否补唯一约束

只有真正满足以下条件的表，才进入唯一约束评估：

- `sortOrder` 的业务语义已确认
- 写入路径已维护完成
- 范围定义已稳定

## 8. 基础设施落地要求

### 8.1 `buildDrizzlePageQuery()` / `buildDrizzleOrderBy()`

继续保留当前职责边界：

- `buildDrizzlePageQuery()` 只负责 `pageIndex` / `pageSize` / `limit` / `offset`
- `buildDrizzleOrderBy()` 负责排序字段校验、方向校验、稳定 `id` 补尾，以及 `orderBy` / `orderBySql` 双输出

同时补充落地要求：

- 对无 `id` 的表，service 必须显式传入稳定决胜字段或明确 `fallbackOrderBy`
- `DrizzleService.buildPage()` / `buildOrderBy()` 只作为 service 层包装，不再重新耦合分页与排序语义
- 不允许把无 `id` 表继续交给通用 `id desc` 回退

### 8.2 `maxOrder`

当前 `maxOrder` 已经完成一轮收口：

- 改为直接传入列引用，避免字符串字段名漂移
- 不再存在“字段不存在返回 `0`”的静默路径
- 空范围仍返回 `0`，继续作为追加排序的起点

### 8.3 `getNextSortOrder`

如果本轮新增共享的 `getNextSortOrder` 或等价能力，必须同时定义：

- 范围条件如何传入
- 字段不存在时如何失败
- 并发冲突如何处理

本轮允许继续使用 `max(sortOrder) + 1`，但必须把它限定为：

- 低并发后台场景可用
- 后续若补唯一约束，必须配套重试、锁或等价冲突处理策略

## 9. 分阶段实施

### 阶段一：冻结目标状态

- 先确认哪些表仍然承载 `sortOrder` 语义
- 先确认哪些表只是工程回退到 `id desc`
- 先确认哪些关系表已退出排序治理

产出：

- 一份不再和 schema 冲突的基线文档

### 阶段二：对齐用户可见默认行为

- 先修正后台和前台默认排序不一致的问题
- 先修正明显错误的 `sortOrder desc`
- 先修正应使用范围排序却仍回退全局默认的分页接口

产出：

- 用户直接感知的默认顺序统一

### 阶段三：收口范围排序写路径

- 统一新增时的尾部追加逻辑
- 统一交换时的范围校验逻辑
- 统一后续批量重排的边界要求

产出：

- 成员排序的读写语义闭环

### 阶段四：收口共享辅助

- 提炼稳定排序 helper
- 提炼受管理 `sortOrder` helper
- 提炼范围校验 helper

产出：

- 减少各服务重复手写排序逻辑

### 阶段五：评估并补数据库约束

- 扫描重复 `sortOrder`
- 修复重复数据
- 按稳定范围补唯一约束
- 为冲突路径补回归测试

产出：

- `sortOrder` 从软约定升级为数据库可验证契约

## 10. 验收标准

本轮完成后，应至少满足以下验收条件：

- 真正受管理的排序资源，默认都是 `sortOrder asc` + 稳定决胜字段
- `admin` 和 `app` 对同一资源不再默认相反排序
- 无 `id` 的分页查询不再依赖通用 `id desc` 回退
- 范围内排序的交换逻辑都能拒绝跨范围操作
- 退出排序治理的表不再被错误纳入改造目标
- 后续若补唯一约束，已有明确的数据修复和冲突处理路径

## 11. 执行清单

本节把方案落到可执行层，直接给出每个阶段的主要落点文件、改造动作和验证重点。

### 11.1 阶段二执行清单：对齐用户可见默认行为

状态：

- 上述 A/B/C 三组核心模块已完成第一轮默认排序对齐
- 当前若继续推进，应转向“剩余直连查询补稳定字段”和“唯一约束评估”

#### A. 内容分类 / 标签

主要文件：

- `libs/content/src/category/category.service.ts`
- `apps/admin-api/src/modules/content/category/category.controller.ts`
- `libs/content/src/tag/tag.service.ts`
- `apps/admin-api/src/modules/content/tag/tag.controller.ts`

改造动作：

- 把默认分页顺序从 `sortOrder desc` 改为 `sortOrder asc, id asc`
- 保持调用方显式传入 `orderBy` 时仍可覆盖
- 检查 Swagger / DTO 注释是否仍表达“小值在前”

验证重点：

- 管理端分页默认顺序与拖拽后的展示顺序一致
- 显式传入 `orderBy` 时不破坏现有覆盖能力

#### B. 论坛板块分组 / 板块 / 标签

主要文件：

- `libs/forum/src/section-group/forum-section-group.service.ts`
- `apps/admin-api/src/modules/system/section-group/forum-section-group.controller.ts`
- `apps/app-api/src/modules/forum/forum-section-group.controller.ts`
- `libs/forum/src/section/forum-section.service.ts`
- `apps/admin-api/src/modules/forum/section/forum-section.controller.ts`
- `apps/app-api/src/modules/forum/forum-section.controller.ts`
- `libs/forum/src/tag/forum-tag.service.ts`
- `apps/admin-api/src/modules/forum/tag/forum-tag.controller.ts`

改造动作：

- `forum_section_group` 默认分页改为 `sortOrder asc, id asc`
- `forum_section` 管理端分页从通用默认改为范围内 `sortOrder asc, id asc`
- `forum_tag` 保持默认 `sortOrder asc`，补齐稳定决胜字段表达

验证重点：

- 管理端与应用端对同一资源不再默认相反排序
- 板块分页在带 `groupId` 和不带 `groupId` 时都保持稳定顺序

#### C. 章节 / 表情 / 字典项 / 等级规则 / 徽章

主要文件：

- `libs/content/src/work/chapter/work-chapter.service.ts`
- `apps/admin-api/src/modules/content/comic/chapter/comic-chapter.controller.ts`
- `apps/admin-api/src/modules/content/novel/novel-chapter.controller.ts`
- `apps/app-api/src/modules/work/work-chapter.controller.ts`
- `libs/interaction/src/emoji/emoji-asset.service.ts`
- `apps/admin-api/src/modules/content/emoji/emoji-pack.controller.ts`
- `apps/admin-api/src/modules/content/emoji/emoji-asset.controller.ts`
- `apps/app-api/src/modules/emoji/emoji.controller.ts`
- `libs/config/src/dictionary/dictionary.service.ts`
- `apps/admin-api/src/modules/system/dictionary/dictionary.controller.ts`
- `apps/app-api/src/modules/dictionary/dictionary.controller.ts`
- `libs/growth/src/level-rule/level-rule.service.ts`
- `apps/admin-api/src/modules/growth/level-rule/level-rule.controller.ts`
- `libs/growth/src/badge/user-badge.service.ts`
- `apps/admin-api/src/modules/growth/badge/badge.controller.ts`

改造动作：

- `work_chapter` 管理端分页默认改为范围内 `sortOrder asc, id asc`
- `emoji_pack`、`emoji_asset` 维持升序契约，补齐文档与默认排序表达的一致性
- `sys_dictionary_item` 管理端分页改为 `dictionaryCode` 范围内 `sortOrder asc, id asc`
- `user_level_rule`、`user_badge` 管理端分页改为 `sortOrder asc, id asc`

验证重点：

- `work_chapter` 默认分页顺序与相邻章节导航语义不冲突
- 字典项在同一 `dictionaryCode` 内拖拽后顺序正确
- 等级规则和徽章页默认不再回退到 `id desc`

### 11.2 阶段三执行清单：收口范围排序写路径

#### A. 范围内交换逻辑

主要文件：

- `libs/content/src/work/chapter/work-chapter.service.ts`
- `libs/config/src/dictionary/dictionary.service.ts`
- `libs/forum/src/section/forum-section.service.ts`
- `libs/interaction/src/emoji/emoji-asset.service.ts`
- `db/extensions/swapField.ts`

改造动作：

- 审核所有 `swapField()` 调用点，确认都带上正确的 `sourceField`
- 对无 `sourceField` 的排序交换，确认是否真的是全局资源
- 若后续出现无 `id` 的范围排序交换，不继续沿用当前仅支持 `{ id }` 的接口形态

验证重点：

- 跨范围交换被拒绝
- 同范围交换仍保持原子性
- 唯一约束补齐后，交换逻辑不因中间态冲突而失效

#### B. 范围内追加逻辑

主要文件：

- `libs/content/src/category/category.service.ts`
- `libs/content/src/tag/tag.service.ts`
- `libs/interaction/src/emoji/emoji-asset.service.ts`
- `db/extensions/maxOrder.ts`

改造动作：

- 审核新增时使用 `maxOrder` 的写路径
- 明确哪些是全局追加，哪些是范围内追加
- 对治理后的正式路径，去掉“字段不存在返回 0”的静默行为

验证重点：

- 新增记录会被追加到正确范围的尾部
- 错误字段名或错误范围条件会显式失败

### 11.3 阶段四执行清单：共享辅助收口

主要文件：

- `db/core/query/page-query.ts`
- `db/core/query/order-by.ts`
- `db/core/drizzle.service.ts`
- `db/extensions/maxOrder.ts`
- `db/extensions/swapField.ts`
- `libs/platform/src/config/page-query.spec.ts`
- `libs/forum/src/section/forum-section.service.spec.ts`

改造动作：

- 在 `order-by` 侧沉淀稳定排序能力，并保持 `page-query` 只处理分页
- 明确无 `id` 表必须由 service 显式传入稳定决胜字段
- 如新增 service 包装 helper，只提供“纯分页 / 稳定排序 / 范围校验”这类小能力
- 不引入基于 `tableName` 的全局排序注册表

验证重点：

- 现有 `buildDrizzlePageQuery()` / `buildDrizzleOrderBy()` 测试继续通过
- `DrizzleService.buildPage()` / `buildOrderBy()` 的使用层测试继续通过
- 新增规则能覆盖无 `id` 表的稳定排序场景
- 新 helper 不复制一份领域表名单

### 11.4 阶段五执行清单：唯一约束评估与落地

优先评估对象：

- `work_category`
- `work_tag`
- `forum_section_group`
- `forum_tag`
- `emoji_pack`
- `emoji_asset`
- `sys_dictionary_item`
- `work_author_relation`
- `work_category_relation`
- `work_chapter`
- `user_level_rule`
- `user_badge`

不纳入本轮评估：

- `work_tag_relation`

改造动作：

- 先扫重复 `sortOrder`
- 再补修复脚本
- 最后补唯一约束或部分唯一索引

验证重点：

- 重复数据已清理
- 写路径在唯一约束下仍可正常新增和交换

### 11.5 验证命令

建议按阶段执行以下验证：

- `pnpm type-check`
- `pnpm eslint libs/content/src/category/category.service.ts libs/content/src/tag/tag.service.ts`
- `pnpm eslint libs/forum/src/section-group/forum-section-group.service.ts libs/forum/src/section/forum-section.service.ts libs/forum/src/tag/forum-tag.service.ts`
- `pnpm eslint libs/content/src/work/chapter/work-chapter.service.ts libs/config/src/dictionary/dictionary.service.ts libs/interaction/src/emoji/emoji-asset.service.ts`
- `pnpm eslint libs/growth/src/level-rule/level-rule.service.ts libs/growth/src/badge/user-badge.service.ts db/core/query/page-query.ts db/extensions/maxOrder.ts db/extensions/swapField.ts`
- `pnpm jest libs/platform/src/config/page-query.spec.ts`
- `pnpm jest libs/forum/src/section/forum-section.service.spec.ts`

如果阶段五涉及 schema / migration，再追加：

- 针对迁移脚本的 dry-run 或 staging 数据验证
- 重复 `sortOrder` 扫描脚本输出核对

## 12. 本轮仍需业务确认的点

本轮还剩 3 个需要确认的业务点：

1. `user_level_rule.sortOrder` 是否按 `business` 分范围
2. `user_badge.sortOrder` 是否按 `business` 分范围
3. `forum_section` 在 `groupId = null` 时是否共享一个显式范围

## 13. 结论

这份 V2 应被视为“排序治理改造方案”，而不是长期规范条款。

它的核心不是枚举一切规则，而是把本轮改造收敛为一条可执行路径：

- 先承认哪些地方有缺口
- 再明确目标状态
- 再按阶段修正默认行为、写路径和基础设施
- 最后再决定是否把排序约束落到数据库层

这样可以避免再次写出一份很全、但很快就会漂移的“规范型文档”。
