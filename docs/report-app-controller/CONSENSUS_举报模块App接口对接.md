# 举报模块 App 接口对接 - 共识文档

## 一、需求确认

### 1.1 需求描述
将所有举报相关接口集中到一个独立的 `ReportController` 中，删除其他 Controller 中零散的举报接口。

### 1.2 验收标准
- [ ] 创建独立的 `ReportController` 统一管理所有举报接口
- [ ] 迁移作品举报接口（从 WorkController）
- [ ] 迁移评论举报接口（从 CommentController）
- [ ] 新增用户举报接口
- [ ] 新增论坛主题举报接口
- [ ] 新增论坛回复举报接口
- [ ] 删除原 Controller 中的举报接口
- [ ] 更新相关 Module 依赖

## 二、技术实现方案

### 2.1 接口路由规划

| 新接口 | 方法 | 功能 | 来源 |
|--------|------|------|------|
| `POST /app/report/work` | POST | 举报作品 | 从 WorkController 迁移 |
| `POST /app/report/chapter` | POST | 举报章节 | 从 WorkController 迁移 |
| `POST /app/report/comment` | POST | 举报评论 | 从 CommentController 迁移 |
| `POST /app/report/user` | POST | 举报用户 | 新增 |
| `POST /app/report/topic` | POST | 举报论坛主题 | 新增 |
| `POST /app/report/reply` | POST | 举报论坛回复 | 新增 |

### 2.2 DTO 设计

在 `libs/interaction/src/report/dto/report-app.dto.ts` 中扩展：

```typescript
// 通用举报请求体基类
class BaseReportBodyDto {
  targetId: number              // 举报目标ID
  reason: ReportReasonEnum      // 举报原因
  description?: string          // 举报描述
  evidenceUrl?: string          // 证据链接
}

// 作品/章节举报（保留原有，调整命名）
class CreateWorkReportBodyDto extends BaseReportBodyDto {
  targetType?: ReportTargetTypeEnum  // WORK 或 WORK_CHAPTER
}

// 评论举报
class CreateCommentReportBodyDto extends BaseReportBodyDto {}

// 用户举报
class CreateUserReportBodyDto extends BaseReportBodyDto {}

// 论坛主题举报
class CreateForumTopicReportBodyDto extends BaseReportBodyDto {}

// 论坛回复举报
class CreateForumReplyReportBodyDto extends BaseReportBodyDto {}
```

### 2.3 模块依赖调整

**新增文件：**
```
apps/app-api/src/modules/report/
├── report.controller.ts    # 新建 - 统一举报控制器
└── report.module.ts        # 新建 - 举报模块
```

**修改文件：**
```
apps/app-api/src/modules/work/work.controller.ts       # 删除举报接口
apps/app-api/src/modules/work/work.module.ts           # 移除 ReportService 依赖
apps/app-api/src/modules/comment/comment.controller.ts # 删除举报接口
apps/app-api/src/modules/comment/comment.module.ts     # 移除举报相关依赖
apps/app-api/src/modules/app.module.ts                 # 添加 ReportModule
libs/interaction/src/report/dto/report-app.dto.ts      # 扩展 DTO
libs/interaction/src/index.ts                          # 导出新 DTO
```

### 2.4 Controller 实现设计

```typescript
@ApiTags('举报模块')
@Controller('app/report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  // 作品场景
  @Post('work')
  async reportWork(...) { ... }

  @Post('chapter')
  async reportChapter(...) { ... }

  // 评论场景
  @Post('comment')
  async reportComment(...) { ... }

  // 用户场景
  @Post('user')
  async reportUser(...) { ... }

  // 论坛场景
  @Post('topic')
  async reportTopic(...) { ... }

  @Post('reply')
  async reportReply(...) { ... }
}
```

## 三、任务边界

### 3.1 包含范围
- 创建 ReportController 和 ReportModule
- 迁移作品/章节举报接口
- 迁移评论举报接口
- 新增用户/论坛举报接口
- 删除原 Controller 中的举报接口
- 更新模块依赖

### 3.2 不包含范围
- 管理后台举报审核功能
- 举报奖励积分逻辑（已有）
- 数据库结构变更（无需变更）

## 四、技术约束

1. 遵循现有代码规范和装饰器使用模式
2. DTO 放置在 `libs/interaction` 中保持一致性
3. 使用 `@CurrentUser('sub')` 获取当前用户ID
4. 使用 `@ApiDoc` 装饰器添加接口文档
5. 保持与现有举报功能的行为一致（奖励积分、防重复等）

## 五、验收标准

### 5.1 功能验收
- [ ] 所有举报接口可正常调用
- [ ] 迁移后的接口行为与原接口一致
- [ ] 举报奖励积分正常发放
- [ ] 防重复举报正常工作

### 5.2 代码质量
- [ ] 编译无错误
- [ ] 遵循现有代码风格
- [ ] 接口文档完整

### 5.3 兼容性
- [ ] 原 Controller 其他功能不受影响
- [ ] 模块依赖正确配置
