# App 端用户管理接入 Admin 方案

## 1. 目标

在现有项目结构下，为 `AppUser` 增加一套独立的 admin 管理能力，解决下面几个问题：

- admin 端目前只能管理 `AdminUser`，不能管理 app 用户。
- app 用户能力分散在 `auth`、`user`、成长体系、论坛画像、设备 token 等多个域，缺少统一管理入口。
- 现有可复用能力不少，但直接暴露到 admin 会出现字段不全、职责错位、敏感字段泄露等问题。

本方案先输出后端规范设计，待确认后再实施代码。

## 2. 现状梳理

### 2.1 App 用户当前实际边界

当前 app 用户并不只存在于 `apps/app-api/src/modules/user`，而是由以下几部分共同组成：

- 认证与登录：`apps/app-api/src/modules/auth`
  - 注册、登录、登出、刷新 token
  - 忘记密码、修改密码
  - 设备 token 存储与撤销
- 用户基础信息：`apps/app-api/src/modules/user`
  - 个人资料查询
  - 我的积分流水
- 成长资产：`libs/user`
  - 积分规则、经验规则、等级规则、徽章
  - 统一账本 `growth_ledger_record`
- 论坛画像：`libs/forum/src/profile`
  - 签名、简介
  - 主题数、回复数、获赞数、收藏数
  - 社区状态 `status` / `banReason`
- 账户实体：`prisma/models/app/app-user.prisma`
  - `account` / `phone` / `email`
  - `nickname` / `avatar` / `gender` / `birthDate`
  - `isEnabled` / `status` / `banReason` / `banUntil`
  - `points` / `experience` / `levelId`
  - `lastLoginAt` / `lastLoginIp`

### 2.2 Admin 端当前现状

- `apps/admin-api/src/modules/user` 管理的是后台账号 `AdminUser`，不是 app 用户。
- `apps/admin-api/src/modules/user-growth` 目前只暴露了规则、经验、徽章等能力，没有 app 用户账号管理入口。
- `libs/forum/src/profile/profile.service.ts` 已经有 app 用户画像列表、详情、状态更新能力，但：
  - 列表维度偏论坛画像，不是 admin 用户管理视角；
  - 详情方法直接 `findUnique + include`，未来如果直接暴露，会带出 `password` 哈希；
  - 状态更新没有覆盖 `banUntil`；
  - 不能覆盖设备、登录态、账号启停等 admin 核心诉求。

### 2.3 现有可复用能力

- `UserPointService`
  - 查询积分流水
  - 增加积分
  - 消费积分
  - 查询积分统计
- `UserExperienceService`
  - 增加经验
  - 查询经验流水
  - 查询经验统计
- `UserBadgeService`
  - 分配徽章
  - 撤销徽章
  - 查询用户徽章
- `BaseTokenStorageService`
  - 查询活跃 token
  - 撤销单个 token
  - 撤销用户全部 token

## 3. 当前问题与风险

### 3.1 不能直接复用现有 admin `user` 模块

`/admin/user` 已经被 `AdminUser` 占用。如果继续沿用：

- 语义冲突严重；
- Swagger 文档会混在一起；
- 后续权限判断会越来越乱。

结论：必须单独建立 app 用户管理模块，不能复用 `apps/admin-api/src/modules/user`。

### 3.2 设备能力当前是未完成状态

`apps/app-api/src/modules/auth/auth.service.ts` 的 `getUserDevices` 目前返回的是占位数据，不是实际设备列表。

这意味着：

- app 端“设备列表”本身还未真正完成；
- admin 端如果要做设备管理，必须直接基于 `app_user_token` 补齐真实查询。

### 3.3 存在 DTO / 模型不一致

当前 `BaseAppUserDto` 中存在 `balance` 字段，但 `AppUser` 模型并没有这个字段。

如果 admin 方案继续复用这个 DTO：

- Swagger 会误导前端；
- 返回结构会不稳定；
- 后续实现容易出现“文档有字段、数据库没字段”的假能力。

### 3.4 论坛画像服务不能直接做 admin 详情输出

`ForumProfileService.getProfile` 当前返回的是 `appUser.findUnique({ include: ... })` 结果。

风险：

- 会把 `password` 哈希一并带出来；
- 字段结构偏底层，不适合作为 admin 对外响应模型；
- 后续 detail 场景必须改成显式 `select`。

### 3.5 状态字段需要明确分层

当前有两套状态：

- `isEnabled`
  - 账户是否允许登录
- `status`
  - 社区行为状态，影响发帖、回复、点赞、收藏等互动能力

这两个字段不能混用，否则会出现“禁言”和“封号”语义互相覆盖的问题。

## 4. 设计结论

### 4.1 新模块命名

建议新增：

- `apps/admin-api/src/modules/app-user/app-user.module.ts`
- `apps/admin-api/src/modules/app-user/app-user.controller.ts`
- `apps/admin-api/src/modules/app-user/app-user.service.ts`
- `apps/admin-api/src/modules/app-user/dto/app-user.dto.ts`
- `apps/admin-api/src/modules/app-user/app-user.constant.ts`
- `apps/admin-api/src/modules/app-user/app-user-token-storage.service.ts`

