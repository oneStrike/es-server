# App 端用户管理接入 Admin 方案

## 1. 目标

在现有项目结构下，为 `AppUser` 提供独立的 admin 管理能力，解决以下问题：

- admin 端当前只能管理 `AdminUser`，不能管理 app 用户
- app 用户能力分散在 `auth`、`user`、成长体系、论坛画像等多个域，缺少统一管理入口
- 现有可复用能力不少，但不能直接暴露给 admin，否则容易出现字段不全、职责混乱和敏感字段泄露问题

## 2. 当前结论

### 2.1 模块划分

- 新增独立模块：`apps/admin-api/src/modules/app-user`
- 路由前缀统一为：`/admin/app-users`
- 与现有模块职责明确区分：
  - `/admin/user` = 管理端账号
  - `/admin/app-users` = App 端用户

### 2.2 一期范围

一期只做以下能力：

- App 用户分页列表
- App 用户详情
- 基础资料编辑
- 账号启用/禁用
- 社区状态管理
- 积分统计、积分记录、手动加积分、手动扣积分
- 经验统计、经验记录、手动加经验
- 徽章列表、分配徽章、撤销徽章

### 2.3 明确不做

以下能力不再纳入本方案：

- 设备管理
- 设备列表
- 撤销单设备登录
- 撤销全部设备登录
- 后台直接重置 app 用户密码

## 3. 实现原则

- 查询类能力以 `AppUser` 为主表，在 admin 模块内使用 Prisma 显式 `select`
- 成长资产能力复用现有 `UserPointService`、`UserExperienceService`、`UserBadgeService`
- 所有写操作增加审计日志
- 写操作权限先按现有项目规则处理，仅 `SUPER_ADMIN` 可执行
- 不新增表，尽量基于现有模型落地

## 4. 推荐接口

### 4.1 用户主接口

- `GET /admin/app-users/page`
- `GET /admin/app-users/detail`
- `POST /admin/app-users/update-profile`
- `POST /admin/app-users/update-enabled`
- `POST /admin/app-users/update-status`

### 4.2 积分接口

- `GET /admin/app-users/points/stats`
- `GET /admin/app-users/points/records`
- `POST /admin/app-users/points/add`
- `POST /admin/app-users/points/consume`

### 4.3 经验接口

- `GET /admin/app-users/experience/stats`
- `GET /admin/app-users/experience/records`
- `POST /admin/app-users/experience/add`

### 4.4 徽章接口

- `GET /admin/app-users/badges`
- `POST /admin/app-users/badges/assign`
- `POST /admin/app-users/badges/revoke`

## 5. DTO 规范

建议新增一套 admin 专用 DTO，不直接复用 app 端返回模型。

建议 DTO：

- `BaseAdminAppUserDto`
- `AdminAppUserPageItemDto`
- `AdminAppUserDetailDto`
- `UpdateAdminAppUserProfileDto`
- `UpdateAdminAppUserEnabledDto`
- `UpdateAdminAppUserStatusDto`
- `QueryAdminAppUserPageDto`

字段规范：

- 使用 `gender`，不再出现 `genderType`
- 不包含 `password`
- `isEnabled` 与 `status` 并存，不互相替代

## 6. 权限与审计

### 6.1 权限

- 查询类接口：登录即可访问
- 写操作接口：仅 `SUPER_ADMIN`

### 6.2 审计

所有写操作均应记录：

- 操作人 admin id
- 操作类型
- 目标 app user id
- 关键字段变更
- 操作结果

## 7. 最终建议

建议采用下面这条主线：

- 新增独立 `app-user` admin 模块
- 一期先做“账号管理 + 状态管理 + 成长资产管理”
- 不做设备管理
- 不直接做后台改密
- 查询侧不直接复用论坛画像 service 对外返回，统一由 admin DTO 收口
