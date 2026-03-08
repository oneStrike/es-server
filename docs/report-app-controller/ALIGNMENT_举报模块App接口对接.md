# 举报模块 App 接口对接 - 对齐文档

## 一、现有项目分析

### 1.1 举报模块（libs/interaction/src/report）结构

#### ReportService 核心方法

| 方法 | 功能 | 适用场景 |
|------|------|----------|
| `createWorkReport(dto)` | 创建作品/章节举报 | 作品模块已使用 |
| `createForumReport(dto)` | 创建社区举报（主题/回复/用户） | **待对接** |
| `createReport(dto)` | 通用举报创建方法 | 底层方法 |
| `getReportById(id)` | 根据ID查询举报 | 管理/详情查询 |
| `queryReportPage(options)` | 分页查询举报列表 | 管理后台 |
| `updateReport(id, data)` | 更新举报状态 | 管理后台 |
| `deleteReport(id)` | 删除举报 | 管理后台 |

#### 已支持的举报目标类型（ReportTargetTypeEnum）

```typescript
enum ReportTargetTypeEnum {
  COMMENT = 1,        // 评论 - ✅ 已在 comment.controller 中对接
  FORUM_TOPIC = 2,    // 论坛主题 - ❌ 待对接
  FORUM_REPLY = 3,    // 论坛回复 - ❌ 待对接
  USER = 4,           // 用户 - ❌ 待对接
  WORK = 5,           // 作品 - ✅ 已在 work.controller 中对接
  WORK_CHAPTER = 6,   // 作品章节 - ✅ 已在 work.controller 中对接
}
```

### 1.2 现有 App 端对接情况

| 模块 | Controller | 举报接口 | 状态 |
|------|------------|----------|------|
| 作品模块 | `WorkController` | `POST /app/work/report` | ✅ 已实现 |
| 评论模块 | `CommentController` | `POST /app/comment/report` | ✅ 已实现 |
| 用户模块 | `UserController` | - | ❌ 缺失用户举报 |
| 论坛模块 | - | - | ❌ 缺失论坛举报 |

### 1.3 现有代码模式分析

**WorkController 举报实现模式：**
```typescript
// work.controller.ts
@Post('report')
@ApiDoc({ summary: '举报作品' })
async reportWork(
  @Body() body: CreateWorkReportBodyDto,
  @CurrentUser('sub') userId: number,
) {
  return this.reportService.createWorkReport({
    ...body,
    reporterId: userId,
  })
}
```

**CommentController 举报实现模式：**
```typescript
// comment.controller.ts
@Post('report')
@ApiDoc({ summary: '举报评论' })
async reportComment(
  @Body() body: ReportCommentBodyDto,
  @CurrentUser('sub') userId: number,
) {
  return this.commentInteractionService.reportComment({
    ...body,
    reporterId: userId,
  })
}
```

## 二、需求理解

### 2.1 原始需求
> 需要为 app-api 对接举报模块的 controller，提供用户端举报功能接口

### 2.2 需求边界确认

**包含范围：**
- [ ] 用户举报接口（举报其他用户）
- [ ] 论坛主题举报接口
- [ ] 论坛回复举报接口
- [ ] 相关 DTO 定义
- [ ] Controller 和 Module 配置

**不包含范围：**
- 管理后台举报审核接口（已在 admin-api 中实现）
- 举报奖励积分逻辑（已在 ReportService 中实现）
- 举报通知逻辑（已内置）

## 三、方案设计

### 3.1 接口规划

#### 方案 A：独立 ReportController（推荐）

创建独立的 `ReportController`，统一处理所有举报场景：

```
POST /app/report/user       - 举报用户
POST /app/report/topic      - 举报论坛主题
POST /app/report/reply      - 举报论坛回复
```

**优点：**
- 举报功能集中管理，职责清晰
- 便于统一扩展和维护
- 符合单一职责原则

**缺点：**
- 需要新建 Controller 和 Module

#### 方案 B：分散到各业务 Controller

在现有 Controller 中添加举报接口：

```
POST /app/user/report       - 在 UserController 中添加
POST /app/forum/topic/report   - 需新建 ForumController
POST /app/forum/reply/report   - 需新建 ForumController
```

**优点：**
- 接口路由与业务模块对应

**缺点：**
- 分散管理，不利于统一维护
- 需要在多个模块中注入 ReportService

### 3.2 DTO 设计

需要新增以下 DTO：

```typescript
// 举报用户
class CreateUserReportBodyDto {
  targetId: number       // 被举报用户ID
  reason: ReportReasonEnum
  description?: string
  evidenceUrl?: string
}

// 举报论坛主题
class CreateForumTopicReportBodyDto {
  targetId: number       // 主题ID
  reason: ReportReasonEnum
  description?: string
  evidenceUrl?: string
}

// 举报论坛回复
class CreateForumReplyReportBodyDto {
  targetId: number       // 回复ID
  reason: ReportReasonEnum
  description?: string
  evidenceUrl?: string
}
```

### 3.3 模块依赖

```
ReportController
    └── ReportService (from @libs/interaction)
            └── GrowthLedgerService (积分奖励)
```

## 四、待确认问题

### 4.1 接口路由设计
- **问题**：是采用独立 `/app/report/*` 路由，还是分散到各业务模块？
- **倾向**：推荐独立 ReportController，统一管理举报功能

### 4.2 论坛模块现状
- **问题**：app-api 中是否已有论坛相关 Controller？如果没有，是否需要一并创建？
- **说明**：目前仅看到 work、comment、user 等模块

### 4.3 DTO 放置位置
- **问题**：新增的 DTO 是放在 `libs/interaction/src/report/dto/` 还是 `apps/app-api/src/modules/report/dto/`？
- **倾向**：推荐放在 `libs/interaction/src/report/dto/`，保持与现有 `CreateWorkReportBodyDto` 一致

### 4.4 是否需要查询举报记录接口
- **问题**：用户端是否需要查询自己的举报历史？
- **说明**：目前 ReportService 有 `queryReportPage` 方法可用于此功能

## 五、建议方案

基于现有代码模式，推荐 **方案 A**：

1. 创建 `apps/app-api/src/modules/report/report.controller.ts`
2. 创建 `apps/app-api/src/modules/report/report.module.ts`
3. 在 `libs/interaction/src/report/dto/report-app.dto.ts` 中添加 DTO
4. 导出新增 DTO 并在 interaction 模块中注册

### 预期文件结构

```
apps/app-api/src/modules/report/
├── report.controller.ts    # 新建
└── report.module.ts        # 新建

libs/interaction/src/report/dto/
└── report-app.dto.ts       # 扩展，添加论坛举报 DTO
```

### 预期接口

| 接口 | 方法 | 描述 |
|------|------|------|
| `/app/report/user` | POST | 举报用户 |
| `/app/report/topic` | POST | 举报论坛主题 |
| `/app/report/reply` | POST | 举报论坛回复 |

---

**请确认以上方案是否符合预期，或提出调整意见。**