模块路由前缀建议统一为：

- `/admin/app-users`

这样可以和现有 `/admin/user` 明确区分：

- `/admin/user` = 后台管理员
- `/admin/app-users` = App 终端用户

### 4.2 实现原则

- 查询类能力以 `AppUser` 为主表，直接在 admin 模块内用 Prisma 显式 `select`。
- 成长资产能力复用现有 `UserPointService`、`UserExperienceService`、`UserBadgeService`。
- 设备 / token 能力通过新增 `AppUserTokenStorageService` 复用 `BaseTokenStorageService`，不要从 `app-api` 反向引用服务。
- 所有写操作加审计日志。
- 一期不新增表，尽量在现有模型上完成。

## 5. 一期范围

### 5.1 必做

- app 用户分页列表
- app 用户详情
- 编辑基础资料
- 启用 / 禁用账户
- 更新社区状态
- 查询设备列表
- 撤销单设备登录
- 撤销全部登录态
- 查询积分统计 / 积分流水
- 手工加积分 / 扣积分
- 查询经验统计 / 经验流水
- 手工加经验
- 查询用户徽章 / 分配徽章 / 撤销徽章

### 5.2 建议放到二期

- 后台直接重置 app 用户密码
- 用户举报处理聚合页
- 用户购买 / 下载 / 评论 / 主题 / 回复完整时间线
- 批量封禁 / 批量导出

二期单独做的原因：

- 密码重置涉及安全策略，不适合仓促落地；
- 举报、购买、下载属于“用户运营画像”，不是一期最小闭环；
- 批量操作需要更严格的审计和幂等设计。

## 6. 接口草案

### 6.1 用户主接口

`GET /admin/app-users/page`

- 作用：分页查询 app 用户
- 建议筛选项：
  - `id`
  - `account`
  - `phone`
  - `nickname`
  - `isEnabled`
  - `status`
  - `levelId`
  - `createdAtStart` / `createdAtEnd`
  - `lastLoginAtStart` / `lastLoginAtEnd`
- 返回字段建议：
  - `id`
  - `account`
  - `phone`
  - `nickname`
  - `avatar`
  - `isEnabled`
  - `status`
  - `banReason`
  - `banUntil`
  - `levelId`
  - `points`
  - `experience`
  - `lastLoginAt`
  - `lastLoginIp`
  - `createdAt`
  - `forumProfile.topicCount`
  - `forumProfile.replyCount`

`GET /admin/app-users/detail`

- 参数：`id`
- 返回：
  - 账户基础信息
  - 论坛画像
  - 徽章列表
  - 活跃设备数
  - 最近积分 / 经验摘要

`POST /admin/app-users/update-profile`

- 可编辑字段建议：
  - `nickname`
  - `avatar`
  - `phone`
  - `email`
  - `gender`
  - `birthDate`
  - `forumProfile.signature`
  - `forumProfile.bio`

`POST /admin/app-users/update-enabled`

- 参数：
  - `id`
  - `isEnabled`
- 语义：
  - `false` 表示禁止登录
  - 建议同时支持 `revokeTokens: boolean`

`POST /admin/app-users/update-status`

- 参数：
  - `id`
  - `status`
  - `banReason`
  - `banUntil`
- 语义：
  - 仅控制社区行为状态，不直接代替 `isEnabled`

### 6.2 设备管理接口

`GET /admin/app-users/devices`

- 参数：`userId`
- 返回：
  - `id`
  - `jti`
  - `tokenType`
  - `deviceInfo`
  - `ipAddress`
  - `userAgent`
  - `createdAt`
  - `expiresAt`
  - `revokedAt`
  - `revokeReason`

`POST /admin/app-users/revoke-device`

- 参数：
  - `userId`
  - `tokenId`

`POST /admin/app-users/revoke-all-devices`

- 参数：
  - `userId`

### 6.3 积分接口

`GET /admin/app-users/points/stats`

- 参数：`userId`

`GET /admin/app-users/points/records`

- 参数：
  - `userId`
  - `ruleId`
  - 分页参数

`POST /admin/app-users/points/add`

- 参数：
  - `userId`
  - `ruleType`
  - `remark`

`POST /admin/app-users/points/consume`

- 参数：
  - `userId`
  - `points`
  - `targetType`
  - `targetId`
  - `remark`

### 6.4 经验接口

`GET /admin/app-users/experience/stats`

- 参数：`userId`

`GET /admin/app-users/experience/records`

- 参数：
  - `userId`
  - `ruleId`
  - 分页参数

`POST /admin/app-users/experience/add`

- 参数：
  - `userId`
  - `ruleType`
  - `remark`

### 6.5 徽章接口

`GET /admin/app-users/badges`

- 参数：
  - `userId`
  - 可附加徽章筛选条件

