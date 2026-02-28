# 系统公告改造 - 共识文档

## 一、需求描述

将现有的 `AppNotice`（应用通知）模块全面改造为 `AppAnnouncement`（系统公告）模块，包括数据库模型、业务代码、API接口的全面重命名和功能优化。

## 二、改造范围

### 2.1 数据库模型改造

#### AppAnnouncement 表（原 app_notice）

| 字段名 | 类型 | 是否新增 | 说明 |
|--------|------|----------|------|
| id | Int | 否 | 主键ID |
| pageId | Int? | 否 | 关联的页面ID（可选） |
| title | String(100) | 否 | 公告标题 |
| content | String | 否 | 公告内容 |
| summary | String(500)? | **是** | 公告摘要 |
| announcementType | SmallInt | 否 | 公告类型（原noticeType） |
| priorityLevel | SmallInt | 否 | 优先级 |
| publishStartTime | Timestamptz? | 否 | 发布开始时间 |
| publishEndTime | Timestamptz? | 否 | 发布结束时间 |
| popupBackgroundImage | String(200)? | 否 | 弹窗背景图片URL |
| isPublished | Boolean | 否 | 是否已发布 |
| isPinned | Boolean | 否 | 是否置顶 |
| showAsPopup | Boolean | 否 | 是否以弹窗形式显示 |
| enablePlatform | Int[] | 否 | 启用的平台列表 |
| viewCount | Int | **是** | 浏览次数，默认0 |
| createdAt | Timestamptz | 否 | 创建时间 |
| updatedAt | Timestamptz | 否 | 更新时间 |

**表名变更：** `app_notice` → `app_announcement`

#### AppAnnouncementRead 表（原 app_notice_read）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | Int | 主键ID |
| announcementId | Int | 关联的公告ID |
| userId | Int | 关联的用户ID |
| readAt | Timestamptz | 阅读时间 |

**表名变更：** `app_notice_read` → `app_announcement_read`

### 2.2 公告类型枚举

| 值 | 原名称 | 新名称 | 说明 |
|----|--------|--------|------|
| 0 | 系统通知 | PLATFORM | 平台公告 - 平台重要声明 |
| 1 | 活动通知 | ACTIVITY | 活动公告 - 运营活动信息 |
| 2 | 维护公告 | MAINTENANCE | 维护公告 - 系统维护通知 |
| 3 | 更新公告 | UPDATE | 更新公告 - 版本更新信息 |
| 4 | (新增) | POLICY | 政策公告 - 规则政策变更 |

### 2.3 优先级枚举（保持不变）

| 值 | 名称 | 说明 |
|----|------|------|
| 0 | LOW | 低优先级 |
| 1 | MEDIUM | 中等优先级 |
| 2 | HIGH | 高优先级 |
| 3 | URGENT | 紧急 |

### 2.4 API 接口变更

#### Admin API（后台管理）

| 原路径 | 新路径 | 方法 | 说明 |
|--------|--------|------|------|
| `/admin/notice/create` | `/admin/announcement/create` | POST | 创建公告 |
| `/admin/notice/page` | `/admin/announcement/page` | GET | 分页查询公告列表 |
| `/admin/notice/detail` | `/admin/announcement/detail` | GET | 公告详情 |
| `/admin/notice/update` | `/admin/announcement/update` | POST | 更新公告 |
| `/admin/notice/update-status` | `/admin/announcement/update-status` | POST | 更新公告状态 |
| `/admin/notice/delete` | `/admin/announcement/delete` | POST | 删除公告 |

#### App API（客户端）

| 原路径 | 新路径 | 方法 | 说明 |
|--------|--------|------|------|
| `/app/system/notice` | `/app/system/announcement` | GET | 系统公告列表 |

### 2.5 代码模块重命名

| 原路径 | 新路径 |
|--------|--------|
| `libs/app-config/src/notice/` | `libs/app-config/src/announcement/` |
| `apps/admin-api/src/modules/app-config/notice/` | `apps/admin-api/src/modules/app-config/announcement/` |
| `prisma/models/app/app-notice.prisma` | `prisma/models/app/app-announcement.prisma` |
| `prisma/models/app/app-notice-read.prisma` | `prisma/models/app/app-announcement-read.prisma` |
| `prisma/seed/modules/app/notice.ts` | `prisma/seed/modules/app/announcement.ts` |

## 三、技术实现方案

### 3.1 数据库迁移策略

由于选择**清空现有数据**，迁移策略如下：

1. 删除旧表 `app_notice_read`（外键依赖）
2. 删除旧表 `app_notice`
3. 创建新表 `app_announcement`（包含新字段）
4. 创建新表 `app_announcement_read`
5. 执行种子数据填充

### 3.2 代码改造策略

1. **Prisma 模型层**
   - 重命名模型文件
   - 修改模型定义和字段名
   - 更新关联关系

2. **Library 服务层**
   - 重命名模块目录和文件
   - 更新 Service、Module、DTO、常量定义
   - 更新导出索引

3. **API 控制层**
   - 重命名 Controller 和 Module
   - 更新路由路径
   - 更新 Swagger 文档描述

4. **种子数据**
   - 重命名种子文件
   - 更新初始公告数据内容

## 四、任务边界

### 4.1 包含内容

- ✅ Prisma 模型文件重命名和修改
- ✅ 数据库迁移脚本创建
- ✅ Library 模块全面重命名
- ✅ Admin API 模块重命名和接口路径修改
- ✅ App API 接口路径修改
- ✅ DTO 和常量定义更新
- ✅ 种子数据文件重命名和内容更新
- ✅ 相关引用的模块文件更新

### 4.2 不包含内容

- ❌ 前端代码修改（需前端配合）
- ❌ API 文档站点的手动更新（自动生成）
- ❌ 历史数据迁移（已确认清空）

## 五、验收标准

### 5.1 功能验收

- [ ] 后台管理可以正常创建、查询、更新、删除公告
- [ ] 客户端可以正常获取公告列表
- [ ] 公告类型枚举正确显示新名称
- [ ] 新增字段（summary、viewCount）正常工作
- [ ] 阅读记录功能正常

### 5.2 技术验收

- [ ] Prisma 迁移成功执行
- [ ] 项目编译无错误
- [ ] 所有 API 接口路径正确
- [ ] Swagger 文档正确展示
- [ ] 种子数据正确填充

### 5.3 数据验收

- [ ] 旧数据已清空
- [ ] 新种子数据正确创建
- [ ] 表结构符合设计

## 六、风险与依赖

### 6.1 风险点

1. **API 路径变更** - 需要前端同步修改接口调用
2. **数据库清空** - 现有公告数据将丢失

### 6.2 外部依赖

1. 前端需要同步更新 API 路径
2. 需要确认维护窗口执行数据库迁移

## 七、执行计划

将根据上述共识生成详细的任务拆分文档（TASK），按原子任务逐步执行。
