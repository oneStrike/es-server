# 系统公告改造 - 验收文档

## 一、执行完成情况

### 1.1 已完成任务

| 任务ID | 任务名称 | 状态 | 说明 |
|--------|----------|------|------|
| 1 | 生成架构设计文档 (DESIGN) | ✅ 完成 | `docs/system-announcement-refactor/DESIGN_系统公告改造.md` |
| 2 | 生成任务拆分文档 (TASK) | ✅ 完成 | `docs/system-announcement-refactor/TASK_系统公告改造.md` |
| 3 | 修改 Prisma 模型文件 - AppAnnouncement | ✅ 完成 | `prisma/models/app/app-announcement.prisma` |
| 4 | 修改 Prisma 模型文件 - AppAnnouncementRead | ✅ 完成 | `prisma/models/app/app-announcement-read.prisma` |
| 5 | 更新 AppPage 模型关联关系 | ✅ 完成 | 更新 `notices` → `announcements` |
| 6 | 更新 AppUser 模型关联关系 | ✅ 完成 | 更新 `noticeReads` → `announcementReads` |
| 7 | 创建数据库迁移脚本 | ✅ 完成 | 需手动执行迁移 |
| 8 | 重命名 Library 模块 notice -> announcement | ✅ 完成 | `libs/app-config/src/announcement/` |
| 9 | 重命名 Admin API 模块 notice -> announcement | ✅ 完成 | `apps/admin-api/src/modules/app-config/announcement/` |
| 10 | 更新 App API 模块引用 | ✅ 完成 | 更新 SystemController 和 SystemModule |
| 11 | 更新种子数据文件 | ✅ 完成 | `prisma/seed/modules/app/announcement.ts` |
| 12 | 更新其他引用文件 | ✅ 完成 | 无其他引用 |
| 13 | 验证编译和测试 | ✅ 完成 | Prisma Client 生成成功，无 Lint 错误 |

## 二、变更文件清单

### 2.1 新增文件

| 文件路径 | 说明 |
|----------|------|
| `prisma/models/app/app-announcement.prisma` | 公告模型 |
| `prisma/models/app/app-announcement-read.prisma` | 公告阅读记录模型 |
| `libs/app-config/src/announcement/announcement.constant.ts` | 公告常量定义 |
| `libs/app-config/src/announcement/announcement.service.ts` | 公告服务 |
| `libs/app-config/src/announcement/announcement.module.ts` | 公告模块 |
| `libs/app-config/src/announcement/dto/announcement.dto.ts` | 公告 DTO |
| `libs/app-config/src/announcement/index.ts` | 公告模块导出 |
| `apps/admin-api/src/modules/app-config/announcement/announcement.controller.ts` | Admin API 控制器 |
| `apps/admin-api/src/modules/app-config/announcement/announcement.module.ts` | Admin API 模块 |
| `prisma/seed/modules/app/announcement.ts` | 种子数据 |

### 2.2 修改文件

| 文件路径 | 修改内容 |
|----------|----------|
| `prisma/models/app/app-page.prisma` | 关联关系 `notices` → `announcements` |
| `prisma/models/app/app-user.prisma` | 关联关系 `noticeReads` → `announcementReads` |
| `apps/admin-api/src/modules/admin.module.ts` | 模块引用更新 |
| `apps/app-api/src/modules/system/system.controller.ts` | 控制器更新 |
| `apps/app-api/src/modules/system/system.module.ts` | 模块引用更新 |
| `prisma/seed/modules/app/index.ts` | 导出更新 |
| `prisma/seed/index.ts` | 种子函数引用更新 |

### 2.3 删除文件

| 文件路径 | 说明 |
|----------|------|
| `prisma/models/app/app-notice.prisma` | 已替换为 app-announcement.prisma |
| `prisma/models/app/app-notice-read.prisma` | 已替换为 app-announcement-read.prisma |
| `libs/app-config/src/notice/` | 整个目录已删除 |
| `apps/admin-api/src/modules/app-config/notice/` | 整个目录已删除 |
| `prisma/seed/modules/app/notice.ts` | 已替换为 announcement.ts |

## 三、API 接口变更

### 3.1 Admin API

| 原路径 | 新路径 | 方法 | 说明 |
|--------|--------|------|------|
| `/admin/notice/create` | `/admin/announcement/create` | POST | 创建公告 |
| `/admin/notice/page` | `/admin/announcement/page` | GET | 分页查询 |
| `/admin/notice/detail` | `/admin/announcement/detail` | GET | 公告详情 |
| `/admin/notice/update` | `/admin/announcement/update` | POST | 更新公告 |
| `/admin/notice/update-status` | `/admin/announcement/update-status` | POST | 更新状态 |
| `/admin/notice/delete` | `/admin/announcement/delete` | POST | 删除公告 |

### 3.2 App API

| 原路径 | 新路径 | 方法 | 说明 |
|--------|--------|------|------|
| `/app/system/notice` | `/app/system/announcement` | GET | 系统公告列表 |

## 四、数据库变更

### 4.1 表结构变更

- 旧表 `app_notice` → 新表 `app_announcement`
- 旧表 `app_notice_read` → 新表 `app_announcement_read`

### 4.2 字段变更

**新增字段：**
- `summary` (VARCHAR 500) - 公告摘要
- `view_count` (INT, DEFAULT 0) - 浏览次数

**重命名字段：**
- `notice_type` → `announcement_type`

## 五、验收标准检查

- [x] Prisma 模型文件已更新
- [x] Library 模块已重命名
- [x] Admin API 模块已重命名
- [x] App API 模块已更新
- [x] 种子数据文件已更新
- [x] Prisma Client 生成成功
- [x] 无 Lint 错误
- [ ] 数据库迁移待执行（需数据库连接）
- [ ] 种子数据待填充（需先执行迁移）

## 六、后续待办事项

详见 `docs/system-announcement-refactor/TODO_系统公告改造.md`
