# 任务模块设计方案

## 1. 现有项目架构梳理

### 1.1 技术栈与基础设施
- 后端框架：NestJS（基于 Fastify 适配器）
- 数据访问：Prisma + PostgreSQL
- 缓存与限流：Redis + Throttler
- 认证与安全：JWT、CSRF、Helmet
- 文档与校验：Swagger、class-validator/class-transformer
- 定时任务：@nestjs/schedule
- 响应结构统一：全局响应转换拦截器

### 1.2 项目结构与模块划分
- apps
  - admin-api：后台管理接口
  - app-api：客户端接口
- libs（领域与基础能力）
  - base：基础模块（配置、数据库、缓存、日志、拦截器、装饰器等）
  - user：用户成长/积分/等级/徽章相关
  - forum：论坛相关
  - content：内容管理相关
  - dictionary / app-config / system-config：系统与应用配置

### 1.3 数据库设计与约定
- Prisma 多文件模型，统一映射为 snake_case 表名
- 通用字段：created_at / updated_at，常见软删除字段 deleted_at
- 索引策略：高频筛选字段与排序字段均建立索引
- 业务枚举多采用 Int + SmallInt 存储

### 1.4 业务逻辑层结构
- Service 继承 BaseService，统一注入 Prisma Client
- 通用分页：findPagination 扩展，返回 list/total/pageIndex/pageSize
- 管理端与客户端分层清晰，领域逻辑集中在 libs 中复用

### 1.5 API 接口规范
- 全局前缀：/api
- 路由约定：
  - admin：/api/admin/xxx
  - app：/api/app/xxx
- 响应结构：
  - 通用：{ code, message, data }
  - 分页：{ code, message, data: { list, total, pageIndex, pageSize } }
- Swagger 装饰器：ApiDoc / ApiPageDoc 统一描述响应模型

### 1.6 模块依赖关系概览
- BaseModule 提供：日志、数据库、缓存、限流、健康检查、全局校验/响应拦截
- Admin 模块聚合：用户、内容、字典、论坛管理、用户成长、系统配置、上传等
- App 模块聚合：用户、内容、字典、基础配置、认证等

## 2. 任务模块设计目标与业务需求调整

### 2.1 模块定位
- 统一任务发布、领取、进度、完成与奖励发放
- 管理端负责任务配置与运营投放
- 客户端负责任务展示与进度推进

### 2.2 业务需求假设与调整（可在确认后再落地）
- 任务面向 app 用户公开投放，不支持管理员指派
- 任务支持新手任务、运营任务、活动任务等类型
- 任务可配置发布窗口与启用状态
- 任务完成可触发用户成长事件（积分/经验/徽章），与现有成长体系打通
- 奖励允许多种组合（积分+经验+徽章）
- 支持一次性任务与周期性任务（按日/周/月）

### 2.3 任务类型枚举示例
- 任务类型枚举（type）示例：
  - 1 新手任务
  - 2 日常任务
  - 3 周期任务
  - 4 活动任务
  - 5 运营任务

## 3. 数据库表结构设计

### 3.1 task（任务定义表）
用途：存储任务模板与投放规则

| 字段 | 类型 | 说明 | 约束 |
| --- | --- | --- | --- |
| id | Int | 主键 | 自增 |
| code | String | 任务唯一编码 | unique, varchar(50) |
| title | String | 任务标题 | varchar(200) |
| description | String? | 任务说明 | varchar(1000) |
| cover | String? | 封面图 | varchar(255) |
| type | Int | 任务类型 | smallint |
| status | Int | 任务状态（草稿/发布/下线） | smallint |
| priority | Int | 优先级 | smallint |
| isEnabled | Boolean | 启用状态 | default true |
| claimMode | Int | 领取模式（自动/手动） | smallint |
| completeMode | Int | 完成模式（自动/手动） | smallint |
| targetCount | Int | 完成目标次数 | default 1 |
| rewardConfig | Json? | 奖励配置（支持组合：积分/经验/徽章/自定义） | jsonb |
| publishStartAt | DateTime? | 发布开始时间 | timestamptz |
| publishEndAt | DateTime? | 发布结束时间 | timestamptz |
| repeatRule | Json? | 周期规则（daily/weekly/monthly 等） | jsonb |
| createdById | Int? | 创建人（管理员） | FK admin_user |
| updatedById | Int? | 更新人（管理员） | FK admin_user |
| createdAt | DateTime | 创建时间 | default now |
| updatedAt | DateTime | 更新时间 | @updatedAt |
| deletedAt | DateTime? | 软删除时间 |  |

索引建议：
- unique(code)
- index(status, isEnabled)
- index(type)
- index(publishStartAt)
- index(publishEndAt)
- index(createdAt)

### 3.2 task_assignment（用户任务表）
用途：记录用户领取与完成情况

