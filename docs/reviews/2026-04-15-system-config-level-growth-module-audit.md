# 系统配置与等级成长模块审查结果清单（2026-04-15）

## 1. 审查范围

本次审查覆盖以下与“系统配置、等级成长、积分/经验、用户侧消费”直接相关的代码：

- `apps/admin-api/src/modules/system/config/system-config.controller.ts`
- `libs/config/src/system-config/*`
- `libs/platform/src/modules/upload/*`
- `libs/platform/src/modules/sms/sms.service.ts`
- `apps/admin-api/src/modules/growth/level-rule/level-rule.controller.ts`
- `libs/growth/src/level-rule/*`
- `libs/growth/src/point/*`
- `libs/growth/src/experience/*`
- `libs/growth/src/growth-reward/*`
- `libs/growth/src/growth-ledger/growth-ledger.service.ts`
- `libs/interaction/src/like/like.service.ts`
- `libs/interaction/src/favorite/favorite.service.ts`
- `libs/content/src/permission/content-permission.service.ts`
- `apps/app-api/src/modules/user/user.service.ts`
- `apps/admin-api/src/modules/app-user/app-user-growth.service.ts`
- `libs/forum/src/profile/profile.service.ts`
- `db/schema/system/system-config.ts`
- `db/schema/app/user-level-rule.ts`
- `db/schema/app/app-user.ts`
- `db/schema/app/growth-ledger-record.ts`
- `db/seed/modules/app/domain.ts`
- 相关测试：
  - `apps/app-api/src/modules/user/user.service.spec.ts`
  - `libs/content/src/permission/content-permission.service.spec.ts`

## 2. 审查维度

- 架构与分层：Controller / Service / DTO / Schema 是否职责清晰
- 契约与校验：DTO、跨字段约束、运行时兜底是否一致
- 业务正确性：等级升级、成长发放、折扣与权限口径是否闭环
- 并发与一致性：快照写入、幂等、迟到事件、统计口径是否一致
- 运行安全：错误配置是否会被提前拦截，还是拖到运行时爆炸
- 测试覆盖：高风险链路是否有直接测试保护

## 3. 总体结论

整体分层并不混乱，系统配置、等级规则、积分/经验、成长账本已经有较明确的模块边界；`growth-ledger` 也承担了统一账本和等级同步职责。  
但当前实现仍有 4 个需要优先处理的实质性问题，以及 1 个中风险统计口径问题：

- 系统配置更新存在并发覆盖风险。
- 系统配置切换上传 provider 缺少前置校验，会把错误配置延迟到运行时爆炸。
- 等级规则中的 `loginDays` 配置完全未生效，属于“后台可配、实际不执行”。
- `dailyLikeLimit` / `dailyFavoriteLimit` 只做了查询口径，没有进入真实点赞/收藏写路径。
- 成长“今日统计”与成长规则的“按事件发生日限额”口径不一致，补发/迟到事件会导致展示失真。

## 4. 重点问题

### 4.1 [必须修复] 系统配置更新以缓存快照为写源，并发下会覆盖他人刚提交的配置

**定位：**

- `libs/config/src/system-config/system-config.service.ts:103-156`

**问题描述：**

`updateConfig()` 不是基于数据库最新快照读后更新，而是直接从 `configReader.get()` 读取当前内存缓存，然后把局部变更 merge 成整份快照，再 `insert` 一条新的 snapshot。

这会出现典型的 lost update：

1. 管理员 A 和 B 同时打开配置页，拿到同一份缓存。
2. A 修改 `siteConfig` 并保存。
3. B 仅修改 `uploadConfig` 并保存。
4. B 的请求仍以旧缓存为基底重新组装整份快照，最终把 A 刚写入的 `siteConfig` 覆盖回旧值。

**风险等级：高**

系统配置是全局事实源，丢更新会直接影响上传、短信、审核策略和站点配置，且问题很隐蔽，线上通常表现为“某个配置怎么又变回去了”。

**建议修复：**

- 方案 A：更新前读取数据库最新一条快照，在事务内 merge 后再落库。
- 方案 B：为配置快照引入版本号 / `updatedAt` 乐观锁，保存时校验前端版本。

