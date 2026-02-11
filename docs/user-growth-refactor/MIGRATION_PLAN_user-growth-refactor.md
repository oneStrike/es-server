# 用户成长体系重构 - 完整迁移翻案（不保留旧表）

## 1. 目标与约束

- 目标：将成长体系彻底从 forum 语义中解耦，统一为用户成长域；业务域（forum/comic）仅作为事件生产者。
- 约束：不保留 `forum_badge`、`forum_profile_badge` 旧表；无旧表迁移脚本。
- 结果：徽章、积分、经验、等级、成长审计统一归入“用户成长域”模型与逻辑。

---

## 2. 数据表与字段全量清单（改造后）

### 2.1 保留并扩展的表

#### 2.1.1 app_point_rule（积分规则）

**现有字段**
- id, name, type, points, daily_limit, is_enabled, remark, created_at, updated_at

**新增字段（建议）**
- business：业务域（`forum`/`comic`）
- event_key：事件键（如 `forum.topic.create`）
- cooldown_seconds：冷却秒数（用于防刷）
- total_limit：总上限（0=无限）

**保留字段说明**
- type 保留用于历史兼容和过渡期对照，成长域逻辑改为以 business + event_key 为准。

---

#### 2.1.2 app_point_record（积分记录）

**现有字段**
- id, user_id, rule_id, points, before_points, after_points, remark, created_at

**新增字段（建议）**
- event_id：关联 user_growth_event
- event_key：冗余存储事件键，便于查询

---

#### 2.1.3 app_experience_rule（经验规则）

**现有字段**
- id, type, experience, daily_limit, is_enabled, remark, created_at, updated_at

**新增字段（建议）**
- business
- event_key
- cooldown_seconds
- total_limit

---

#### 2.1.4 app_experience_record（经验记录）

**现有字段**
- id, user_id, rule_id, experience, before_experience, after_experience, remark, created_at

**新增字段（建议）**
- event_id
- event_key

---

#### 2.1.5 app_level_rule（等级规则）

**现有字段**
- id, name, required_experience, login_days, description, icon, badge, color, sort_order, is_enabled
- daily_topic_limit, daily_reply_comment_limit, post_interval, daily_like_limit, daily_favorite_limit
- blacklist_limit, work_collection_limit, discount, created_at, updated_at

**新增字段（可选）**
- business（用于限定等级规则作用域）

---

#### 2.1.6 app_user（用户）

**变更**
- 关系字段由 `forumBadges` 调整为 `userBadges`

---

### 2.2 新增表

#### 2.2.1 user_badge（徽章定义）

**字段**
- id（PK）
- name
- type（系统/成就/活动）
- description
- icon
- sort_order
- is_enabled
- created_at
- updated_at

**索引**
- type / sort_order / is_enabled / created_at

---

#### 2.2.2 user_badge_assignment（用户徽章关联）

**字段**
- id（PK）
- user_id
- badge_id
- created_at

**索引**
- user_id / badge_id / created_at
- unique(user_id, badge_id)

---

#### 2.2.3 user_growth_event（成长事件审计）

**字段**
- id（PK）
- business
- event_key
- user_id
- target_id（可空）
- ip（可空）
- device_id（可空）
- occurred_at
- context（jsonb，可空）
- status（如 PROCESSED / REJECTED_ANTIFRAUD / IGNORED_RULE_NOT_FOUND / FAILED）
- rule_refs（jsonb，命中规则摘要）
- points_delta_applied（可空）
- experience_delta_applied（可空）
- badge_ids_applied（jsonb，可空）
- created_at
- updated_at

**索引**
- (business, event_key)
- user_id
- status
- occurred_at

---

### 2.3 删除表（不保留旧表）

#### 2.3.1 forum_badge（待移除）

**字段**
- id, name, type, description, icon, sort_order, is_enabled, created_at, updated_at

#### 2.3.2 forum_profile_badge（待移除）

**字段**
- id, user_id, badge_id, created_at

---

## 3. 逻辑改造范围（全量）

### 3.1 用户成长统一入口