`POST /admin/app-users/badges/assign`

- 参数：
  - `userId`
  - `badgeId`

`POST /admin/app-users/badges/revoke`

- 参数：
  - `userId`
  - `badgeId`

## 7. DTO 规范

建议新增一套 admin 专用 DTO，不直接复用 app 端返回模型。

建议 DTO：

- `BaseAdminAppUserDto`
- `AdminAppUserPageDto`
- `AdminAppUserDetailDto`
- `UpdateAdminAppUserProfileDto`
- `UpdateAdminAppUserEnabledDto`
- `UpdateAdminAppUserStatusDto`
- `QueryAdminAppUserDeviceDto`
- `RevokeAdminAppUserDeviceDto`

字段规范：

- 使用 `gender`，不要再出现 `genderType`
- 删除 `balance`，因为当前模型无此字段
- 详情 DTO 不允许包含 `password`
- `isEnabled` 与 `status` 必须并存，不互相替代

## 8. 权限与审计建议

### 8.1 权限

基于当前项目只有 `NORMAL_ADMIN / SUPER_ADMIN` 两级角色，建议一期先这样落地：

- 查询类接口：登录即可访问
- 写操作接口：仅 `SUPER_ADMIN`

写操作包括：

- 更新资料
- 启停账户
- 更新社区状态
- 撤销设备
- 加积分 / 扣积分
- 加经验
- 分配 / 撤销徽章

### 8.2 审计

所有写操作必须加 `@Audit`，至少记录：

- 操作人 admin id
- 操作类型
- 目标 app user id
- 变更前后关键字段
- 是否成功

## 9. 推荐实现方式

### 9.1 查询实现

不要复用 `ForumProfileService.getProfile` 直接对外返回。

推荐在 `AppUserService` 内直接做显式查询：

- `prisma.appUser.findPagination`
- `prisma.appUser.findUnique`
- 带 `forumProfile`、`userBadges`、`level` 的 `select`

原因：

- admin 列表筛选条件比论坛画像更多；
- 详情需要稳定 DTO；
- 可以彻底避免密码字段泄露。

### 9.2 设备实现

新增 `AppUserTokenStorageService`，实现方式与 `AdminTokenStorageService` 一致，只是委托模型换成 `prisma.appUserToken`。

这样可以：

- 复用缓存失效逻辑；
- 复用撤销全部 token 的逻辑；
- 避免 admin 依赖 `apps/app-api` 内部服务。

### 9.3 状态更新实现

账户相关操作分成两个接口：

- `update-enabled`
  - 控制登录能力
- `update-status`
  - 控制互动能力

不要把“封禁”直接写成 `isEnabled = false`，否则会损失社区状态语义。

## 10. 密码重置建议

一期不建议直接做“后台重置 app 用户密码”，原因如下：

- 当前 app 端有短信找回密码链路，后台直接改密码不一定是最佳流程；
- 若后台返回临时明文密码，存在额外泄露风险；
- 若要规范支持，应补充“强制下次修改密码”能力，但当前模型没有对应字段。

更稳妥的一期替代方案：

- 支持 `禁用账户`
- 支持 `撤销全部登录态`
- 用户自行走 `forgot-password`

如果你明确要求一期就支持后台重置密码，我建议作为增强项单独做，并同步补上：

- 临时密码策略
- 强制改密标记
- 更严格的审计

## 11. 需要顺手修正的现有问题

在正式开发 admin 模块时，建议一起修掉下面几个问题：

1. `apps/app-api/src/modules/auth/auth.service.ts`
   - `getUserDevices` 不是实际实现，需要改为真实查询 `app_user_token`

2. `libs/forum/src/profile/profile.service.ts`
   - `getProfile` 不能直接返回完整 `AppUser`
   - 至少要改成显式 `select` 或仅在内部使用

3. `libs/forum/src/profile/profile.service.ts`
   - `updateProfileStatus` 需要补齐 `banUntil`

4. `apps/app-api/src/modules/auth/dto/auth.dto.ts`
   - `BaseAppUserDto.balance` 与数据库模型不一致，需要移除或延后设计

## 12. 实施顺序

确认后建议按这个顺序落地：

1. 新增 admin 侧 `app-user` 模块骨架与 DTO
2. 实现 app 用户列表 / 详情
3. 实现账户启停与社区状态更新
4. 实现设备列表与设备撤销
5. 接入积分 / 经验 / 徽章接口
6. 补充 Swagger 与审计
7. 补测试

## 13. 最终建议

建议采用下面这条主线：

- 新增独立 `app-user` admin 模块
- 一期先做“账号管理 + 状态管理 + 设备管理 + 成长资产管理”
- 不直接做后台改密
- 查询侧不用硬复用论坛画像 service，避免 DTO 和敏感字段问题
- token 管理通过 admin 侧新增 `AppUserTokenStorageService` 复用基础能力

这个方案改动范围可控，能较快形成可用闭环，也不会把 admin 用户和 app 用户继续混在一起。
