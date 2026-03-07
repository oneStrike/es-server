# 用户模块对齐文档

## 1. 原始需求

建立一个 user 模块，供 admin 管理 app 用户，供 app 管理当前用户。

## 2. 项目上下文分析

### 2.1 现有项目结构

```
es-server/
├── apps/
│   ├── admin-api/           # 管理端 API
│   │   └── src/modules/
│   │       ├── user/        # 管理员用户模块 (AdminUser)
│   │       └── user-growth/ # 用户成长管理
│   └── app-api/             # 应用端 API
│       └── src/modules/
│           ├── user/        # 当前用户信息模块 (AppUser)
│           └── auth/        # 认证模块
├── libs/
│   └── user/                # 用户相关共享库
│       └── src/
│           ├── badge/       # 徽章服务
│           ├── experience/  # 经验服务
│           ├── growth-event/# 成长事件
│           ├── level-rule/  # 等级规则
│           ├── permission/  # 权限服务
│           └── point/       # 积分服务
└── prisma/models/app/
    └── app-user.prisma      # AppUser 数据模型
```

### 2.2 现有用户模型

#### AppUser 模型 (prisma/models/app/app-user.prisma)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int | 用户ID |
| account | String | 账号（唯一） |
| phone | String? | 手机号 |
| email | String? | 邮箱 |
| levelId | Int? | 等级ID |
| nickname | String | 昵称 |
| password | String | 密码 |
| avatar | String? | 头像 |
| isEnabled | Boolean | 是否启用 |
| gender | Int | 性别 |
| birthDate | DateTime? | 出生日期 |
| points | Int | 积分 |
| experience | Int | 经验值 |
| status | Int | 用户状态 |
| banReason | String? | 封禁原因 |
| banUntil | DateTime? | 封禁到期时间 |
| lastLoginAt | DateTime? | 最后登录时间 |
| lastLoginIp | String? | 最后登录IP |
| deletedAt | DateTime? | 软删除时间 |

### 2.3 现有代码模式

1. **libs 层**：提供共享服务，如 `UserPointService`, `UserBadgeService` 等
2. **apps 层**：提供 API 接口，调用 libs 层服务
3. **控制器路由**：
   - admin-api: `/admin/xxx`
   - app-api: `/app/xxx`

### 2.4 现有用户相关模块

| 模块位置 | 功能 | 数据模型 |
|----------|------|----------|
| `apps/admin-api/src/modules/user` | 管理员用户 CRUD | AdminUser |
| `apps/app-api/src/modules/user` | 当前用户信息查询 | AppUser |
| `apps/app-api/src/modules/auth` | 用户认证（注册/登录） | AppUser |

## 3. 需求理解

### 3.1 核心需求

需要建立一个统一的 `libs/user` 模块核心服务，支持：

1. **Admin 管理端**：
   - 查看 App 用户列表（分页、筛选）
   - 查看用户详情
   - 更新用户信息（昵称、头像、状态等）
   - 封禁/解封用户
   - 重置用户密码
   - 解锁用户登录锁定

2. **App 应用端**：
   - 获取当前用户信息
   - 更新当前用户信息（昵称、头像、性别、生日等）
   - 修改密码
   - 获取用户成长概览（积分、经验、等级、徽章）

### 3.2 边界确认

| 范围 | 是否包含 | 说明 |
|------|----------|------|
| 用户 CRUD | ✅ | 包含 |
| 用户认证（登录/注册） | ❌ | 已有 auth 模块处理 |
| 积分/经验/徽章管理 | ❌ | 已有 libs/user/point 等模块 |
| 用户权限管理 | ❌ | 已有 libs/user/permission 模块 |
| 管理员用户管理 | ❌ | 已有 admin-api/user 模块 |

## 4. 疑问澄清

### 4.1 架构设计疑问

**Q1: 应该在 libs/user 下创建核心用户服务，还是在各 API 层单独实现？**

**决策**：基于项目现有模式，建议在 `libs/user` 下创建核心用户服务：
- `libs/user/src/core/` - 核心 AppUser 管理服务
- admin-api 和 app-api 各自创建控制器调用共享服务

**理由**：
1. 复用项目现有模式（如 libs/user/point）
2. 避免代码重复
3. 便于维护和测试

### 4.2 功能范围疑问

**Q2: Admin 端需要哪些用户管理功能？**

**决策**：参考现有 AdminUser 管理模块，AppUser 管理应包含：
- ✅ 用户列表查询（分页、筛选）
- ✅ 用户详情查询
- ✅ 更新用户信息
- ✅ 启用/禁用用户
- ✅ 封禁/解封用户
- ✅ 重置密码
- ✅ 解锁登录锁定

