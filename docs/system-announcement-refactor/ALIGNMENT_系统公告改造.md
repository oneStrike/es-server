# 系统公告改造 - 需求对齐文档

## 一、原始需求

用户希望将当前的 `AppNotice`（应用通知表）修改为"系统公告"，需要一份详细的规范方案，包括业务修改内容。

## 二、现有系统分析

### 2.1 当前数据模型

#### AppNotice 表结构
| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | Int | 主键ID |
| pageId | Int? | 关联的页面ID（可选） |
| title | String(100) | 通知标题 |
| content | String | 通知内容 |
| noticeType | SmallInt | 通知类型（0=系统通知, 1=活动通知, 2=维护公告） |
| priorityLevel | SmallInt | 优先级（数值越大越重要） |
| publishStartTime | Timestamptz? | 发布开始时间 |
| publishEndTime | Timestamptz? | 发布结束时间 |
| popupBackgroundImage | String(200)? | 弹窗背景图片URL |
| isPublished | Boolean | 是否已发布 |
| isPinned | Boolean | 是否置顶 |
| showAsPopup | Boolean | 是否以弹窗形式显示 |
| enablePlatform | Int[] | 启用的平台列表 |
| createdAt | Timestamptz | 创建时间 |
| updatedAt | Timestamptz | 更新时间 |

#### AppNoticeRead 表结构（关联表）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | Int | 主键ID |
| noticeId | Int | 关联的通知ID |
| userId | Int | 关联的用户ID |
| readAt | Timestamptz | 阅读时间 |

### 2.2 关联关系

```
AppNotice 1---N AppNoticeRead
AppNotice N---1 AppPage
AppUser 1---N AppNoticeRead
```

### 2.3 现有业务逻辑

1. **后台管理接口** (`admin-api`)
   - 创建通知消息
   - 分页查询通知列表
   - 通知详情
   - 更新通知消息
   - 更新通知状态
   - 删除通知

2. **客户端接口** (`app-api`)
   - 系统公告列表查询
   - 作为系统模块的一部分

3. **业务特性**
   - 支持按发布时间范围控制可见性
   - 支持多平台发布（Android/iOS/Web等）
   - 支持置顶显示
   - 支持弹窗展示
   - 支持阅读记录追踪

## 三、需求理解

### 3.1 "通知" vs "公告" 的语义差异

| 维度 | 通知 (Notice) | 公告 (Announcement) |
|------|---------------|---------------------|
| 定位 | 强调信息传递 | 强调官方声明 |
| 时效性 | 可能短期有效 | 通常长期有效 |
| 重要性 | 可高可低 | 通常较高 |
| 展示方式 | 可能弹窗提醒 | 通常列表展示 |
| 用户感知 | 需要确认阅读 | 公开可见即可 |
| 典型场景 | 系统消息、活动提醒 | 平台公告、政策声明 |

## 四、确认事项（已确认）

### 4.1 命名改造范围 ✅ 已确认

**采用全面重命名方案：**
- 数据库表名：`app_notice` → `app_announcement`
- 模型名称：`AppNotice` → `AppAnnouncement`
- 阅读记录表：`app_notice_read` → `app_announcement_read`
- 所有相关代码和接口路径

### 4.2 接口路径改造 ✅ 已确认

- `/admin/notice` → `/admin/announcement`
- `/app/system/notice` → `/app/system/announcement`

### 4.3 业务功能调整 ✅ 已确认

**通知类型调整：**
- 0 = 平台公告（原"系统通知"，平台重要声明）
- 1 = 活动公告（原"活动通知"，运营活动信息）
- 2 = 维护公告（保持不变，系统维护通知）
- 3 = 更新公告（保持不变，版本更新信息）
- 4 = 政策公告（新增，规则政策变更）

**优先级保持不变：**
- 0 = 低
- 1 = 中
- 2 = 高
- 3 = 紧急

### 4.4 字段调整 ✅ 已确认

**新增字段：**
- `viewCount` (Int) - 浏览次数，默认为0
- `summary` (String?) - 公告摘要，最大长度500字符

**不移除现有字段** - 保持所有现有字段不变

### 4.5 阅读记录处理 ✅ 已确认

保留阅读记录功能，继续追踪用户阅读状态，同步重命名相关表和字段。

### 4.6 数据迁移 ✅ 已确认

清空现有数据，调整种子文件生成新的初始公告数据。

---

## 五、技术实现范围

### 5.1 Prisma 模型文件（2个）
- `prisma/models/app/app-notice.prisma` → `app-announcement.prisma`
- `prisma/models/app/app-notice-read.prisma` → `app-announcement-read.prisma`

### 5.2 迁移文件（新建）
- 创建新的数据库迁移脚本

### 5.3 Library 模块重命名
- `libs/app-config/src/notice/` → `libs/app-config/src/announcement/`
  - `notice.service.ts` → `announcement.service.ts`
  - `notice.module.ts` → `announcement.module.ts`
  - `notice.constant.ts` → `announcement.constant.ts`
  - `dto/notice.dto.ts` → `dto/announcement.dto.ts`
  - `index.ts`

### 5.4 Admin API 模块
- `apps/admin-api/src/modules/app-config/notice/` → `apps/admin-api/src/modules/app-config/announcement/`
  - `notice.controller.ts` → `announcement.controller.ts`
  - `notice.module.ts` → `announcement.module.ts`

### 5.5 App API 模块
- `apps/app-api/src/modules/system/system.controller.ts` - 修改接口路径和引用
- `apps/app-api/src/modules/system/system.module.ts` - 修改模块引用

### 5.6 种子数据文件
- `prisma/seed/modules/app/notice.ts` → `prisma/seed/modules/app/announcement.ts`
- 更新初始公告数据

### 5.7 其他相关文件
- `prisma/prismaClient/` 目录下的生成文件（自动更新）
- 所有引用 AppNotice 的模块文件

---

## 六、下一步

根据以上确认事项，将生成详细的共识文档（CONSENSUS）和实施计划。