当前更推荐 **方案 A + 版本校验**，避免多实例和多管理员并发时继续静默覆盖。

### 4.2 [必须修复] 切换上传 provider 前缺少前置校验，错误配置会在运行时放大成全局上传故障

**定位：**

- `libs/config/src/system-config/dto/config.dto:225-353`
- `libs/config/src/system-config/system-config.service.ts:103-144`
- `libs/platform/src/modules/upload/qiniu-upload.provider.ts:18-26`
- `libs/platform/src/modules/upload/superbed-upload.provider.ts:20-23`

**问题描述：**

后台可以把 `uploadConfig.provider` 改成 `qiniu` 或 `superbed`，但 DTO 和 service 都没有做“provider 与子配置一致性”的校验。

结果是：

- 可以保存 `provider=qiniu` 但 `accessKey/secretKey/bucket/domain` 为空的配置。
- 也可以保存 `provider=superbed` 但 `token` 为空的配置。
- 后台保存时看起来成功，直到第一次真实上传才在 provider 内抛 `配置不完整`，把问题延迟到运行时。

**风险等级：高**

这类问题一旦上线，不是“某个按钮报错”，而是整条上传能力在运行时整体失效。

**建议修复：**

- 在 `updateConfig()` 增加 provider 级别的一致性校验。
- 当 `provider=qiniu` 时，至少要求 `accessKey`、`secretKey`、`bucket`、`domain` 都非空。
- 当 `provider=superbed` 时，至少要求 `token` 非空。
- 最好补一个“保存前探测”或“仅校验、不落库”的管理端校验接口。

### 4.3 [必须修复] 等级规则的 `loginDays` 完全未参与升级判定，后台配置实际不生效

**定位：**

- `db/schema/app/user-level-rule.ts:36-38`
- `libs/growth/src/level-rule/dto/level-rule.dto.ts:52-57`
- `libs/growth/src/level-rule/level-rule.service.ts:275-282`
- `libs/growth/src/growth-ledger/growth-ledger.service.ts:972-986`
- `db/seed/modules/app/domain.ts:70-127`

**问题描述：**

等级规则和 seed 明确提供了 `loginDays`，并且预置了 `7`、`30` 这样的真实业务值；但当前所有等级命中逻辑都只按 `requiredExperience` 查最高等级：

- `getHighestLevelRuleByExperienceInTx()` 只比较经验值。
- `findTargetLevelRule()` 只比较经验值。
- 注册初始化默认等级也只按 `sortOrder` 取第一条启用规则。

也就是说，运营配置了“登录 7 天/30 天才能升级”，当前实现完全不会执行。

**风险等级：高**

这是典型的“后台可配但无执行”的假功能。配置一旦被信任，会直接造成等级晋升口径错误和运营预期落空。

**建议修复：**

- 先明确 `loginDays` 的事实源：是累计登录天数、连续登录天数还是自然日活跃天数。
- 在等级命中逻辑中，把 `requiredExperience + loginDays` 作为联合门槛，而不是只比较经验。
- 若当前阶段没有登录天数字段和统计链路，建议先下线该字段，不要继续对外暴露一个不生效的配置。

### 4.4 [必须修复] `dailyLikeLimit` / `dailyFavoriteLimit` 只在“检查接口”里统计，真实写路径完全不拦截

**定位：**

- `libs/growth/src/level-rule/level-rule.service.ts:390-423`
- `libs/interaction/src/like/like.service.ts:164-195`
- `libs/interaction/src/favorite/favorite.service.ts:115-162`
- `db/seed/modules/app/domain.ts:81-85`
- `db/seed/modules/app/domain.ts:100-104`
- `db/seed/modules/app/domain.ts:119-123`

**问题描述：**

等级规则里明确有 `dailyLikeLimit` 和 `dailyFavoriteLimit`，`checkLevelPermission()` 也能算出这两个指标；但真实点赞/收藏主链路没有任何等级限制检查：

- `LikeService.like()` 直接落点赞记录。
- `FavoriteService.favorite()` 直接落收藏记录。
- 控制器也没有在入口层做额外校验。

这意味着：