**Q3: App 端需要哪些用户功能？**

**决策**：基于现有 app-api/user 模块扩展：
- ✅ 获取当前用户信息
- ✅ 更新当前用户资料
- ✅ 修改密码
- ✅ 获取成长概览（已有）

### 4.3 接口路由疑问

**Q4: 路由命名规范？**

**决策**：遵循现有规范：
- Admin 端：`/admin/app-user/*` （管理 App 用户）
- App 端：`/app/user/*` （当前用户操作）

## 5. 技术方案概要

### 5.1 模块结构

```
libs/user/src/
├── core/                      # 新增：核心用户服务
│   ├── index.ts
│   ├── user-core.module.ts
│   ├── user-core.service.ts   # 核心 AppUser 服务
│   ├── user-core.dto.ts       # DTO 定义
│   └── user-core.constant.ts  # 常量定义
├── point/                     # 已有：积分服务
├── experience/                # 已有：经验服务
├── badge/                     # 已有：徽章服务
├── level-rule/                # 已有：等级规则
├── growth-event/              # 已有：成长事件
├── permission/                # 已有：权限服务
└── index.ts

apps/admin-api/src/modules/
├── app-user/                  # 新增：App 用户管理模块
│   ├── dto/
│   │   └── app-user.dto.ts
│   ├── app-user.controller.ts
│   ├── app-user.service.ts
│   └── app-user.module.ts
└── user/                      # 已有：管理员用户模块

apps/app-api/src/modules/
└── user/                      # 扩展：当前用户模块
    ├── dto/
    ├── user.controller.ts     # 扩展接口
    ├── user.service.ts        # 扩展服务
    └── user.module.ts
```

### 5.2 核心服务设计

#### UserCoreService (libs/user/src/core)

```typescript
@Injectable()
export class UserCoreService extends BaseService {
  // 基础 CRUD
  async findById(id: number)
  async findByPhone(phone: string)
  async findByAccount(account: string)
  async findPage(query: UserPageDto)

  // 用户管理
  async updateUserInfo(id: number, data: UpdateUserDto)
  async updateStatus(id: number, status: number, banReason?: string, banUntil?: Date)
  async enableUser(id: number, isEnabled: boolean)

  // 密码管理
  async changePassword(id: number, oldPassword: string, newPassword: string)
  async resetPassword(id: number, newPassword: string)

  // 锁定管理
  async unlockUser(id: number)
}
```

### 5.3 API 接口设计

#### Admin API (`/admin/app-user`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/page` | 用户分页列表 |
| GET | `/info` | 用户详情 |
| POST | `/update` | 更新用户信息 |
| POST | `/enable` | 启用用户 |
| POST | `/disable` | 禁用用户 |
| POST | `/ban` | 封禁用户 |
| POST | `/unban` | 解封用户 |
| POST | `/reset-password` | 重置密码 |
| POST | `/unlock` | 解锁登录锁定 |

#### App API (`/app/user`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/profile` | 获取当前用户信息（已有） |
| POST | `/update-profile` | 更新当前用户资料 |
| POST | `/change-password` | 修改密码 |
| GET | `/growth-overview` | 成长概览（已有） |
| GET | `/points/records` | 积分流水（已有） |

## 6. 验收标准

### 6.1 功能验收

- [ ] Admin 端可以分页查询 App 用户列表
- [ ] Admin 端可以查看用户详情
- [ ] Admin 端可以更新用户信息
- [ ] Admin 端可以启用/禁用用户
- [ ] Admin 端可以封禁/解封用户
- [ ] Admin 端可以重置用户密码
- [ ] Admin 端可以解锁用户登录锁定
- [ ] App 端可以获取当前用户信息
- [ ] App 端可以更新当前用户资料
- [ ] App 端可以修改密码

### 6.2 质量验收

- [ ] 代码符合项目现有规范
- [ ] 使用现有的 BaseService 和 Prisma 模式
- [ ] DTO 定义完整，包含 Swagger 文档
- [ ] 错误处理完善
- [ ] 密码操作有审计日志

## 7. 待确认问题

以下问题需要确认后才能进入架构设计阶段：

1. **Admin 端用户管理是否需要操作审计日志？**
   - 建议：参考现有 `@Audit()` 装饰器模式

2. **是否需要支持批量操作？**
   - 如：批量禁用、批量解封等

3. **用户状态（status）字段的具体含义？**
   - 需要确认 status 的枚举值和业务含义

4. **封禁功能是否需要自动解封？**
   - banUntil 字段是否需要定时任务自动解封

---

**文档状态**：待审查
**创建时间**：2026-03-07
**创建者**：AI Assistant