| 字段 | 类型 | 说明 | 约束 |
| --- | --- | --- | --- |
| id | Int | 主键 | 自增 |
| taskId | Int | 任务ID | FK task |
| userId | Int | 用户ID | FK app_user |
| cycleKey | String? | 周期实例键（如 2026-02-13） | varchar(20) |
| status | Int | 状态（未领取/进行中/已完成/已过期） | smallint |
| progress | Int | 当前进度 | default 0 |
| target | Int | 目标值 | default 1 |
| claimedAt | DateTime? | 领取时间 | timestamptz |
| completedAt | DateTime? | 完成时间 | timestamptz |
| expiredAt | DateTime? | 过期时间 | timestamptz |
| taskSnapshot | Json? | 任务快照（标题/奖励等） | jsonb |
| context | Json? | 业务上下文 | jsonb |
| version | Int | 乐观锁版本 | default 0 |
| createdAt | DateTime | 创建时间 | default now |
| updatedAt | DateTime | 更新时间 | @updatedAt |
| deletedAt | DateTime? | 软删除时间 |  |

索引建议：
- unique(taskId, userId, cycleKey)
- index(userId, status)
- index(taskId)
- index(completedAt)
- index(expiredAt)

### 3.3 task_progress_log（任务进度日志表）
用途：进度变更与幂等追踪

| 字段 | 类型 | 说明 | 约束 |
| --- | --- | --- | --- |
| id | Int | 主键 | 自增 |
| assignmentId | Int | 用户任务ID | FK task_assignment |
| userId | Int | 用户ID | FK app_user |
| actionType | Int | 操作类型（领取/推进/完成/撤销） | smallint |
| delta | Int | 进度变化 |  |
| beforeValue | Int | 变更前进度 |  |
| afterValue | Int | 变更后进度 |  |
| context | Json? | 变更上下文 | jsonb |
| createdAt | DateTime | 创建时间 | default now |

索引建议：
- index(assignmentId)
- index(userId, createdAt)

## 4. API 接口设计（RESTful）

### 4.1 管理端接口（/api/admin/task）

1) 查询任务列表（分页）
- GET /api/admin/task/list
- Query：pageIndex, pageSize, status, type, isEnabled, title
- Response（分页）

2) 获取任务详情
- GET /api/admin/task/detail?id=1
- Response：TaskDto

3) 创建任务
- POST /api/admin/task/create
- Body：CreateTaskDto
- Response：{ id }

4) 更新任务
- POST /api/admin/task/update
- Body：UpdateTaskDto
- Response：TaskDto

5) 更新任务状态/启用
- POST /api/admin/task/update-status
- Body：{ id, status, isEnabled }
- Response：TaskDto

6) 删除任务（软删除）
- POST /api/admin/task/delete
- Body：{ id }
- Response：{ id }

7) 查询用户任务列表（分页）
- GET /api/admin/task/assignment/list
- Query：userId, status, taskId, pageIndex, pageSize
- Response（分页）

### 4.2 客户端接口（/api/app/task）

1) 获取可领取任务列表（分页）
- GET /api/app/task/list
- Query：type, status, pageIndex, pageSize
- Response（分页）

2) 获取我的任务列表（分页）
- GET /api/app/task/my
- Query：status, pageIndex, pageSize
- Response（分页）

3) 领取任务
- POST /api/app/task/claim
- Body：{ taskId }
- Response：TaskAssignmentDto

4) 上报任务进度
- POST /api/app/task/progress
- Body：{ taskId, delta, context? }
- Response：TaskAssignmentDto

5) 完成任务
- POST /api/app/task/complete
- Body：{ taskId }
- Response：TaskAssignmentDto

### 4.3 响应结构示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [],
    "total": 0,
    "pageIndex": 0,
    "pageSize": 15
  }
}
```

## 5. 核心业务逻辑实现方案

### 5.1 任务配置与发布
- 管理端创建任务，校验 code 唯一
- 发布窗口 publishStartAt/publishEndAt 控制前端可见性
- 任务状态与启用状态双重控制（status + isEnabled）

### 5.2 任务领取
- 手动领取：用户主动 claim
- 自动领取：在任务列表查询时按策略创建 assignment
- 幂等策略：taskId + userId + cycleKey 唯一约束
- 领取时写入 taskSnapshot，防止任务配置变更影响历史记录

### 5.3 进度推进
- 统一 progress 接口上报 delta
- 使用 task_progress_log 记录变化与上下文
- 进度封顶到 target，保证幂等/重复上报可安全处理

### 5.4 任务完成与奖励
- 当 progress >= target，切换状态为已完成
- 完成后触发用户成长事件：
  - eventKey：task.complete
  - business：task
  - context：{ taskId, assignmentId, rewardConfig }
- 奖励发放走现有成长事件审计与发放流程

### 5.5 过期与回收
- 定时任务扫描过期任务：
  - publishEndAt 早于当前时间
  - assignment.expiredAt 早于当前时间
- 统一标记为已过期，避免继续领取与完成

### 5.6 权限与安全
- 管理端接口：JWT 守卫 + 审计拦截
- 客户端接口：JWT 守卫 + CurrentUser 取 userId
- DTO 校验全量采用 ValidateX 装饰器与 PageDto 规范

## 6. 关键实现约束
- 复用 BaseService 与 Prisma 扩展（findPagination / softDelete）
- 只在 libs 新增领域逻辑，apps 侧只做 Controller 封装
- 任务与成长体系对接使用现有 UserGrowthEvent 服务
