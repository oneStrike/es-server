# 用户成长体系重构 - 详细任务清单

## A. Prisma 模型与数据库迁移

### A1. 模型与字段统一调整（新增 + 扩展）
- 新增 user_badge 模型与字段
- 新增 user_badge_assignment 模型与字段
- 新增 user_growth_event 模型与字段
- user_point_rule 增加字段：business、event_key、cooldown_seconds、total_limit
- user_experience_rule 增加字段：business、event_key、cooldown_seconds、total_limit
- user_point_record 增加字段：event_id、event_key
- user_experience_record 增加字段：event_id、event_key
- user_level_rule 增加字段：business（可选）
- app_user 增加关联：userBadges

### A2. 全量命名统一（成长表 app_* → user_*）
- app_point_rule → user_point_rule
- app_point_record → user_point_record
- app_experience_rule → user_experience_rule
- app_experience_record → user_experience_record
- app_level_rule → user_level_rule

### A3. 删除旧模型
- 删除 forum_badge 模型文件
- 删除 forum_profile_badge 模型文件

### A4. 生成迁移
- 创建 Prisma migration：新增 user_badge、user_badge_assignment、user_growth_event
- 创建 Prisma migration：移除 forum_badge、forum_profile_badge
- 创建 Prisma migration：重命名 app_* 规则/记录/等级表为 user_*
- 创建 Prisma migration：新增规则/记录表字段
- 校验迁移依赖与执行顺序

---

## B. 用户成长域重构（libs/user）

### B1. 目录结构重构
- 新增 growth 目录与模块聚合入口
- 拆分 points/experience/level/badge/events/antifraud/audit 子域
- 保持对外导出入口一致或提供兼容层

### B2. Growth 事件模型
- 定义 GrowthEventDto
- 定义 GrowthEventStatus 枚举
- 定义 GrowthEventResult 汇总模型

### B3. 事件入口与流程
- 实现 UserGrowthService.handleEvent
- 接入 AntiFraud 校验
- 写入 user_growth_event 审计记录
- 分发到 points/experience/badge/level 子域
- 回写审计状态与摘要字段

### B4. 防刷模块
- 定义防刷配置模型与规则读取方式
- 实现用户/IP/设备维度冷却与上限判断
- 命中防刷时返回 REJECTED_ANTIFRAUD

### B5. 审计模块
- 创建审计服务与查询接口
- 支持按 userId/eventKey/status/时间范围查询
- 记录命中规则摘要与变更结果

### B6. 积分子域
- 调整规则查询为 business + event_key
- 支持 cooldown_seconds 与 total_limit
- 记录 event_id、event_key 到记录表
- 保持积分变更与用户余额逻辑一致

### B7. 经验子域
- 调整规则查询为 business + event_key
- 支持 cooldown_seconds 与 total_limit
- 记录 event_id、event_key 到记录表
- 触发等级重算

### B8. 等级子域
- 保持等级规则逻辑
- 支持可选 business 维度过滤
- 等级变更与权益读取保持一致

### B9. 徽章子域
- 新建 UserBadgeService
- CRUD 使用 user_badge
- 分配与撤销使用 user_badge_assignment
- 统计与分页查询替换旧逻辑

---

## C. 业务域改造（forum/comic）

### C1. 论坛发帖/回帖/点赞/收藏等事件上报
- forum-topic.service 替换积分调用为 GrowthEvent
- profile.service 替换积分/等级调用为 GrowthEvent
- 统一 eventKey 命名与 payload

### C2. 漫画事件上报
- 识别关键业务点（阅读/购买/收藏）
- 在对应服务中发布 GrowthEvent

### C3. 清理论坛徽章模块
- 删除 libs/forum/src/badge 相关文件
- 移除 forum.module 中 ForumBadgeModule

---

## D. 管理端接口迁移（admin-api）

### D1. 新建 user-growth 模块
- 创建 user-growth.module
- 创建 points/experience/level/badge/event/overview 子模块

### D2. 迁移接口
- 迁移论坛积分接口到 /admin/user-growth/points-rules
- 迁移论坛经验接口到 /admin/user-growth/experience-rules
- 迁移论坛等级接口到 /admin/user-growth/level-rules
- 迁移论坛徽章接口到 /admin/user-growth/badges
- 新增审计查询 /admin/user-growth/events
- 新增成长概览 /admin/user-growth/overview

### D3. 删除旧接口
- 删除 forum-management/point 模块
- 删除 forum-management/experience 模块
- 删除 forum-management/level-rule 模块
- 删除 forum-management/badge 模块
- 更新 forum-management.module 的 imports

---

## E. 种子数据

### E1. 徽章种子迁移
- 新建 user-growth/badge 种子模块
- 调整 seed/index.ts 引用
- 移除 forum/badge 种子模块

---

## F. 测试与校验

### F1. 迁移验证
- 确认 migration 可执行且无依赖冲突
- 校验新表/新字段存在

### F2. 功能验证
- GrowthEvent 触发积分/经验/徽章/等级变更
- 防刷命中写入审计表且不触发变更
- 管理端新接口可正常访问

---

## G. 清理与收尾

### G1. 清理旧引用
- 清理 ForumBadge/ForumProfileBadge 在代码中的引用
- 清理 ForumPoint/Experience/Level 命名残留

### G2. 文档同步
- 更新 MIGRATION_PLAN 与 DESIGN/CONSENSUS 中的实现状态

---

## H. 编码规范要求

### H1. 注释规范
- 统一对齐项目现有模块的注释风格与语言
- 仅在需要的地方添加注释，保持风格一致

### H2. 常量与 DTO 规范
- 必要时新增 constant 文件，命名与现有模块一致
- DTO 按现有模块结构组织与命名
- DTO 字段校验使用项目自定义装饰器与 ApiProperty 规范
- 新增 DTO 时，必要时添加必要的校验注释
- 保持 DTO 字段与数据库模型字段一致
- 新增 DTO 时，相关字段尽可能的复用，避免重复定义