- 新增 `UserGrowthModule.handleEvent(event)` 作为唯一入口。
- 业务域（forum/comic）只负责构造 GrowthEvent 并调用入口。
- GrowthEvent 触发顺序：
  1) 防刷校验  
  2) 写入 user_growth_event  
  3) 规则匹配与子域执行（积分/经验/等级/徽章）  
  4) 回写审计状态与摘要  

---

### 3.2 积分/经验规则事件化

- 规则匹配依据：business + event_key
- forum/漫画事件映射为标准事件键：
  - forum：`forum.topic.create`、`forum.reply.create`、`forum.topic.liked`、`forum.reply.liked`、`forum.topic.favorited`、`forum.signin`
  - comic：`comic.chapter.read`、`comic.chapter.buy`、`comic.work.favorite`
- 规则类型 type 仅保留历史对照，不再作为核心匹配字段。

---

### 3.3 等级规则

- 等级逻辑保持现有规则表（AppLevelRule），升级计算依赖经验变化。
- 经验变更后触发等级重新计算。
- 等级规则可选按 business 维度区分生效范围。

---

### 3.4 徽章逻辑

- 替换 ForumBadgeService → UserBadgeService
- 所有徽章分配/撤销使用 `user_badge` 与 `user_badge_assignment`
- forum 侧徽章接口不再保留

---

### 3.5 防刷与审计

- 防刷基于 userId + eventKey、ip + eventKey、deviceId + eventKey
- 命中防刷：不执行子域逻辑，仅记录审计表
- 规则未命中：记录审计表并标记状态

---

## 4. 需要改动/创建/删除的文件清单（尽可能完整）

### 4.1 需要改动的文件