- 后台配了每日点赞/收藏上限，但前台实际可以无限点赞、无限收藏。
- 管理端“权限检查”接口和真实业务行为不一致。
- seed 中配置的限制值只是展示数据，不是执行规则。

**风险等级：高**

这不是统计问题，而是权限规则没有进入实际写路径，属于直接的业务漏拦截。

**建议修复：**

- 在点赞、收藏入口统一接入等级权限检查。
- 若点赞/收藏未来需要区分论坛、作品、章节等不同目标，再明确规则是全局配额还是分业务配额。
- 补集成测试覆盖“达到当日上限后再次点赞/收藏必须被拒绝”。

### 4.5 [建议修改] 成长“今日统计”按 `createdAt` 统计，但成长限额按 `occurredAt` 计日，补发/迟到事件会让口径失真

**定位：**

- `libs/growth/src/growth-ledger/growth-ledger.service.ts:186-198`
- `libs/growth/src/experience/experience.service.ts:333-347`
- `libs/growth/src/point/point.service.ts:364-378`
- `apps/app-api/src/modules/user/user.service.ts:367-416`
- `apps/admin-api/src/modules/app-user/app-user-growth.service.ts:121-161`

**问题描述：**

成长账本做每日限额时，使用的是事件发生时间 `occurredAt` 生成 `dayKey`；但用户侧/管理端“今日新增积分/经验”统计，统一按账本记录的 `createdAt` 统计。

这会在补发、重放、迟到事件场景下出现口径不一致：

- 限额归属的是“事件发生那天”；
- 展示归属的是“账本落库那天”。

例如昨天发生的事件今天补发：

- 它不会占用今天的 daily limit；
- 但会被计入今天的 `todayEarned`。

**风险等级：中**

如果系统明确支持迟到事件和补发事件，这会直接影响用户中心和管理后台的“今日成长”可信度。

**建议修复：**

- 方案 A：在账本表显式补 `occurredAt`，统计口径统一按 `occurredAt`。
- 方案 B：若产品定义就是“按结算日展示”，那就需要在文案和后台说明中明确这是“今日入账”，不是“今日发生”。

当前更推荐 **方案 A**，因为它能让限额、展示、对账三条链路保持一致。

## 5. 测试覆盖评估

当前相关测试覆盖明显不足：

- 直接命中本次审查范围的测试文件，仅发现：
  - `apps/app-api/src/modules/user/user.service.spec.ts`
  - `libs/content/src/permission/content-permission.service.spec.ts`
- 未发现以下高风险模块的直接单测或集成测试：
  - `libs/config/src/system-config/*`
  - `libs/growth/src/level-rule/*`
  - `libs/growth/src/point/*`
  - `libs/growth/src/experience/*`
  - `libs/growth/src/growth-reward/*`
  - `libs/interaction/src/like/like.service.ts`
  - `libs/interaction/src/favorite/favorite.service.ts`

**建议补测重点：**

- 系统配置并发更新不能互相覆盖。
- 上传 provider 配置不完整时保存阶段必须失败。
- `loginDays` 门槛生效前后的升级判定。
- 达到 `dailyLikeLimit` / `dailyFavoriteLimit` 后再次写入必须拒绝。
- 迟到事件场景下 `todayEarned` / `todayConsumed` 的口径定义。

## 6. 验证结果

- `pnpm test -- --runInBand --runTestsByPath apps/app-api/src/modules/user/user.service.spec.ts libs/content/src/permission/content-permission.service.spec.ts`
  - 结果：通过（2 个 test suites，4 个 tests）
- `pnpm type-check`
  - 结果：通过

## 7. 建议整改优先级

1. 先修复系统配置并发覆盖问题。
2. 再补上传 provider 的保存前一致性校验。
3. 尽快决定 `loginDays` 是补真实执行链路，还是先从后台下线。
4. 把点赞/收藏等级限制真正接入写路径。
5. 最后统一成长“今日统计”的口径定义与存储字段。

## 8. 本次审查产出

- 审查文档：`docs/reviews/2026-04-15-system-config-level-growth-module-audit.md`
- 本次仅做代码审查与本地清单生成，没有修改业务实现。
- 工作区内与签到、消息等其他模块相关的未提交改动，不纳入本次结论责任范围。