**Prisma 模型**
- [app-point-rule.prisma](file:///D:/code/es/es-server/prisma/models/app/app-point-rule.prisma)
- [app-point-record.prisma](file:///D:/code/es/es-server/prisma/models/app/app-point-record.prisma)
- [app-experience-rule.prisma](file:///D:/code/es/es-server/prisma/models/app/app-experience-rule.prisma)
- [app-experience-record.prisma](file:///D:/code/es/es-server/prisma/models/app/app-experience-record.prisma)
- [app-level-rule.prisma](file:///D:/code/es/es-server/prisma/models/app/app-level-rule.prisma)
- [app-user.prisma](file:///D:/code/es/es-server/prisma/models/app/app-user.prisma)

**用户成长服务（现有命名需改造）**
- [point.service.ts](file:///D:/code/es/es-server/libs/user/src/point/point.service.ts)
- [point.constant.ts](file:///D:/code/es/es-server/libs/user/src/point/point.constant.ts)
- [point.dto](file:///D:/code/es/es-server/libs/user/src/point/dto)
- [experience.service.ts](file:///D:/code/es/es-server/libs/user/src/experience/experience.service.ts)
- [experience.dto](file:///D:/code/es/es-server/libs/user/src/experience/dto)
- [level-rule.service.ts](file:///D:/code/es/es-server/libs/user/src/level-rule/level-rule.service.ts)
- [level-rule.dto](file:///D:/code/es/es-server/libs/user/src/level-rule/dto)

**论坛域事件生产者（替换直接调用成长服务）**
- [forum-topic.service.ts](file:///D:/code/es/es-server/libs/forum/src/topic/forum-topic.service.ts)
- [profile.service.ts](file:///D:/code/es/es-server/libs/forum/src/profile/profile.service.ts)

**管理端接口（迁移到 user-growth 命名空间）**
- [point.controller.ts](file:///D:/code/es/es-server/apps/admin-api/src/modules/forum-management/point/point.controller.ts)
- [point.module.ts](file:///D:/code/es/es-server/apps/admin-api/src/modules/forum-management/point/point.module.ts)
- [experience.controller.ts](file:///D:/code/es/es-server/apps/admin-api/src/modules/forum-management/experience/experience.controller.ts)
- [experience.module.ts](file:///D:/code/es/es-server/apps/admin-api/src/modules/forum-management/experience/experience.module.ts)
- [level-rule.controller.ts](file:///D:/code/es/es-server/apps/admin-api/src/modules/forum-management/level-rule/level-rule.controller.ts)
- [level-rule.module.ts](file:///D:/code/es/es-server/apps/admin-api/src/modules/forum-management/level-rule/level-rule.module.ts)
- [forum-management.module.ts](file:///D:/code/es/es-server/apps/admin-api/src/modules/forum-management/forum-management.module.ts)

**种子数据（徽章）**
- [seed/index.ts](file:///D:/code/es/es-server/prisma/seed/index.ts)
- [seed/modules/forum/index.ts](file:///D:/code/es/es-server/prisma/seed/modules/forum/index.ts)
- [forum.module.ts](file:///D:/code/es/es-server/libs/forum/src/forum.module.ts)

---

### 4.2 需要新增的文件

**Prisma 新模型**
- `prisma/models/app/user-badge.prisma`
- `prisma/models/app/user-badge-assignment.prisma`
- `prisma/models/app/user-growth-event.prisma`

**用户成长域结构（libs/user 重构）**
- `libs/user/src/growth/growth.module.ts`
- `libs/user/src/growth/events/growth-event.dto.ts`
- `libs/user/src/growth/events/growth-event.service.ts`
- `libs/user/src/growth/audit/growth-audit.service.ts`
- `libs/user/src/growth/antifraud/antifraud.service.ts`
- `libs/user/src/growth/badge/user-badge.service.ts`
- `libs/user/src/growth/badge/dto/*`
- `libs/user/src/growth/points/*`
- `libs/user/src/growth/experience/*`
- `libs/user/src/growth/level/*`

**管理端 User Growth**
- `apps/admin-api/src/modules/user-growth/user-growth.module.ts`
- `apps/admin-api/src/modules/user-growth/points/*`
- `apps/admin-api/src/modules/user-growth/experience/*`
- `apps/admin-api/src/modules/user-growth/level/*`
- `apps/admin-api/src/modules/user-growth/badge/*`
- `apps/admin-api/src/modules/user-growth/event/*`
- `apps/admin-api/src/modules/user-growth/overview/*`

**种子数据**
- `prisma/seed/modules/user-growth/badge.ts`
- `prisma/seed/modules/user-growth/index.ts`

**数据库迁移**
- 新增 Prisma migration：创建 `user_badge`、`user_badge_assignment`、`user_growth_event`；删除 `forum_badge`、`forum_profile_badge`

---

### 4.3 需要删除的文件

**论坛徽章模块**
- `libs/forum/src/badge/forum-badge.service.ts`
- `libs/forum/src/badge/forum-badge.module.ts`
- `libs/forum/src/badge/forum-badge-constant.ts`
- `libs/forum/src/badge/dto/forum-badge.dto.ts`
- `libs/forum/src/badge/index.ts`

**管理端论坛徽章管理**
- `apps/admin-api/src/modules/forum-management/badge/badge.controller.ts`
- `apps/admin-api/src/modules/forum-management/badge/badge.module.ts`

**Prisma 旧模型**
- `prisma/models/forum/forum-badge.prisma`
- `prisma/models/forum/forum-profile-badge.prisma`

**旧种子数据**
- `prisma/seed/modules/forum/badge.ts`

---

## 5. 迁移实施步骤（高层）

1) Prisma 模型调整（新增/删除/字段扩展）
2) 新增 user_growth_event 审计逻辑与防刷模块
3) 重构 libs/user 为用户成长域结构
4) 论坛/漫画逻辑改为事件生产者
5) 管理端接口迁移到 /admin/user-growth
6) 删除旧 forum badge 模块与接口
7) 生成 Prisma migration 并验证（无旧表迁移）

---

## 6. 验收标准（可执行）

- 旧表 `forum_badge`/`forum_profile_badge` 在数据库与模型层全部移除
- 业务域不再直接调用 Forum* 成长服务，统一走 `UserGrowthModule.handleEvent`
- `user_badge`、`user_badge_assignment`、`user_growth_event` 表可正常读写
- 管理端只保留 `/admin/user-growth/*` 成长相关接口
- 成长事件可在审计表完整查询到处理状态与摘要
