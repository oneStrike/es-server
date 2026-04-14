# 数据表定义与 Relations 字段级审查报告

## 审查范围

- 覆盖 77 张 runtime 表，来源于 75 个 schema 源文件。
- 覆盖 69 个 table relation block，共 196 条 soft relation。
- legacy 自动转换 schema 文件 54 个，手工建模 / 较新 schema 文件 21 个。
- 数据库外键现状：未在 `db/schema` 与 `db/migration` 中发现数据库 FK / REFERENCES 定义。
- 审查原则：闭集状态/类型/模式/角色/等级/平台字段统一建议使用 `smallint` 或 `smallint[]`；注释必须写清数值含义；修复方案不允许引入数据库 FK。

## 总体结论

- 需要优先整改的闭集语义字段共有 43 个，主要集中在 `app-user`、`check-in`、`message`、`system eventing` 等模块。
- 现有 `smallint` 字段中，仍有 41 个字段的注释没有写清数值映射。
- 缺少字段注释的字段共有 74 个，缺少表注释的表共有 1 张。
- 仍在使用长 `varchar` 承载长文本的字段共有 1 个。
- 没有对应 soft relation block、但表内存在明显关联字段的表共有 3 张。

## 统一整改规则

- 规则 1：闭集语义字段使用 `smallint` / `smallint[]`，不要继续使用 `varchar`、`integer`、`integer[]` 混搭。
- 规则 2：每个 `smallint` 字段的注释都要把数值含义写全，不能只写“状态”“类型”“角色”。
- 规则 3：开放字符串字段保留字符串，例如 `eventKey`、`categoryKey`、`projectionKey`、`planCode`、`packageMimeType`。
- 规则 4：soft relation 只在 `db/relations/*.ts` 建模，不引入数据库 FK；但 `from/to/alias/through` 必须与表字段语义一致。
- 规则 5：计数、价格、目标值、排序值等数值字段，若业务上有明确边界，应显式补 `check(...)`。

## admin 域

- 表数量：2
- 高风险项：1 张表存在结构性问题或缺失项。

### admin_user（adminUser）

- Schema 文件：`db/schema/admin/admin-user.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/admin.ts`
- 表注释：管理端用户
- 重点结论：smallint 字段注释未写清数值含义。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键id。结论：保留。建议：维持当前定义。
- `username`：当前 `varchar({ length: 20 }).notNull()`。注释：账号。结论：保留。建议：维持当前定义。
- `password`：当前 `varchar({ length: 500 }).notNull()`。注释：密码。结论：保留。建议：维持当前定义。
- `mobile`：当前 `varchar({ length: 11 })`。注释：手机号码；为空表示未绑定，非空时在管理端账号内必须唯一。结论：保留。建议：维持当前定义。
- `avatar`：当前 `varchar({ length: 200 })`。注释：头像。结论：保留。建议：维持当前定义。
- `role`：当前 `smallint().default(0).notNull()`。注释：账号角色。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `isEnabled`：当前 `boolean().default(true).notNull()`。注释：是否启用账号。结论：保留。建议：维持当前定义。
- `lastLoginAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：最后登录时间。结论：保留。建议：维持当前定义。
- `lastLoginIp`：当前 `varchar({ length: 45 })`。注释：最后登录IP。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("admin_user_username_key").on(table.username)`：唯一性约束明确，字段类型调整后通常继续保留。
- `unique("admin_user_mobile_key").on(table.mobile)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("admin_user_is_enabled_idx").on(table.isEnabled)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("admin_user_role_idx").on(table.role)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("admin_user_created_at_idx").on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("admin_user_last_login_at_idx").on(table.lastLoginAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `tokens`：`r.many.adminUserToken()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `createdTasks`：`r.many.task({ from: r.adminUser.id, to: r.task.createdById, alias: 'TaskCreatedBy', })`。from=`r.adminUser.id`，to=`r.task.createdById`，alias=`TaskCreatedBy` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=TaskCreatedBy，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `updatedTasks`：`r.many.task({ from: r.adminUser.id, to: r.task.updatedById, alias: 'TaskUpdatedBy', })`。from=`r.adminUser.id`，to=`r.task.updatedById`，alias=`TaskUpdatedBy` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=TaskUpdatedBy，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `updatedAppConfigs`：`r.many.appConfig({ from: r.adminUser.id, to: r.appConfig.updatedById, alias: 'AppConfigUpdater', })`。from=`r.adminUser.id`，to=`r.appConfig.updatedById`，alias=`AppConfigUpdater` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=AppConfigUpdater，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `updatedSystemConfigs`：`r.many.systemConfig({ from: r.adminUser.id, to: r.systemConfig.updatedById, alias: 'SystemConfigUpdater', })`。from=`r.adminUser.id`，to=`r.systemConfig.updatedById`，alias=`SystemConfigUpdater` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=SystemConfigUpdater，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### admin_user_token（adminUserToken）

- Schema 文件：`db/schema/admin/admin-user-token.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/admin.ts`
- 表注释：管理端用户令牌表 - 用于存储用户的 JWT Token，支持多设备登录管理和 Token 撤销
- 重点结论：闭集语义字段未使用 smallint。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：令牌ID。结论：保留。建议：维持当前定义。
- `jti`：当前 `varchar({ length: 255 }).notNull()`。注释：JWT Token ID（唯一标识，用于黑名单和撤销）。结论：保留。建议：维持当前定义。
- `userId`：当前 `integer().notNull()`。注释：用户ID。结论：保留。建议：维持当前定义。
- `tokenType`：当前 `varchar({ length: 20 }).notNull()`。注释：令牌类型（ACCESS:访问令牌, REFRESH:刷新令牌）。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `expiresAt`：当前 `timestamp({ withTimezone: true }).notNull()`。注释：令牌过期时间。结论：保留。建议：维持当前定义。
- `revokedAt`：当前 `timestamp({ withTimezone: true })`。注释：令牌撤销时间（null表示未撤销）。结论：保留。建议：维持当前定义。
- `revokeReason`：当前 `varchar({ length: 50 })`。注释：撤销原因（PASSWORD_CHANGE:密码修改, USER_LOGOUT:用户退出, ADMIN_REVOKE:管理员撤销, SECURITY:安全原因）。结论：保留。建议：维持当前定义。
- `deviceInfo`：当前 `jsonb()`。注释：设备信息（JSON格式，包含设备类型、操作系统、浏览器等）。结论：保留。建议：维持当前定义。
- `ipAddress`：当前 `varchar({ length: 45 })`。注释：IP地址。结论：保留。建议：维持当前定义。
- `userAgent`：当前 `varchar({ length: 500 })`。注释：用户代理。结论：保留。建议：维持当前定义。
- `geoCountry`：当前 `varchar({ length: 100 })`。注释：登录态创建时解析到的国家/地区 仅记录新写入 token 的属地快照，无法解析或历史记录时为空。结论：保留。建议：维持当前定义。
- `geoProvince`：当前 `varchar({ length: 100 })`。注释：登录态创建时解析到的省份/州 仅记录新写入 token 的属地快照，无法解析或历史记录时为空。结论：保留。建议：维持当前定义。
- `geoCity`：当前 `varchar({ length: 100 })`。注释：登录态创建时解析到的城市 仅记录新写入 token 的属地快照，无法解析或历史记录时为空。结论：保留。建议：维持当前定义。
- `geoIsp`：当前 `varchar({ length: 100 })`。注释：登录态创建时解析到的网络运营商 仅记录新写入 token 的属地快照，无法解析或历史记录时为空。结论：保留。建议：维持当前定义。
- `geoSource`：当前 `varchar({ length: 50 })`。注释：属地解析来源 当前固定为 ip2region；历史记录或未补齐属地快照时为空。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `createdAt`：当前 `timestamp({ withTimezone: true }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("admin_user_token_jti_key").on(table.jti)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("admin_user_token_user_id_idx").on(table.userId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("admin_user_token_jti_idx").on(table.jti)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("admin_user_token_token_type_idx").on(table.tokenType)`：涉及待改 `smallint` 字段，索引语义可以保留，但生成语句要跟随字段类型一起调整。
- `index("admin_user_token_expires_at_idx").on(table.expiresAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("admin_user_token_revoked_at_idx").on(table.revokedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("admin_user_token_user_id_token_type_idx").on(table.userId, table.tokenType)`：涉及待改 `smallint` 字段，索引语义可以保留，但生成语句要跟随字段类型一起调整。

#### Relations 审查

- `user`：`r.one.adminUser({ from: r.adminUserToken.userId, to: r.adminUser.id, })`。from=`r.adminUserToken.userId`，to=`r.adminUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

## app 域

- 表数量：39
- 高风险项：28 张表存在结构性问题或缺失项。

### app_agreement（appAgreement）

- Schema 文件：`db/schema/app/app-agreement.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/app.ts`
- 表注释：应用协议表 - 存储隐私政策、用户协议等
- 重点结论：当前未发现高优先级结构问题。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `title`：当前 `varchar({ length: 100 }).notNull()`。注释：协议标题。结论：保留。建议：维持当前定义。
- `content`：当前 `text().notNull()`。注释：协议内容 (HTML/Markdown)。结论：保留。建议：维持当前定义。
- `version`：当前 `varchar({ length: 50 }).notNull()`。注释：版本号 (如 1.0.0, 20231027)。结论：保留。建议：维持当前定义。
- `isForce`：当前 `boolean().default(false).notNull()`。注释：是否强制重新同意 (用于重大更新，true则用户必须再次点击同意)。结论：保留。建议：维持当前定义。
- `showInAuth`：当前 `boolean().default(false).notNull()`。注释：是否展示在登录注册页 (true:展示, false:不展示)。结论：保留。建议：维持当前定义。
- `isPublished`：当前 `boolean().default(false).notNull()`。注释：是否已发布。结论：保留。建议：维持当前定义。
- `publishedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：发布时间。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("app_agreement_title_version_key").on(table.title, table.version)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("app_agreement_title_is_published_idx").on(table.title, table.isPublished)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `agreementLogs`：`r.many.appAgreementLog()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### app_agreement_log（appAgreementLog）

- Schema 文件：`db/schema/app/app-agreement.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/app.ts`
- 表注释：应用协议签署记录表
- 重点结论：当前未发现高优先级结构问题。

#### 字段审查

- `id`：当前 `bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID (使用BigInt防止记录过多)。结论：保留。建议：维持当前定义。
- `userId`：当前 `integer().notNull()`。注释：用户ID。结论：保留。建议：维持当前定义。
- `agreementId`：当前 `integer().notNull()`。注释：协议ID。结论：保留。建议：维持当前定义。
- `version`：当前 `varchar({ length: 50 }).notNull()`。注释：签署时的协议版本快照。结论：保留。建议：维持当前定义。
- `agreedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：签署时间。结论：保留。建议：维持当前定义。
- `ipAddress`：当前 `varchar({ length: 45 })`。注释：签署IP。结论：保留。建议：维持当前定义。
- `deviceInfo`：当前 `varchar({ length: 500 })`。注释：设备信息/UserAgent。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `index("app_agreement_log_user_id_agreement_id_idx").on(table.userId, table.agreementId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("app_agreement_log_agreed_at_idx").on(table.agreedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `agreement`：`r.one.appAgreement({ from: r.appAgreementLog.agreementId, to: r.appAgreement.id, })`。from=`r.appAgreementLog.agreementId`，to=`r.appAgreement.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `user`：`r.one.appUser({ from: r.appAgreementLog.userId, to: r.appUser.id })`。from=`r.appAgreementLog.userId`，to=`r.appUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### app_announcement（appAnnouncement）

- Schema 文件：`db/schema/app/app-announcement.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/app.ts`
- 表注释：系统公告表 - 存储平台公告、活动公告、维护公告等信息
- 重点结论：smallint 字段注释未写清数值含义；缺少显式数值边界约束；闭集语义字段未使用 smallint。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `pageId`：当前 `integer()`。注释：关联的页面ID（可选）。结论：保留。建议：维持当前定义。
- `title`：当前 `varchar({ length: 100 }).notNull()`。注释：公告标题。结论：保留。建议：维持当前定义。
- `content`：当前 `text().notNull()`。注释：公告内容。结论：保留。建议：维持当前定义。
- `summary`：当前 `varchar({ length: 500 })`。注释：公告摘要。结论：保留。建议：维持当前定义。
- `announcementType`：当前 `smallint().default(0).notNull()`。注释：公告类型（0=平台公告, 1=活动公告, 2=维护公告, 3=更新公告, 4=政策公告）。结论：保留。建议：维持当前定义。
- `priorityLevel`：当前 `smallint().default(1).notNull()`。注释：优先级（数值越大越重要）。结论：smallint 字段注释未写清数值含义；缺少显式数值边界约束。建议：在注释中补齐每个数值对应的业务语义。；结合业务语义补充 `check(...)`，明确非负或正数边界。
- `isPublished`：当前 `boolean().default(false).notNull()`。注释：是否已发布。结论：保留。建议：维持当前定义。
- `isPinned`：当前 `boolean().default(false).notNull()`。注释：是否置顶。结论：保留。建议：维持当前定义。
- `showAsPopup`：当前 `boolean().default(false).notNull()`。注释：是否以弹窗形式显示。结论：保留。建议：维持当前定义。
- `popupBackgroundImage`：当前 `varchar({ length: 200 })`。注释：弹窗背景图片URL。结论：保留。建议：维持当前定义。
- `popupBackgroundPosition`：当前 `varchar({ length: 20 }).default('center')`。注释：弹窗背景图片位置（CSS background-position 值，支持多方位定位） 默认值为 center（居中）。结论：保留。建议：维持当前定义。
- `enablePlatform`：当前 `integer() .array() .default(sql\`ARRAY[1,2,3]::integer[]\`)`。注释：启用的平台列表（1=H5, 2=App, 3=小程序；默认值为全部平台）。结论：闭集语义字段未使用 smallint。建议：改为 `smallint().array()`，并在注释中写清每个数值的含义。
- `publishStartTime`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：发布开始时间。结论：保留。建议：维持当前定义。
- `publishEndTime`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：发布结束时间。结论：保留。建议：维持当前定义。
- `viewCount`：当前 `integer().default(0).notNull()`。注释：浏览次数。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .defaultNow() .notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .$onUpdate(() => new Date()) .notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `index('app_announcement_is_published_publish_start_time_publish_en_idx').on( table.isPublished, table.publishStartTime, table.publishEndTime, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('app_announcement_announcement_type_is_published_idx').on( table.announcementType, table.isPublished, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('app_announcement_priority_level_is_pinned_idx').on( table.priorityLevel, table.isPinned, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('app_announcement_created_at_idx').on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('app_announcement_page_id_idx').on(table.pageId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('app_announcement_show_as_popup_is_published_idx').on( table.showAsPopup, table.isPublished, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `appPage`：`r.one.appPage({ from: r.appAnnouncement.pageId, to: r.appPage.id, alias: 'announcements', })`。from=`r.appAnnouncement.pageId`，to=`r.appPage.id`，alias=`announcements` 结论：from/to 明确，属于单对象软关联。 alias=announcements，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `announcementReads`：`r.many.appAnnouncementRead()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### app_announcement_notification_fanout_task（appAnnouncementNotificationFanoutTask）

- Schema 文件：`db/schema/app/app-announcement-notification-fanout-task.ts`
- 风格来源：手工建模 / 新增表
- 对应 relations：未定义
- 表注释：缺失
- 重点结论：缺少表注释；当前无对应 soft relations 定义；缺少字段注释；闭集语义字段未使用 smallint。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `announcementId`：当前 `integer().notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `desiredEventKey`：当前 `varchar({ length: 120 }).notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `status`：当前 `varchar({ length: 32 }).notNull()`。注释：缺失。结论：缺少字段注释；闭集语义字段未使用 smallint。建议：补充字段注释，明确字段语义和取值约束。；改为 `smallint()`，并在注释中写清每个数值的含义。
- `cursorUserId`：当前 `integer()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `lastError`：当前 `varchar({ length: 500 })`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `startedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `finishedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .defaultNow() .notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .$onUpdate(() => new Date()) .notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。

#### 索引与约束审查

- `unique('app_announcement_notification_fanout_task_announcement_id_key').on( table.announcementId, )`：唯一性约束明确，字段类型调整后通常继续保留。
- `index('app_announcement_notification_fanout_task_status_idx').on( table.status, )`：涉及待改 `smallint` 字段，索引语义可以保留，但生成语句要跟随字段类型一起调整。
- `index('app_announcement_notification_fanout_task_status_updated_at_idx').on( table.status, table.updatedAt.desc(), )`：涉及待改 `smallint` 字段，索引语义可以保留，但生成语句要跟随字段类型一起调整。

#### Relations 审查

- 当前未声明 soft relations。结论：表内关联字段只停留在列语义层。建议：若后续需要 Drizzle relational query，再补 `defineRelationsPart`，但仍不引入数据库 FK。

### app_announcement_read（appAnnouncementRead）

- Schema 文件：`db/schema/app/app-announcement-read.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/app.ts`
- 表注释：系统公告阅读记录表 - 记录用户已读的公告
- 重点结论：当前未发现高优先级结构问题。

#### 字段审查

- `announcementId`：当前 `integer().notNull()`。注释：关联的公告ID。结论：保留。建议：维持当前定义。
- `userId`：当前 `integer().notNull()`。注释：关联的用户ID。结论：保留。建议：维持当前定义。
- `readAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .defaultNow() .notNull()`。注释：阅读时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `index('app_announcement_read_user_id_read_at_idx').on( table.userId, table.readAt.desc(), )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `primaryKey({ columns: [table.announcementId, table.userId] })`：主键定义明确，保持现状。

#### Relations 审查

- `announcement`：`r.one.appAnnouncement({ from: r.appAnnouncementRead.announcementId, to: r.appAnnouncement.id, })`。from=`r.appAnnouncementRead.announcementId`，to=`r.appAnnouncement.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `user`：`r.one.appUser({ from: r.appAnnouncementRead.userId, to: r.appUser.id, })`。from=`r.appAnnouncementRead.userId`，to=`r.appUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### app_config（appConfig）

- Schema 文件：`db/schema/app/app-config.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/app.ts`
- 表注释：应用配置表 - 存储应用的基础配置信息
- 重点结论：闭集语义字段未使用 smallint。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `appName`：当前 `varchar({ length: 100 }).notNull()`。注释：应用名称。结论：保留。建议：维持当前定义。
- `appDesc`：当前 `varchar({ length: 500 })`。注释：应用描述。结论：保留。建议：维持当前定义。
- `appLogo`：当前 `varchar({ length: 500 })`。注释：应用Logo URL。结论：保留。建议：维持当前定义。
- `onboardingImage`：当前 `varchar({ length: 1000 })`。注释：引导页图片 URL。结论：保留。建议：维持当前定义。
- `themeColor`：当前 `varchar({ length: 20 }).default("#007AFF").notNull()`。注释：主题色。结论：保留。建议：维持当前定义。
- `secondaryColor`：当前 `varchar({ length: 20 })`。注释：第二主题色。结论：保留。建议：维持当前定义。
- `optionalThemeColors`：当前 `varchar({ length: 500 })`。注释：可选的主题色。结论：保留。建议：维持当前定义。
- `enableMaintenanceMode`：当前 `boolean().default(false).notNull()`。注释：是否启用维护模式。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `maintenanceMessage`：当前 `varchar({ length: 500 })`。注释：维护模式提示信息。结论：保留。建议：维持当前定义。
- `version`：当前 `varchar({ length: 50 }).default("1.0.0").notNull()`。注释：配置版本号。结论：保留。建议：维持当前定义。
- `updatedById`：当前 `integer()`。注释：最后修改人ID。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `index("app_config_updated_by_id_idx").on(table.updatedById)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `updatedBy`：`r.one.adminUser({ from: r.appConfig.updatedById, to: r.adminUser.id, alias: 'AppConfigUpdater', })`。from=`r.appConfig.updatedById`，to=`r.adminUser.id`，alias=`AppConfigUpdater` 结论：from/to 明确，属于单对象软关联。 alias=AppConfigUpdater，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### app_page（appPage）

- Schema 文件：`db/schema/app/app-page.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/app.ts`
- 表注释：应用页面表 - 管理应用内的页面配置和路由
- 重点结论：闭集语义字段未使用 smallint。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `code`：当前 `varchar({ length: 50 }).notNull()`。注释：页面代码（唯一标识）。结论：保留。建议：维持当前定义。
- `path`：当前 `varchar({ length: 300 }).notNull()`。注释：页面路径（唯一）。结论：保留。建议：维持当前定义。
- `name`：当前 `varchar({ length: 100 }).notNull()`。注释：页面名称。结论：保留。建议：维持当前定义。
- `title`：当前 `varchar({ length: 200 }).notNull()`。注释：页面标题。结论：保留。建议：维持当前定义。
- `description`：当前 `varchar({ length: 500 })`。注释：页面描述。结论：保留。建议：维持当前定义。
- `accessLevel`：当前 `smallint().default(0).notNull()`。注释：访问级别（0=游客, 1=登录, 2=会员, 3=高级会员）。结论：保留。建议：维持当前定义。
- `isEnabled`：当前 `boolean().default(true).notNull()`。注释：是否启用。结论：保留。建议：维持当前定义。
- `enablePlatform`：当前 `integer().array().default(sql\`ARRAY[1,2,3]::integer[]\`)`。注释：启用的平台列表（1=H5, 2=App, 3=小程序；默认值为全部平台）。结论：闭集语义字段未使用 smallint。建议：改为 `smallint().array()`，并在注释中写清每个数值的含义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("app_page_code_key").on(table.code)`：唯一性约束明确，字段类型调整后通常继续保留。
- `unique("app_page_path_key").on(table.path)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("app_page_access_level_is_enabled_idx").on(table.accessLevel, table.isEnabled)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `announcements`：`r.many.appAnnouncement({ from: r.appPage.id, to: r.appAnnouncement.pageId, alias: 'announcements', })`。from=`r.appPage.id`，to=`r.appAnnouncement.pageId`，alias=`announcements` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=announcements，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### app_update_release（appUpdateRelease）

- Schema 文件：`db/schema/app/app-update-release.ts`
- 风格来源：手工建模 / 新增表
- 对应 relations：`db/relations/app.ts`
- 表注释：App 更新发布表。 每个平台维护多条历史版本，只有一条可处于发布态。
- 重点结论：闭集语义字段未使用 smallint；长文本仍使用 varchar。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键 ID。。结论：保留。建议：维持当前定义。
- `platform`：当前 `varchar({ length: 20 }).notNull()`。注释：发布平台。 当前仅支持 ios / android。。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `versionName`：当前 `varchar({ length: 50 }).notNull()`。注释：展示版本号。 用于后台管理与客户端提示。。结论：保留。建议：维持当前定义。
- `buildCode`：当前 `integer().notNull()`。注释：内部构建号。 用于客户端更新比较，必须为正整数。。结论：保留。建议：维持当前定义。
- `releaseNotes`：当前 `varchar({ length: 5000 })`。注释：更新说明。。结论：长文本仍使用 varchar。建议：评估是否改为 `text()`，避免长文本被固定长度约束绑死。
- `forceUpdate`：当前 `boolean().default(false).notNull()`。注释：是否强制更新。。结论：保留。建议：维持当前定义。
- `packageSourceType`：当前 `varchar({ length: 20 })`。注释：安装包来源类型。 upload=后台上传，url=外部地址。。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `packageUrl`：当前 `varchar({ length: 1000 })`。注释：安装包地址。 upload 模式下可为本地 `/files/...` 或 CDN 绝对地址。。结论：保留。建议：维持当前定义。
- `packageOriginalName`：当前 `varchar({ length: 255 })`。注释：上传安装包原始文件名。。结论：保留。建议：维持当前定义。
- `packageFileSize`：当前 `integer()`。注释：上传安装包大小（字节）。。结论：保留。建议：维持当前定义。
- `packageMimeType`：当前 `varchar({ length: 100 })`。注释：上传安装包 MIME 类型。。结论：保留。建议：维持当前定义。
- `customDownloadUrl`：当前 `varchar({ length: 1000 })`。注释：自定义下载页地址。。结论：保留。建议：维持当前定义。
- `popupBackgroundImage`：当前 `varchar({ length: 255 })`。注释：更新弹窗背景图地址。 仅在客户端需要展示品牌化更新弹窗时使用。。结论：保留。建议：维持当前定义。
- `popupBackgroundPosition`：当前 `varchar({ length: 20 }).default('center')`。注释：更新弹窗背景图位置。 直接复用 CSS `background-position` 语义。。结论：保留。建议：维持当前定义。
- `storeLinks`：当前 `jsonb() .$type<AppUpdateStoreLinkValue[]>() .default(sql\`'[]'::jsonb\`) .notNull()`。注释：商店地址列表。 仅持久化渠道编码和商店地址，渠道名称由字典项动态回填。。结论：保留。建议：维持当前定义。
- `isPublished`：当前 `boolean().default(false).notNull()`。注释：是否已发布。。结论：保留。建议：维持当前定义。
- `publishedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：发布时间。。结论：保留。建议：维持当前定义。
- `createdById`：当前 `integer()`。注释：创建人 ID。。结论：保留。建议：维持当前定义。
- `updatedById`：当前 `integer()`。注释：更新人 ID。。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .defaultNow() .notNull()`。注释：创建时间。。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .$onUpdate(() => new Date()) .notNull()`。注释：更新时间。。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique('app_update_release_platform_build_code_key').on( table.platform, table.buildCode, )`：唯一性约束明确，字段类型调整后通常继续保留。
- `index('app_update_release_platform_is_published_build_code_idx').on( table.platform, table.isPublished, table.buildCode, )`：涉及待改 `smallint` 字段，索引语义可以保留，但生成语句要跟随字段类型一起调整。
- `index('app_update_release_published_at_idx').on(table.publishedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `check( 'app_update_release_build_code_positive_chk', sql\`${table.buildCode} > 0\`, )`：检查约束能表达业务边界，建议保留并补齐缺失字段。

#### Relations 审查

- `createdBy`：`r.one.adminUser({ from: r.appUpdateRelease.createdById, to: r.adminUser.id, alias: 'AppUpdateReleaseCreatedBy', })`。from=`r.appUpdateRelease.createdById`，to=`r.adminUser.id`，alias=`AppUpdateReleaseCreatedBy` 结论：from/to 明确，属于单对象软关联。 alias=AppUpdateReleaseCreatedBy，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `updatedBy`：`r.one.adminUser({ from: r.appUpdateRelease.updatedById, to: r.adminUser.id, alias: 'AppUpdateReleaseUpdatedBy', })`。from=`r.appUpdateRelease.updatedById`，to=`r.adminUser.id`，alias=`AppUpdateReleaseUpdatedBy` 结论：from/to 明确，属于单对象软关联。 alias=AppUpdateReleaseUpdatedBy，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### app_user（appUser）

- Schema 文件：`db/schema/app/app-user.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/app.ts`
- 表注释：应用用户表 存储应用端用户信息及其关联关系
- 重点结论：缺少显式数值边界约束；闭集语义字段未使用 smallint。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：用户ID。结论：保留。建议：维持当前定义。
- `account`：当前 `varchar({ length: 20 }).notNull()`。注释：账号（唯一）。结论：保留。建议：维持当前定义。
- `phoneNumber`：当前 `varchar({ length: 20 })`。注释：手机号（唯一）。结论：保留。建议：维持当前定义。
- `emailAddress`：当前 `varchar({ length: 255 })`。注释：邮箱（唯一）。结论：保留。建议：维持当前定义。
- `levelId`：当前 `integer()`。注释：等级ID。结论：保留。建议：维持当前定义。
- `nickname`：当前 `varchar({ length: 100 }).notNull()`。注释：昵称。结论：保留。建议：维持当前定义。
- `password`：当前 `varchar({ length: 500 }).notNull()`。注释：密码（加密存储）。结论：保留。建议：维持当前定义。
- `avatarUrl`：当前 `varchar({ length: 500 })`。注释：头像URL。结论：保留。建议：维持当前定义。
- `signature`：当前 `varchar({ length: 200 })`。注释：个性签名。结论：保留。建议：维持当前定义。
- `bio`：当前 `varchar({ length: 500 })`。注释：个人简介。结论：保留。建议：维持当前定义。
- `isEnabled`：当前 `boolean().default(true).notNull()`。注释：是否启用。结论：保留。建议：维持当前定义。
- `genderType`：当前 `smallint().default(0).notNull()`。注释：性别（0=未知，1=男，2=女）。结论：保留。建议：维持当前定义。
- `birthDate`：当前 `date()`。注释：出生日期。结论：保留。建议：维持当前定义。
- `points`：当前 `integer().default(0).notNull()`。注释：积分。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `experience`：当前 `integer().default(0).notNull()`。注释：经验值。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `status`：当前 `integer().default(1).notNull()`。注释：用户状态。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `banReason`：当前 `varchar({ length: 500 })`。注释：封禁原因。结论：保留。建议：维持当前定义。
- `banUntil`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：封禁到期时间。结论：保留。建议：维持当前定义。
- `lastLoginAt`：当前 `timestamp({ withTimezone: true })`。注释：最后登录时间。结论：保留。建议：维持当前定义。
- `lastLoginIp`：当前 `varchar({ length: 45 })`。注释：最后登录IP。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。
- `deletedAt`：当前 `timestamp({ withTimezone: true })`。注释：删除时间（软删除）。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("app_user_account_key").on(table.account)`：唯一性约束明确，字段类型调整后通常继续保留。
- `unique("app_user_phone_number_key").on(table.phoneNumber)`：唯一性约束明确，字段类型调整后通常继续保留。
- `unique("app_user_email_address_key").on(table.emailAddress)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("app_user_is_enabled_idx").on(table.isEnabled)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("app_user_gender_type_idx").on(table.genderType)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("app_user_created_at_idx").on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("app_user_last_login_at_idx").on(table.lastLoginAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("app_user_phone_number_idx").on(table.phoneNumber)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("app_user_email_address_idx").on(table.emailAddress)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("app_user_points_idx").on(table.points)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("app_user_status_idx").on(table.status)`：涉及待改 `smallint` 字段，索引语义可以保留，但生成语句要跟随字段类型一起调整。
- `index("app_user_level_id_idx").on(table.levelId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("app_user_deleted_at_idx").on(table.deletedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `agreementLogs`：`r.many.appAgreementLog()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `level`：`r.one.userLevelRule({ from: r.appUser.levelId, to: r.userLevelRule.id, })`。from=`r.appUser.levelId`，to=`r.userLevelRule.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `counts`：`r.one.appUserCount({ from: r.appUser.id, to: r.appUserCount.userId, })`。from=`r.appUser.id`，to=`r.appUserCount.userId` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `announcementReads`：`r.many.appAnnouncementRead()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `tokens`：`r.many.appUserToken()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `forumTopics`：`r.many.forumTopic({ from: r.appUser.id, to: r.forumTopic.userId, alias: 'UserTopics', })`。from=`r.appUser.id`，to=`r.forumTopic.userId`，alias=`UserTopics` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=UserTopics，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `lastCommentTopics`：`r.many.forumTopic({ from: r.appUser.id, to: r.forumTopic.lastCommentUserId, alias: 'UserLastCommentTopics', })`。from=`r.appUser.id`，to=`r.forumTopic.lastCommentUserId`，alias=`UserLastCommentTopics` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=UserLastCommentTopics，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `receivedNotifications`：`r.many.userNotification({ from: r.appUser.id, to: r.userNotification.receiverUserId, alias: 'UserNotificationReceiver', })`。from=`r.appUser.id`，to=`r.userNotification.receiverUserId`，alias=`UserNotificationReceiver` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=UserNotificationReceiver，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `notificationPreferences`：`r.many.notificationPreference({ from: r.appUser.id, to: r.notificationPreference.userId, alias: 'NotificationPreferenceUser', })`。from=`r.appUser.id`，to=`r.notificationPreference.userId`，alias=`NotificationPreferenceUser` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=NotificationPreferenceUser，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `notificationDeliveries`：`r.many.notificationDelivery({ from: r.appUser.id, to: r.notificationDelivery.receiverUserId, })`。from=`r.appUser.id`，to=`r.notificationDelivery.receiverUserId` 结论：many 关系方向显式，便于排查多对多和自关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `triggeredNotifications`：`r.many.userNotification({ from: r.appUser.id, to: r.userNotification.actorUserId, alias: 'UserNotificationActor', })`。from=`r.appUser.id`，to=`r.userNotification.actorUserId`，alias=`UserNotificationActor` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=UserNotificationActor，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `chatConversationMembers`：`r.many.chatConversationMember({ from: r.appUser.id, to: r.chatConversationMember.userId, alias: 'ChatConversationMemberUser', })`。from=`r.appUser.id`，to=`r.chatConversationMember.userId`，alias=`ChatConversationMemberUser` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=ChatConversationMemberUser，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `chatConversations`：`r.many.chatConversation({ from: r.appUser.id.through(r.chatConversationMember.userId), to: r.chatConversation.id.through( r.chatConversationMember.conversationId, ), alias: 'ChatConversationParticipants', })`。from=`r.appUser.id.through(r.chatConversationMember.userId)`，to=`r.chatConversation.id.through( r.chatConversationMember.conversationId, )`，alias=`ChatConversationParticipants` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=ChatConversationParticipants，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `sentChatMessages`：`r.many.chatMessage({ from: r.appUser.id, to: r.chatMessage.senderId, alias: 'ChatMessageSender', })`。from=`r.appUser.id`，to=`r.chatMessage.senderId`，alias=`ChatMessageSender` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=ChatMessageSender，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `lastSentConversations`：`r.many.chatConversation({ from: r.appUser.id, to: r.chatConversation.lastSenderId, alias: 'ChatConversationLastSender', })`。from=`r.appUser.id`，to=`r.chatConversation.lastSenderId`，alias=`ChatConversationLastSender` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=ChatConversationLastSender，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `moderatorApplications`：`r.many.forumModeratorApplication({ from: r.appUser.id, to: r.forumModeratorApplication.applicantId, alias: 'ModeratorApplicant', })`。from=`r.appUser.id`，to=`r.forumModeratorApplication.applicantId`，alias=`ModeratorApplicant` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=ModeratorApplicant，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `auditedApplications`：`r.many.forumModeratorApplication({ from: r.appUser.id, to: r.forumModeratorApplication.auditById, alias: 'ModeratorAuditor', })`。from=`r.appUser.id`，to=`r.forumModeratorApplication.auditById`，alias=`ModeratorAuditor` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=ModeratorAuditor，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `moderator`：`r.one.forumModerator({ from: r.appUser.id, to: r.forumModerator.userId, })`。from=`r.appUser.id`，to=`r.forumModerator.userId` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `forumActionLogs`：`r.many.forumUserActionLog({ from: r.appUser.id, to: r.forumUserActionLog.userId, })`。from=`r.appUser.id`，to=`r.forumUserActionLog.userId` 结论：many 关系方向显式，便于排查多对多和自关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `badgeAssignments`：`r.many.userBadgeAssignment()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `badges`：`r.many.userBadge({ from: r.appUser.id.through(r.userBadgeAssignment.userId), to: r.userBadge.id.through(r.userBadgeAssignment.badgeId), })`。from=`r.appUser.id.through(r.userBadgeAssignment.userId)`，to=`r.userBadge.id.through(r.userBadgeAssignment.badgeId)` 结论：many 关系方向显式，便于排查多对多和自关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `growthLedgerRecords`：`r.many.growthLedgerRecord()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `growthAuditLogs`：`r.many.growthAuditLog()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `growthRuleUsageSlots`：`r.many.growthRuleUsageSlot()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `checkInCycles`：`r.many.checkInCycle()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `checkInRecords`：`r.many.checkInRecord()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `checkInStreakRewardGrants`：`r.many.checkInStreakRewardGrant()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `taskAssignments`：`r.many.taskAssignment()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `taskProgressLogs`：`r.many.taskProgressLog()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `userLikes`：`r.many.userLike()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `userFavorites`：`r.many.userFavorite()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `browseLogs`：`r.many.userBrowseLog()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `workReadingStates`：`r.many.userWorkReadingState()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `userComments`：`r.many.userComment()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `userReports`：`r.many.userReport({ from: r.appUser.id, to: r.userReport.reporterId, alias: 'UserReportReporter', })`。from=`r.appUser.id`，to=`r.userReport.reporterId`，alias=`UserReportReporter` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=UserReportReporter，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `handledUserReports`：`r.many.userReport({ from: r.appUser.id, to: r.userReport.handlerId, alias: 'UserReportHandler', })`。from=`r.appUser.id`，to=`r.userReport.handlerId`，alias=`UserReportHandler` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=UserReportHandler，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `userDownloadRecords`：`r.many.userDownloadRecord()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `userPurchaseRecords`：`r.many.userPurchaseRecord()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `emojiRecentUsageRecords`：`r.many.emojiRecentUsage()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### app_user_count（appUserCount）

- Schema 文件：`db/schema/app/app-user-count.ts`
- 风格来源：手工建模 / 新增表
- 对应 relations：`db/relations/app.ts`
- 表注释：应用用户计数表 承载高频读取的用户聚合读模型字段
- 重点结论：缺少显式数值边界约束。

#### 字段审查

- `userId`：当前 `integer().primaryKey().notNull()`。注释：用户 ID，同时作为一对一主键。结论：保留。建议：维持当前定义。
- `commentCount`：当前 `integer().default(0).notNull()`。注释：发出的评论总数。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `likeCount`：当前 `integer().default(0).notNull()`。注释：发出的点赞总数。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `favoriteCount`：当前 `integer().default(0).notNull()`。注释：发出的收藏总数。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `followingUserCount`：当前 `integer().default(0).notNull()`。注释：关注用户总数 基于 user_follow 事实表中 targetType=1 的记录可重建。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `followingAuthorCount`：当前 `integer().default(0).notNull()`。注释：关注作者总数 基于 user_follow 事实表中 targetType=2 的记录可重建。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `followingSectionCount`：当前 `integer().default(0).notNull()`。注释：关注论坛板块总数 基于 user_follow 事实表中 targetType=3 的记录可重建。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `followersCount`：当前 `integer().default(0).notNull()`。注释：被关注总数 当前仅统计其他用户对本用户的关注。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `forumTopicCount`：当前 `integer().default(0).notNull()`。注释：发布的论坛主题总数。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `commentReceivedLikeCount`：当前 `integer().default(0).notNull()`。注释：评论收到的点赞总数。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `forumTopicReceivedLikeCount`：当前 `integer().default(0).notNull()`。注释：论坛主题收到的点赞总数。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `forumTopicReceivedFavoriteCount`：当前 `integer().default(0).notNull()`。注释：论坛主题收到的收藏总数。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .defaultNow() .notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .$onUpdate(() => new Date()) .notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- 当前未声明额外索引或约束。建议：结合查询路径和字段语义补齐必要的 `index` / `unique` / `check`。

#### Relations 审查

- `user`：`r.one.appUser({ from: r.appUserCount.userId, to: r.appUser.id, })`。from=`r.appUserCount.userId`，to=`r.appUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### app_user_token（appUserToken）

- Schema 文件：`db/schema/app/app-user-token.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/app.ts`
- 表注释：应用用户令牌表 - 用于存储用户的 JWT Token，支持多设备登录管理和 Token 撤销
- 重点结论：闭集语义字段未使用 smallint。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：令牌ID。结论：保留。建议：维持当前定义。
- `jti`：当前 `varchar({ length: 255 }).notNull()`。注释：JWT Token ID（唯一标识，用于黑名单和撤销）。结论：保留。建议：维持当前定义。
- `userId`：当前 `integer().notNull()`。注释：用户ID。结论：保留。建议：维持当前定义。
- `tokenType`：当前 `varchar({ length: 20 }).notNull()`。注释：令牌类型（ACCESS:访问令牌, REFRESH:刷新令牌）。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `expiresAt`：当前 `timestamp({ withTimezone: true }).notNull()`。注释：令牌过期时间。结论：保留。建议：维持当前定义。
- `revokedAt`：当前 `timestamp({ withTimezone: true })`。注释：令牌撤销时间（null表示未撤销）。结论：保留。建议：维持当前定义。
- `revokeReason`：当前 `varchar({ length: 50 })`。注释：撤销原因（PASSWORD_CHANGE:密码修改, USER_LOGOUT:用户退出, ADMIN_REVOKE:管理员撤销, SECURITY:安全原因）。结论：保留。建议：维持当前定义。
- `deviceInfo`：当前 `jsonb()`。注释：设备信息（JSON格式，包含设备类型、操作系统、浏览器等）。结论：保留。建议：维持当前定义。
- `ipAddress`：当前 `varchar({ length: 45 })`。注释：IP地址。结论：保留。建议：维持当前定义。
- `userAgent`：当前 `varchar({ length: 500 })`。注释：用户代理。结论：保留。建议：维持当前定义。
- `geoCountry`：当前 `varchar({ length: 100 })`。注释：登录态创建时解析到的国家/地区 仅记录新写入 token 的属地快照，无法解析或历史记录时为空。结论：保留。建议：维持当前定义。
- `geoProvince`：当前 `varchar({ length: 100 })`。注释：登录态创建时解析到的省份/州 仅记录新写入 token 的属地快照，无法解析或历史记录时为空。结论：保留。建议：维持当前定义。
- `geoCity`：当前 `varchar({ length: 100 })`。注释：登录态创建时解析到的城市 仅记录新写入 token 的属地快照，无法解析或历史记录时为空。结论：保留。建议：维持当前定义。
- `geoIsp`：当前 `varchar({ length: 100 })`。注释：登录态创建时解析到的网络运营商 仅记录新写入 token 的属地快照，无法解析或历史记录时为空。结论：保留。建议：维持当前定义。
- `geoSource`：当前 `varchar({ length: 50 })`。注释：属地解析来源 当前固定为 ip2region；历史记录或未补齐属地快照时为空。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `createdAt`：当前 `timestamp({ withTimezone: true }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("app_user_token_jti_key").on(table.jti)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("app_user_token_user_id_idx").on(table.userId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("app_user_token_jti_idx").on(table.jti)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("app_user_token_token_type_idx").on(table.tokenType)`：涉及待改 `smallint` 字段，索引语义可以保留，但生成语句要跟随字段类型一起调整。
- `index("app_user_token_expires_at_idx").on(table.expiresAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("app_user_token_revoked_at_idx").on(table.revokedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("app_user_token_user_id_token_type_idx").on(table.userId, table.tokenType)`：涉及待改 `smallint` 字段，索引语义可以保留，但生成语句要跟随字段类型一起调整。

#### Relations 审查

- `user`：`r.one.appUser({ from: r.appUserToken.userId, to: r.appUser.id })`。from=`r.appUserToken.userId`，to=`r.appUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### check_in_cycle（checkInCycle）

- Schema 文件：`db/schema/app/check-in-cycle.ts`
- 风格来源：手工建模 / 新增表
- 对应 relations：`db/relations/app.ts`
- 表注释：用户签到周期实例。 每条记录表示某个用户在某个签到计划下、某个周期切片中的聚合运行态， 仅保存进度摘要，不再冻结计划快照。
- 重点结论：当前未发现高优先级结构问题。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：周期实例主键。。结论：保留。建议：维持当前定义。
- `userId`：当前 `integer().notNull()`。注释：周期归属用户 ID。。结论：保留。建议：维持当前定义。
- `planId`：当前 `integer().notNull()`。注释：周期归属计划 ID。。结论：保留。建议：维持当前定义。
- `cycleKey`：当前 `varchar({ length: 32 }).notNull()`。注释：周期实例键。。结论：保留。建议：维持当前定义。
- `cycleStartDate`：当前 `date().notNull()`。注释：周期开始日期。。结论：保留。建议：维持当前定义。
- `cycleEndDate`：当前 `date().notNull()`。注释：周期结束日期。。结论：保留。建议：维持当前定义。
- `signedCount`：当前 `integer().default(0).notNull()`。注释：当前周期已签天数。。结论：保留。建议：维持当前定义。
- `makeupUsedCount`：当前 `integer().default(0).notNull()`。注释：当前周期已使用补签次数。。结论：保留。建议：维持当前定义。
- `currentStreak`：当前 `integer().default(0).notNull()`。注释：当前周期连续签到天数。。结论：保留。建议：维持当前定义。
- `lastSignedDate`：当前 `date()`。注释：最近一次有效签到日期。。结论：保留。建议：维持当前定义。
- `version`：当前 `integer().default(0).notNull()`。注释：周期乐观锁版本号。。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：周期创建时间。。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：周期最近更新时间。。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique('check_in_cycle_user_plan_cycle_key_key').on( table.userId, table.planId, table.cycleKey, )`：唯一性约束明确，字段类型调整后通常继续保留。
- `index('check_in_cycle_user_id_plan_id_idx').on(table.userId, table.planId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('check_in_cycle_cycle_start_date_idx').on(table.cycleStartDate)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('check_in_cycle_cycle_end_date_idx').on(table.cycleEndDate)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `check('check_in_cycle_signed_count_non_negative_chk', sql\`${table.signedCount} >= 0\`)`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check( 'check_in_cycle_makeup_used_count_non_negative_chk', sql\`${table.makeupUsedCount} >= 0\`, )`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check( 'check_in_cycle_current_streak_non_negative_chk', sql\`${table.currentStreak} >= 0\`, )`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check('check_in_cycle_version_non_negative_chk', sql\`${table.version} >= 0\`)`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check( 'check_in_cycle_last_signed_date_in_cycle_chk', sql\`${table.lastSignedDate} is null or (${table.lastSignedDate} >= ${table.cycleStartDate} and ${table.lastSignedDate} <= ${table.cycleEndDate})\`, )`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check( 'check_in_cycle_current_streak_not_gt_signed_count_chk', sql\`${table.currentStreak} <= ${table.signedCount}\`, )`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check( 'check_in_cycle_makeup_used_count_not_gt_signed_count_chk', sql\`${table.makeupUsedCount} <= ${table.signedCount}\`, )`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check( 'check_in_cycle_signed_count_not_gt_cycle_days_chk', sql\`${table.signedCount} <= (${table.cycleEndDate} - ${table.cycleStartDate} + 1)\`, )`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check( 'check_in_cycle_date_range_valid_chk', sql\`${table.cycleEndDate} >= ${table.cycleStartDate}\`, )`：检查约束能表达业务边界，建议保留并补齐缺失字段。

#### Relations 审查

- `user`：`r.one.appUser({ from: r.checkInCycle.userId, to: r.appUser.id, })`。from=`r.checkInCycle.userId`，to=`r.appUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `plan`：`r.one.checkInPlan({ from: r.checkInCycle.planId, to: r.checkInPlan.id, })`。from=`r.checkInCycle.planId`，to=`r.checkInPlan.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `records`：`r.many.checkInRecord()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `streakGrants`：`r.many.checkInStreakRewardGrant()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### check_in_plan（checkInPlan）

- Schema 文件：`db/schema/app/check-in-plan.ts`
- 风格来源：手工建模 / 新增表
- 对应 relations：`db/relations/app.ts`
- 表注释：签到计划定义。 承载签到计划本身的运营配置，不直接记录用户签到事实；用户周期、签到记录和 连续奖励发放分别由 `check_in_cycle`、`check_in_record` 和 `check_in_streak_reward_grant` 保存。
- 重点结论：smallint 字段注释未写清数值含义；闭集语义字段未使用 smallint。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：签到计划主键。。结论：保留。建议：维持当前定义。
- `planCode`：当前 `varchar({ length: 50 }).notNull()`。注释：签到计划稳定编码。。结论：保留。建议：维持当前定义。
- `planName`：当前 `varchar({ length: 200 }).notNull()`。注释：签到计划名称。。结论：保留。建议：维持当前定义。
- `status`：当前 `smallint().default(0).notNull()`。注释：计划状态。。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `cycleType`：当前 `varchar({ length: 16 }).notNull()`。注释：周期类型。。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `startDate`：当前 `date().notNull()`。注释：计划开始日期。。结论：保留。建议：维持当前定义。
- `allowMakeupCountPerCycle`：当前 `integer().default(0).notNull()`。注释：每周期可补签次数。。结论：保留。建议：维持当前定义。
- `rewardDefinition`：当前 `jsonb()`。注释：当前生效中的奖励定义。 保存默认基础奖励、具体日期奖励、周期模式奖励和连续奖励规则的单份定义。。结论：保留。建议：维持当前定义。
- `endDate`：当前 `date()`。注释：计划结束日期。。结论：保留。建议：维持当前定义。
- `createdById`：当前 `integer()`。注释：创建人 ID。。结论：保留。建议：维持当前定义。
- `updatedById`：当前 `integer()`。注释：更新人 ID。。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：计划创建时间。。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：计划最近更新时间。。结论：保留。建议：维持当前定义。
- `deletedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：软删除时间。。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique('check_in_plan_plan_code_key').on(table.planCode)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index('check_in_plan_status_idx').on(table.status)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('check_in_plan_start_date_idx').on(table.startDate)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('check_in_plan_end_date_idx').on(table.endDate)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('check_in_plan_deleted_at_idx').on(table.deletedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `check( 'check_in_plan_allow_makeup_non_negative_chk', sql\`${table.allowMakeupCountPerCycle} >= 0\`, )`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check( 'check_in_plan_status_valid_chk', sql\`${table.status} in (0, 1, 2, 3)\`, )`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check( 'check_in_plan_cycle_type_valid_chk', sql\`${table.cycleType} in ('weekly', 'monthly')\`, )`：对应字段改为 `smallint`后，需要把当前`check` 约束同步改写为数值枚举约束。
- `check( 'check_in_plan_date_range_valid_chk', sql\`${table.endDate} is null or ${table.endDate} >= ${table.startDate}\`, )`：检查约束能表达业务边界，建议保留并补齐缺失字段。

#### Relations 审查

- `cycles`：`r.many.checkInCycle()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `records`：`r.many.checkInRecord()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `streakGrants`：`r.many.checkInStreakRewardGrant()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `createdBy`：`r.one.adminUser({ from: r.checkInPlan.createdById, to: r.adminUser.id, alias: 'CheckInPlanCreatedBy', })`。from=`r.checkInPlan.createdById`，to=`r.adminUser.id`，alias=`CheckInPlanCreatedBy` 结论：from/to 明确，属于单对象软关联。 alias=CheckInPlanCreatedBy，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `updatedBy`：`r.one.adminUser({ from: r.checkInPlan.updatedById, to: r.adminUser.id, alias: 'CheckInPlanUpdatedBy', })`。from=`r.checkInPlan.updatedById`，to=`r.adminUser.id`，alias=`CheckInPlanUpdatedBy` 结论：from/to 明确，属于单对象软关联。 alias=CheckInPlanUpdatedBy，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### check_in_record（checkInRecord）

- Schema 文件：`db/schema/app/check-in-record.ts`
- 风格来源：手工建模 / 新增表
- 对应 relations：`db/relations/app.ts`
- 表注释：每日签到事实。 同一用户在同一计划、同一自然日只能拥有一条有效签到记录；补签不会生成 第二条同日事实，而是以 `recordType` 标记本次事实来源。
- 重点结论：smallint 字段注释未写清数值含义；闭集语义字段未使用 smallint。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：签到记录主键。。结论：保留。建议：维持当前定义。
- `userId`：当前 `integer().notNull()`。注释：记录归属用户 ID。。结论：保留。建议：维持当前定义。
- `planId`：当前 `integer().notNull()`。注释：记录归属计划 ID。。结论：保留。建议：维持当前定义。
- `cycleId`：当前 `integer().notNull()`。注释：记录归属周期 ID。。结论：保留。建议：维持当前定义。
- `signDate`：当前 `date().notNull()`。注释：签到自然日。。结论：保留。建议：维持当前定义。
- `recordType`：当前 `smallint().notNull()`。注释：签到类型。。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `rewardStatus`：当前 `smallint()`。注释：基础签到奖励状态。。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `rewardResultType`：当前 `smallint()`。注释：基础签到奖励结果类型。。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `resolvedRewardSourceType`：当前 `varchar({ length: 32 })`。注释：本次基础奖励解析来源。。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `resolvedRewardRuleKey`：当前 `varchar({ length: 32 })`。注释：本次基础奖励命中的规则键。 `null` 表示默认基础奖励；日期/模式奖励分别使用稳定字符串键。。结论：保留。建议：维持当前定义。
- `resolvedRewardConfig`：当前 `jsonb()`。注释：本次基础奖励解析结果快照。。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `bizKey`：当前 `varchar({ length: 180 }).notNull()`。注释：业务幂等键。。结论：保留。建议：维持当前定义。
- `baseRewardLedgerIds`：当前 `integer().array().default(sql\`ARRAY[]::integer[]\`).notNull()`。注释：基础奖励对应到账本记录 ID 列表。。结论：保留。建议：维持当前定义。
- `operatorType`：当前 `smallint().notNull()`。注释：操作来源类型。。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `remark`：当前 `varchar({ length: 500 })`。注释：备注。。结论：保留。建议：维持当前定义。
- `lastRewardError`：当前 `varchar({ length: 500 })`。注释：最近一次基础奖励失败原因。。结论：保留。建议：维持当前定义。
- `context`：当前 `jsonb()`。注释：签到扩展上下文。。结论：保留。建议：维持当前定义。
- `rewardSettledAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：最近一次基础奖励状态落定时间。。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：签到事实创建时间。。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：签到记录最近更新时间。。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique('check_in_record_user_plan_sign_date_key').on( table.userId, table.planId, table.signDate, )`：唯一性约束明确，字段类型调整后通常继续保留。
- `unique('check_in_record_user_biz_key_key').on(table.userId, table.bizKey)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index('check_in_record_cycle_id_idx').on(table.cycleId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('check_in_record_user_id_plan_id_idx').on(table.userId, table.planId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('check_in_record_sign_date_idx').on(table.signDate)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('check_in_record_reward_status_idx').on(table.rewardStatus)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `check( 'check_in_record_record_type_valid_chk', sql\`${table.recordType} in (1, 2)\`, )`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check( 'check_in_record_reward_status_valid_chk', sql\`${table.rewardStatus} is null or ${table.rewardStatus} in (0, 1, 2)\`, )`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check( 'check_in_record_reward_result_type_valid_chk', sql\`${table.rewardResultType} is null or ${table.rewardResultType} in (1, 2, 3)\`, )`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check( 'check_in_record_operator_type_valid_chk', sql\`${table.operatorType} in (1, 2, 3)\`, )`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check( 'check_in_record_reward_source_type_valid_chk', sql\`${table.resolvedRewardSourceType} is null or ${table.resolvedRewardSourceType} in ('BASE_REWARD', 'DATE_RULE', 'PATTERN_RULE')\`, )`：对应字段改为 `smallint`后，需要把当前`check` 约束同步改写为数值枚举约束。
- `check( 'check_in_record_reward_state_consistent_chk', sql\`( ${table.rewardStatus} is null and ${table.rewardResultType} is null and ${table.rewardSettledAt} is null ) or ( ${table.rewardStatus} = 0 and ${table.rewardResultType} is null and ${table.rewardSettledAt} is null ) or ( ${table.rewardStatus} = 1 and ${table.rewardResultType} in (1, 2) and ${table.rewardSettledAt} is not null ) or ( ${table.rewardStatus} = 2 and ${table.rewardResultType} = 3 and ${table.rewardSettledAt} is not null )\`, )`：对应字段改为 `smallint`后，需要把当前`check` 约束同步改写为数值枚举约束。
- `check( 'check_in_record_reward_resolution_consistent_chk', sql\`( ${table.rewardStatus} is null and ${table.resolvedRewardSourceType} is null and ${table.resolvedRewardRuleKey} is null and ${table.resolvedRewardConfig} is null ) or ( ${table.rewardStatus} in (0, 1, 2) and ${table.resolvedRewardSourceType} in ('BASE_REWARD', 'DATE_RULE', 'PATTERN_RULE') and ${table.resolvedRewardConfig} is not null )\`, )`：对应字段改为 `smallint`后，需要把当前`check` 约束同步改写为数值枚举约束。

#### Relations 审查

- `user`：`r.one.appUser({ from: r.checkInRecord.userId, to: r.appUser.id, })`。from=`r.checkInRecord.userId`，to=`r.appUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `plan`：`r.one.checkInPlan({ from: r.checkInRecord.planId, to: r.checkInPlan.id, })`。from=`r.checkInRecord.planId`，to=`r.checkInPlan.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `cycle`：`r.one.checkInCycle({ from: r.checkInRecord.cycleId, to: r.checkInCycle.id, })`。from=`r.checkInRecord.cycleId`，to=`r.checkInCycle.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### check_in_streak_reward_grant（checkInStreakRewardGrant）

- Schema 文件：`db/schema/app/check-in-streak-reward-grant.ts`
- 风格来源：手工建模 / 新增表
- 对应 relations：`db/relations/app.ts`
- 表注释：连续签到奖励发放事实。 当某次签到或补签重算后命中连续奖励阈值时，会创建对应发放事实并独立结算到账本。
- 重点结论：smallint 字段注释未写清数值含义；闭集语义字段未使用 smallint。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：连续奖励发放事实主键。。结论：保留。建议：维持当前定义。
- `userId`：当前 `integer().notNull()`。注释：发放归属用户 ID。。结论：保留。建议：维持当前定义。
- `planId`：当前 `integer().notNull()`。注释：发放归属计划 ID。。结论：保留。建议：维持当前定义。
- `cycleId`：当前 `integer().notNull()`。注释：发放归属周期 ID。。结论：保留。建议：维持当前定义。
- `ruleCode`：当前 `varchar({ length: 50 }).notNull()`。注释：命中的规则编码。。结论：保留。建议：维持当前定义。
- `streakDays`：当前 `integer().notNull()`。注释：命中的连续签到阈值。。结论：保留。建议：维持当前定义。
- `rewardConfig`：当前 `jsonb().notNull()`。注释：连续奖励配置快照。。结论：保留。建议：维持当前定义。
- `repeatable`：当前 `boolean().default(false).notNull()`。注释：是否允许重复发放。。结论：保留。建议：维持当前定义。
- `triggerSignDate`：当前 `date().notNull()`。注释：触发本次连续奖励的签到日期。。结论：保留。建议：维持当前定义。
- `grantStatus`：当前 `smallint().default(0).notNull()`。注释：连续奖励发放状态。。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `grantResultType`：当前 `smallint()`。注释：连续奖励发放结果类型。。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `bizKey`：当前 `varchar({ length: 200 }).notNull()`。注释：业务幂等键。。结论：保留。建议：维持当前定义。
- `ledgerIds`：当前 `integer().array().default(sql\`ARRAY[]::integer[]\`).notNull()`。注释：连续奖励到账本记录 ID 列表。。结论：保留。建议：维持当前定义。
- `lastGrantError`：当前 `varchar({ length: 500 })`。注释：最近一次连续奖励失败原因。。结论：保留。建议：维持当前定义。
- `context`：当前 `jsonb()`。注释：发放扩展上下文。。结论：保留。建议：维持当前定义。
- `grantSettledAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：最近一次发放状态落定时间。。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：发放事实创建时间。。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：发放事实最近更新时间。。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique('check_in_streak_grant_user_biz_key_key').on( table.userId, table.bizKey, )`：唯一性约束明确，字段类型调整后通常继续保留。
- `index('check_in_streak_grant_cycle_id_idx').on(table.cycleId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('check_in_streak_grant_user_id_plan_id_idx').on( table.userId, table.planId, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('check_in_streak_grant_rule_code_idx').on(table.ruleCode)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('check_in_streak_grant_trigger_sign_date_idx').on(table.triggerSignDate)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('check_in_streak_grant_status_idx').on(table.grantStatus)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `check( 'check_in_streak_grant_status_valid_chk', sql\`${table.grantStatus} in (0, 1, 2)\`, )`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check( 'check_in_streak_grant_result_type_valid_chk', sql\`${table.grantResultType} is null or ${table.grantResultType} in (1, 2, 3)\`, )`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check( 'check_in_streak_grant_state_consistent_chk', sql\`( ${table.grantStatus} = 0 and ${table.grantResultType} is null and ${table.grantSettledAt} is null ) or ( ${table.grantStatus} = 1 and ${table.grantResultType} in (1, 2) and ${table.grantSettledAt} is not null ) or ( ${table.grantStatus} = 2 and ${table.grantResultType} = 3 and ${table.grantSettledAt} is not null )\`, )`：对应字段改为 `smallint`后，需要把当前`check` 约束同步改写为数值枚举约束。
- `check( 'check_in_streak_grant_streak_days_positive_chk', sql\`${table.streakDays} > 0\`, )`：检查约束能表达业务边界，建议保留并补齐缺失字段。

#### Relations 审查

- `user`：`r.one.appUser({ from: r.checkInStreakRewardGrant.userId, to: r.appUser.id, })`。from=`r.checkInStreakRewardGrant.userId`，to=`r.appUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `plan`：`r.one.checkInPlan({ from: r.checkInStreakRewardGrant.planId, to: r.checkInPlan.id, })`。from=`r.checkInStreakRewardGrant.planId`，to=`r.checkInPlan.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `cycle`：`r.one.checkInCycle({ from: r.checkInStreakRewardGrant.cycleId, to: r.checkInCycle.id, })`。from=`r.checkInStreakRewardGrant.cycleId`，to=`r.checkInCycle.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### emoji_asset（emojiAsset）

- Schema 文件：`db/schema/app/emoji-asset.ts`
- 风格来源：手工建模 / 新增表
- 对应 relations：`db/relations/app.ts`
- 表注释：表情资源表。 - 存储每一个可渲染表情条目（unicode/custom）。 - 通过 packId 归属到具体表情包。
- 重点结论：当前未发现高优先级结构问题。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键 ID（自增）。 - 作为表情资源的唯一标识。。结论：保留。建议：维持当前定义。
- `packId`：当前 `integer().notNull()`。注释：所属表情包 ID。 - 关联 emoji_pack.id。。结论：保留。建议：维持当前定义。
- `kind`：当前 `smallint().notNull()`。注释：资源类型。 - 1=unicode（系统字符） - 2=custom（自定义图片）。结论：保留。建议：维持当前定义。
- `shortcode`：当前 `varchar({ length: 32 })`。注释：短码。 - custom 表情必填。 - 用于 `:smile:` 这类解析与检索。。结论：保留。建议：维持当前定义。
- `unicodeSequence`：当前 `varchar({ length: 191 })`。注释：Unicode 序列。 - unicode 表情必填。 - 例如 😀 或组合序列。。结论：保留。建议：维持当前定义。
- `imageUrl`：当前 `varchar({ length: 500 })`。注释：主资源 URL。 - custom 表情必填。 - 可指向 gif/webp/png 等可展示资源。。结论：保留。建议：维持当前定义。
- `staticUrl`：当前 `varchar({ length: 500 })`。注释：静态资源 URL。 - 可选字段，常用于动图降级静态图。。结论：保留。建议：维持当前定义。
- `isAnimated`：当前 `boolean().default(false).notNull()`。注释：是否为动图。 - 用于客户端播放策略与渲染逻辑判断。。结论：保留。建议：维持当前定义。
- `category`：当前 `varchar({ length: 32 })`。注释：分类标签。 - 用于筛选、分组展示（如 people/animals）。。结论：保留。建议：维持当前定义。
- `keywords`：当前 `jsonb()`。注释：多语言关键词 JSON。 - 典型结构：{"zh-CN":["微笑"],"en-US":["smile"]}。。结论：保留。建议：维持当前定义。
- `sortOrder`：当前 `integer().default(0).notNull()`。注释：排序值。 - 在同一个表情包内按值升序展示。。结论：保留。建议：维持当前定义。
- `isEnabled`：当前 `boolean().default(true).notNull()`。注释：启用状态。 - false 时该资源不参与目录、搜索与解析。。结论：保留。建议：维持当前定义。
- `createdById`：当前 `integer()`。注释：创建人后台用户 ID。。结论：保留。建议：维持当前定义。
- `updatedById`：当前 `integer()`。注释：最后更新人后台用户 ID。。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间（UTC）。。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间（UTC）。 - 每次更新时自动刷新。。结论：保留。建议：维持当前定义。
- `deletedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：软删除时间（UTC）。。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `index('emoji_asset_pack_id_sort_order_idx').on( table.packId, table.sortOrder, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('emoji_asset_pack_id_is_enabled_deleted_at_sort_order_idx').on( table.packId, table.isEnabled, table.deletedAt, table.sortOrder, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('emoji_asset_kind_idx').on(table.kind)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('emoji_asset_category_idx').on(table.category)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('emoji_asset_deleted_at_idx').on(table.deletedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `uniqueIndex('emoji_asset_shortcode_live_key') .on(table.shortcode) .where(sql\`${table.shortcode} is not null and ${table.deletedAt} is null\`)`：唯一性约束明确，字段类型调整后通常继续保留。
- `check('emoji_asset_kind_chk', sql\`${table.kind} in (1, 2)\`)`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check( 'emoji_asset_kind_unicode_required_chk', sql\`(${table.kind} <> 1) or (${table.unicodeSequence} is not null)\`, )`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check( 'emoji_asset_kind_custom_required_chk', sql\`(${table.kind} <> 2) or (${table.shortcode} is not null and ${table.imageUrl} is not null)\`, )`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check( 'emoji_asset_shortcode_format_chk', sql\`${table.shortcode} is null or ${table.shortcode} ~ '^[a-z0-9_]{2,32}$'\`, )`：检查约束能表达业务边界，建议保留并补齐缺失字段。

#### Relations 审查

- `pack`：`r.one.emojiPack({ from: r.emojiAsset.packId, to: r.emojiPack.id, })`。from=`r.emojiAsset.packId`，to=`r.emojiPack.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `recentUsageRecords`：`r.many.emojiRecentUsage()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### emoji_pack（emojiPack）

- Schema 文件：`db/schema/app/emoji-pack.ts`
- 风格来源：手工建模 / 新增表
- 对应 relations：`db/relations/app.ts`
- 表注释：表情包主表。 - 管理表情包基础信息、展示排序与可见场景。 - sceneType 使用 smallint[] 存储支持场景集合，当前取值：1(chat)/2(comment)/3(forum)。
- 重点结论：smallint 字段注释未写清数值含义。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键 ID（自增）。 - 作为表情包的唯一标识。。结论：保留。建议：维持当前定义。
- `code`：当前 `varchar({ length: 64 }).notNull()`。注释：表情包业务编码。 - 用于程序内稳定引用，要求全局唯一。 - 典型值：default、animals、meme。。结论：保留。建议：维持当前定义。
- `name`：当前 `varchar({ length: 100 }).notNull()`。注释：表情包名称。 - 用于管理端与客户端展示。。结论：保留。建议：维持当前定义。
- `description`：当前 `varchar({ length: 500 })`。注释：表情包描述。 - 可选字段，用于补充包的来源、用途或说明信息。。结论：保留。建议：维持当前定义。
- `iconUrl`：当前 `varchar({ length: 500 })`。注释：表情包图标 URL。 - 在客户端选择器中展示分组图标。。结论：保留。建议：维持当前定义。
- `sortOrder`：当前 `integer().default(0).notNull()`。注释：排序值。 - 值越小越靠前。 - 同值时以 id 作为次序兜底。。结论：保留。建议：维持当前定义。
- `isEnabled`：当前 `boolean().default(true).notNull()`。注释：启用状态。 - false 时该表情包整体不可用。。结论：保留。建议：维持当前定义。
- `visibleInPicker`：当前 `boolean().default(true).notNull()`。注释：是否在选择器可见。 - false 时允许业务侧保留数据，但不在常规选择器展示。。结论：保留。建议：维持当前定义。
- `sceneType`：当前 `smallint().array().default(sql\`ARRAY[1,2,3]::smallint[]\`).notNull()`。注释：场景集合。 - 使用 smallint[] 存储生效场景。 - 默认对 chat/comment/forum 全场景可见。。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `createdById`：当前 `integer()`。注释：创建人后台用户 ID。 - 为空表示历史数据或未记录来源。。结论：保留。建议：维持当前定义。
- `updatedById`：当前 `integer()`。注释：最后更新人后台用户 ID。 - 为空表示历史数据或未记录来源。。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间（UTC）。 - 默认写入当前数据库时间。。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间（UTC）。 - 每次更新记录时自动刷新。。结论：保留。建议：维持当前定义。
- `deletedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：软删除时间（UTC）。 - 非空表示该记录已逻辑删除。。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique('emoji_pack_code_key').on(table.code)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index('emoji_pack_is_enabled_idx').on(table.isEnabled)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('emoji_pack_sort_order_idx').on(table.sortOrder)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('emoji_pack_deleted_at_idx').on(table.deletedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('emoji_pack_scene_type_idx').using('gin', table.sceneType)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('emoji_pack_is_enabled_deleted_at_idx').on( table.isEnabled, table.deletedAt, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('emoji_pack_is_enabled_deleted_at_sort_order_idx').on( table.isEnabled, table.deletedAt, table.sortOrder, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `check( 'emoji_pack_scene_type_valid_chk', sql\`${table.sceneType} <@ ARRAY[1,2,3]::smallint[]\`, )`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check( 'emoji_pack_scene_type_non_empty_chk', sql\`cardinality(${table.sceneType}) > 0\`, )`：检查约束能表达业务边界，建议保留并补齐缺失字段。

#### Relations 审查

- `assets`：`r.many.emojiAsset()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### emoji_recent_usage（emojiRecentUsage）

- Schema 文件：`db/schema/app/emoji-recent-usage.ts`
- 风格来源：手工建模 / 新增表
- 对应 relations：`db/relations/app.ts`
- 表注释：最近使用表情表。 - 记录用户在不同场景的最近使用轨迹与累计次数。 - 采用 (userId, scene, emojiAssetId) 复合主键做幂等聚合更新。
- 重点结论：当前未发现高优先级结构问题。

#### 字段审查

- `userId`：当前 `integer().notNull()`。注释：用户 ID。 - 对应 app_user.id。。结论：保留。建议：维持当前定义。
- `scene`：当前 `smallint().notNull()`。注释：业务场景。 - 1=chat，2=comment，3=forum。。结论：保留。建议：维持当前定义。
- `emojiAssetId`：当前 `integer().notNull()`。注释：表情资源 ID。 - 对应 emoji_asset.id。。结论：保留。建议：维持当前定义。
- `useCount`：当前 `integer().default(1).notNull()`。注释：累计使用次数。 - 每次上报命中后原子递增。。结论：保留。建议：维持当前定义。
- `lastUsedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).notNull()`。注释：最近一次使用时间（UTC）。 - 用于最近使用列表排序。。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `primaryKey({ columns: [table.userId, table.scene, table.emojiAssetId], })`：主键定义明确，保持现状。
- `index('emoji_recent_usage_user_id_scene_last_used_at_idx').on( table.userId, table.scene, table.lastUsedAt.desc(), )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('emoji_recent_usage_emoji_asset_id_idx').on(table.emojiAssetId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `check('emoji_recent_usage_scene_chk', sql\`${table.scene} in (1, 2, 3)\`)`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check('emoji_recent_usage_use_count_chk', sql\`${table.useCount} >= 0\`)`：检查约束能表达业务边界，建议保留并补齐缺失字段。

#### Relations 审查

- `user`：`r.one.appUser({ from: r.emojiRecentUsage.userId, to: r.appUser.id, })`。from=`r.emojiRecentUsage.userId`，to=`r.appUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `emojiAsset`：`r.one.emojiAsset({ from: r.emojiRecentUsage.emojiAssetId, to: r.emojiAsset.id, })`。from=`r.emojiRecentUsage.emojiAssetId`，to=`r.emojiAsset.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### growth_audit_log（growthAuditLog）

- Schema 文件：`db/schema/app/growth-audit-log.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/app.ts`
- 表注释：成长结算审计日志表 记录规则判定与结算结果，便于排障和运营追踪
- 重点结论：闭集语义字段未使用 smallint；smallint 字段注释未写清数值含义。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `requestId`：当前 `varchar({ length: 80 })`。注释：请求链路ID（可选）。结论：保留。建议：维持当前定义。
- `userId`：当前 `integer().notNull()`。注释：用户ID。结论：保留。建议：维持当前定义。
- `bizKey`：当前 `varchar({ length: 120 }).notNull()`。注释：幂等业务键。结论：保留。建议：维持当前定义。
- `assetType`：当前 `varchar({ length: 30 }).notNull()`。注释：资产类型（POINTS / EXPERIENCE / BADGE）。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `action`：当前 `varchar({ length: 30 }).notNull()`。注释：动作（GRANT / CONSUME / APPLY_RULE / ASSIGN_BADGE）。结论：保留。建议：维持当前定义。
- `ruleType`：当前 `smallint()`。注释：规则类型（可选）。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `decision`：当前 `varchar({ length: 20 }).notNull()`。注释：判定结果（allow / deny）。结论：保留。建议：维持当前定义。
- `reason`：当前 `varchar({ length: 80 })`。注释：拒绝或处理原因。结论：保留。建议：维持当前定义。
- `deltaRequested`：当前 `integer()`。注释：请求变更值（可选）。结论：保留。建议：维持当前定义。
- `deltaApplied`：当前 `integer()`。注释：实际变更值（可选）。结论：保留。建议：维持当前定义。
- `context`：当前 `jsonb()`。注释：扩展上下文。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `index("growth_audit_log_user_id_biz_key_idx").on(table.userId, table.bizKey)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("growth_audit_log_asset_type_action_decision_created_at_idx").on(table.assetType, table.action, table.decision, table.createdAt)`：涉及待改 `smallint` 字段，索引语义可以保留，但生成语句要跟随字段类型一起调整。
- `index("growth_audit_log_request_id_idx").on(table.requestId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `user`：`r.one.appUser({ from: r.growthAuditLog.userId, to: r.appUser.id })`。from=`r.growthAuditLog.userId`，to=`r.appUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### growth_ledger_record（growthLedgerRecord）

- Schema 文件：`db/schema/app/growth-ledger-record.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/app.ts`
- 表注释：统一成长流水表 记录积分、经验等可计量资产的变更流水
- 重点结论：闭集语义字段未使用 smallint；smallint 字段注释未写清数值含义；缺少显式数值边界约束。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `userId`：当前 `integer().notNull()`。注释：用户ID。结论：保留。建议：维持当前定义。
- `assetType`：当前 `smallint().notNull()`。注释：资产类型（1=积分 2=经验值）。结论：保留。建议：维持当前定义。
- `delta`：当前 `integer().notNull()`。注释：变更值（正数发放，负数扣减）。结论：保留。建议：维持当前定义。
- `beforeValue`：当前 `integer().notNull()`。注释：变更前余额。结论：保留。建议：维持当前定义。
- `afterValue`：当前 `integer().notNull()`。注释：变更后余额。结论：保留。建议：维持当前定义。
- `bizKey`：当前 `varchar({ length: 120 }).notNull()`。注释：幂等业务键（同用户下全局唯一）。结论：保留。建议：维持当前定义。
- `source`：当前 `varchar({ length: 40 }).notNull()`。注释：账本来源 用于区分基础成长规则奖励、任务 bonus 和其他手工/业务来源。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `ruleType`：当前 `smallint()`。注释：规则类型（可选）。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `ruleId`：当前 `integer()`。注释：规则ID（可选）。结论：保留。建议：维持当前定义。
- `targetType`：当前 `smallint()`。注释：目标类型（可选）。结论：smallint 字段注释未写清数值含义；缺少显式数值边界约束。建议：在注释中补齐每个数值对应的业务语义。；结合业务语义补充 `check(...)`，明确非负或正数边界。
- `targetId`：当前 `integer()`。注释：目标ID（可选）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `remark`：当前 `varchar({ length: 500 })`。注释：备注。结论：保留。建议：维持当前定义。
- `context`：当前 `jsonb()`。注释：扩展上下文。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("growth_ledger_record_user_id_biz_key_key").on(table.userId, table.bizKey)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("growth_ledger_record_user_id_asset_type_created_at_idx").on(table.userId, table.assetType, table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("growth_ledger_record_target_type_target_id_idx").on(table.targetType, table.targetId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `user`：`r.one.appUser({ from: r.growthLedgerRecord.userId, to: r.appUser.id, })`。from=`r.growthLedgerRecord.userId`，to=`r.appUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### growth_rule_usage_slot（growthRuleUsageSlot）

- Schema 文件：`db/schema/app/growth-rule-usage-slot.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/app.ts`
- 表注释：成长规则限流槽位表 通过唯一约束实现高并发下的 daily/total/cooldown 防重复命中
- 重点结论：闭集语义字段未使用 smallint。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `userId`：当前 `integer().notNull()`。注释：用户ID。结论：保留。建议：维持当前定义。
- `assetType`：当前 `varchar({ length: 30 }).notNull()`。注释：资产类型（POINTS / EXPERIENCE）。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `ruleKey`：当前 `varchar({ length: 80 }).notNull()`。注释：规则键（如 points:10 / experience:6）。结论：保留。建议：维持当前定义。
- `slotType`：当前 `varchar({ length: 20 }).notNull()`。注释：槽位类型（DAILY / TOTAL / COOLDOWN）。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `slotValue`：当前 `varchar({ length: 60 }).notNull()`。注释：槽位值（如 2026-03-07 / all / 2026-03-07T09:15）。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("growth_rule_usage_slot_user_id_asset_type_rule_key_slot_typ_key").on(table.userId, table.assetType, table.ruleKey, table.slotType, table.slotValue)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("growth_rule_usage_slot_user_id_asset_type_rule_key_created__idx").on(table.userId, table.assetType, table.ruleKey, table.createdAt)`：涉及待改 `smallint` 字段，索引语义可以保留，但生成语句要跟随字段类型一起调整。

#### Relations 审查

- `user`：`r.one.appUser({ from: r.growthRuleUsageSlot.userId, to: r.appUser.id, })`。from=`r.growthRuleUsageSlot.userId`，to=`r.appUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### task（task）

- Schema 文件：`db/schema/app/task.ts`
- 风格来源：手工建模 / 新增表
- 对应 relations：`db/relations/app.ts`
- 表注释：任务定义。 存储任务模板本身，不直接记录用户执行状态；用户领取和进度由 `task_assignment` 与 `task_progress_log` 承载。
- 重点结论：smallint 字段注释未写清数值含义；缺少显式数值边界约束；闭集语义字段未使用 smallint。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：任务模板主键。 仅用于内部关联和后台运维，不承载业务语义。。结论：保留。建议：维持当前定义。
- `code`：当前 `varchar({ length: 50 }).notNull()`。注释：任务稳定编码。 用于后台配置、灰度排障和外部引用，要求全局唯一。。结论：保留。建议：维持当前定义。
- `title`：当前 `varchar({ length: 200 }).notNull()`。注释：任务标题。 直接用于 app/admin 展示，变更不会影响历史 assignment 快照。。结论：保留。建议：维持当前定义。
- `description`：当前 `varchar({ length: 1000 })`。注释：任务描述。结论：保留。建议：维持当前定义。
- `cover`：当前 `varchar({ length: 255 })`。注释：任务封面。结论：保留。建议：维持当前定义。
- `type`：当前 `smallint().notNull()`。注释：任务场景类型。 新写入只允许稳定值，历史兼容值在读层归一化处理。。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `status`：当前 `smallint().notNull()`。注释：任务发布状态。 草稿/发布/下线只影响模板可用性，不直接代表 assignment 执行状态。。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `isEnabled`：当前 `boolean().default(true).notNull()`。注释：是否启用。 用于紧急关闭任务模板，但保留配置与审计信息。。结论：保留。建议：维持当前定义。
- `priority`：当前 `smallint().default(0).notNull()`。注释：任务优先级。 数值越大越靠前，仅影响任务列表展示与自动领取处理顺序。。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `claimMode`：当前 `smallint().notNull()`。注释：领取方式。 AUTO 会在读链路或事件链路中自动补齐 assignment。。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `completeMode`：当前 `smallint().notNull()`。注释：完成方式。 AUTO 允许进度达标后直接进入完成态，MANUAL 需要显式 complete。。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `objectiveType`：当前 `smallint().default(1).notNull()`。注释：任务目标类型。 MANUAL 表示人工推进，EVENT_COUNT 表示由事件累计驱动。。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `eventCode`：当前 `integer()`。注释：目标事件编码。 仅 `objectiveType=EVENT_COUNT` 时有意义，映射成长事件定义中的稳定编码。。结论：保留。建议：维持当前定义。
- `targetCount`：当前 `integer().default(1).notNull()`。注释：目标次数。 作为完成判定阈值，必须始终保持为大于 0 的整数。。结论：保留。建议：维持当前定义。
- `objectiveConfig`：当前 `jsonb()`。注释：目标附加配置。 用于约束事件上下文，例如限定某个业务子场景、资源范围或标签条件。。结论：保留。建议：维持当前定义。
- `rewardConfig`：当前 `jsonb()`。注释：奖励配置。 当前仅支持 `points` / `experience` 正整数，`null` 表示无任务奖励。。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `repeatRule`：当前 `jsonb()`。注释：重复规则。 `timezone` 仅影响周期切分和 cycleKey 计算，不改变时间字段的存储时区。。结论：保留。建议：维持当前定义。
- `publishStartAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：发布开始时间。 `null` 表示不限制开始时间，任务一旦发布即可参与领取/推进。。结论：保留。建议：维持当前定义。
- `publishEndAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：发布结束时间。 `null` 表示不限制结束时间；存在值时会同步约束 assignment 的可用窗口。。结论：保留。建议：维持当前定义。
- `createdById`：当前 `integer()`。注释：创建人 ID。 仅用于后台审计，允许历史数据为空。。结论：保留。建议：维持当前定义。
- `updatedById`：当前 `integer()`。注释：更新人 ID。 仅用于后台审计，允许历史数据为空。。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：模板创建时间。 属于后台审计字段，不参与任务可用性判断。。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：模板最近更新时间。 用于后台审计和排障，不作为任务周期边界。。结论：保留。建议：维持当前定义。
- `deletedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：软删除时间。 非空表示模板已从正常可见范围移除，但历史 assignment 与审计记录仍保留。。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique('task_code_key').on(table.code)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index('task_status_is_enabled_idx').on(table.status, table.isEnabled)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('task_type_idx').on(table.type)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('task_objective_type_idx').on(table.objectiveType)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('task_event_code_idx').on(table.eventCode)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('task_publish_start_at_idx').on(table.publishStartAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('task_publish_end_at_idx').on(table.publishEndAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('task_created_at_idx').on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('task_deleted_at_idx').on(table.deletedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `check('task_target_count_positive_chk', sql\`${table.targetCount} > 0\`)`：检查约束能表达业务边界，建议保留并补齐缺失字段。

#### Relations 审查

- `assignments`：`r.many.taskAssignment()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `createdBy`：`r.one.adminUser({ from: r.task.createdById, to: r.adminUser.id, alias: 'TaskCreatedBy', })`。from=`r.task.createdById`，to=`r.adminUser.id`，alias=`TaskCreatedBy` 结论：from/to 明确，属于单对象软关联。 alias=TaskCreatedBy，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `updatedBy`：`r.one.adminUser({ from: r.task.updatedById, to: r.adminUser.id, alias: 'TaskUpdatedBy', })`。from=`r.task.updatedById`，to=`r.adminUser.id`，alias=`TaskUpdatedBy` 结论：from/to 明确，属于单对象软关联。 alias=TaskUpdatedBy，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### task_assignment（taskAssignment）

- Schema 文件：`db/schema/app/task-assignment.ts`
- 风格来源：手工建模 / 新增表
- 对应 relations：`db/relations/app.ts`
- 表注释：任务分配记录。 每条记录表示某个用户在某个周期内命中的一次任务实例，是任务执行状态的事实来源。
- 重点结论：smallint 字段注释未写清数值含义。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：assignment 主键。 仅用于执行态关联和排障定位，不承载业务上的“周期唯一键”语义。。结论：保留。建议：维持当前定义。
- `taskId`：当前 `integer().notNull()`。注释：任务 ID。 关联任务模板；即使模板后续被下线，assignment 仍保留快照与执行痕迹。。结论：保留。建议：维持当前定义。
- `userId`：当前 `integer().notNull()`。注释：任务归属用户 ID。 与 taskId + cycleKey 共同限定“同用户同周期唯一实例”。。结论：保留。建议：维持当前定义。
- `cycleKey`：当前 `varchar({ length: 32 }).notNull()`。注释：周期标识。 用于约束同一用户在同一周期内只拥有一条 assignment。。结论：保留。建议：维持当前定义。
- `status`：当前 `smallint().notNull()`。注释：分配状态。 表示领取、推进、完成和过期等执行阶段。。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `rewardStatus`：当前 `smallint().default(0).notNull()`。注释：奖励结算状态。 仅描述任务 bonus 的到账结果，不覆盖其他成长事件奖励。。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `rewardResultType`：当前 `smallint()`。注释：奖励结算结果类型。 用于区分真实落账、幂等命中和失败，便于后台对账与补偿。。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `progress`：当前 `integer().default(0).notNull()`。注释：当前进度。 与 `target` 对比后决定是否满足完成条件。。结论：保留。建议：维持当前定义。
- `target`：当前 `integer().default(1).notNull()`。注释：目标次数。 来自任务配置快照，必须大于 0，避免模板变更影响历史实例判定。。结论：保留。建议：维持当前定义。
- `taskSnapshot`：当前 `jsonb()`。注释：任务快照。 记录领取当下的关键配置，支持模板变更后仍按历史语义补偿奖励与展示文案。。结论：保留。建议：维持当前定义。
- `context`：当前 `jsonb()`。注释：任务上下文。 保存领取来源、事件附加信息或推进过程中的额外业务上下文。。结论：保留。建议：维持当前定义。
- `version`：当前 `integer().default(0).notNull()`。注释：乐观锁版本号。 用于并发推进时避免覆盖彼此的进度写入。。结论：保留。建议：维持当前定义。
- `claimedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：领取时间。。结论：保留。建议：维持当前定义。
- `completedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：完成时间。。结论：保留。建议：维持当前定义。
- `expiredAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：过期时间。 由发布窗口与重复周期共同裁剪得出，非空后会被定时任务自动关闭。。结论：保留。建议：维持当前定义。
- `rewardSettledAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：奖励结算时间。 记录任务 bonus 最后一次成功或失败结算的处理时间。。结论：保留。建议：维持当前定义。
- `rewardLedgerIds`：当前 `integer().array().default(sql\`ARRAY[]::integer[]\`).notNull()`。注释：本次奖励关联到账本记录 ID 列表。 仅记录任务 bonus 真正落账的流水，幂等命中时通常为空数组。。结论：保留。建议：维持当前定义。
- `lastRewardError`：当前 `varchar({ length: 500 })`。注释：上次奖励失败原因。 仅在最近一次奖励补偿失败时保留，用于后台排障。。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：assignment 创建时间。 主要用于审计和列表排序，不等同于 claimedAt。。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：assignment 最近更新时间。 反映最后一次状态推进或奖励同步，不代表事件发生时间。。结论：保留。建议：维持当前定义。
- `deletedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：软删除时间。 仅用于逻辑移除异常记录，正常历史审计通常依赖状态字段而不是物理删除。。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique('task_assignment_task_id_user_id_cycle_key_key').on(table.taskId, table.userId, table.cycleKey)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index('task_assignment_user_id_status_idx').on(table.userId, table.status)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('task_assignment_task_id_idx').on(table.taskId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('task_assignment_completed_at_idx').on(table.completedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('task_assignment_expired_at_idx').on(table.expiredAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('task_assignment_deleted_at_idx').on(table.deletedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `check('task_assignment_target_positive_chk', sql\`${table.target} > 0\`)`：检查约束能表达业务边界，建议保留并补齐缺失字段。

#### Relations 审查

- `task`：`r.one.task({ from: r.taskAssignment.taskId, to: r.task.id })`。from=`r.taskAssignment.taskId`，to=`r.task.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `user`：`r.one.appUser({ from: r.taskAssignment.userId, to: r.appUser.id })`。from=`r.taskAssignment.userId`，to=`r.appUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `progressLogs`：`r.many.taskProgressLog()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### task_progress_log（taskProgressLog）

- Schema 文件：`db/schema/app/task-progress-log.ts`
- 风格来源：手工建模 / 新增表
- 对应 relations：`db/relations/app.ts`
- 表注释：任务进度日志。 记录 assignment 状态推进的事实轨迹，用于幂等校验、审计回溯和奖励排障。
- 重点结论：smallint 字段注释未写清数值含义。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：进度日志主键。 仅用于时间序对账和排障定位，不参与幂等约束。。结论：保留。建议：维持当前定义。
- `assignmentId`：当前 `integer().notNull()`。注释：分配记录 ID。 指向被推进的 assignment，是日志与执行状态之间的事实关联键。。结论：保留。建议：维持当前定义。
- `userId`：当前 `integer().notNull()`。注释：本次推进归属的用户 ID。 主要用于审计、筛选和对账视图，不单独决定幂等。。结论：保留。建议：维持当前定义。
- `actionType`：当前 `smallint().notNull()`。注释：操作类型。 区分领取、普通推进、完成和过期等不同状态迁移。。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `progressSource`：当前 `smallint().default(1).notNull()`。注释：推进来源。 用于区分用户手动操作、事件驱动和系统补偿。。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `delta`：当前 `integer().notNull()`。注释：变更值。 对于领取或显式完成等动作可以为 0，表示仅状态发生变化。。结论：保留。建议：维持当前定义。
- `beforeValue`：当前 `integer().notNull()`。注释：变更前值。。结论：保留。建议：维持当前定义。
- `afterValue`：当前 `integer().notNull()`。注释：变更后值。。结论：保留。建议：维持当前定义。
- `eventCode`：当前 `integer()`。注释：关联事件编码。 仅事件驱动推进时有值，用于对账与事件回溯。。结论：保留。建议：维持当前定义。
- `eventBizKey`：当前 `varchar({ length: 180 })`。注释：关联事件幂等键。 与 assignment 组成唯一约束，保证同一事件不会重复推进同一实例。。结论：保留。建议：维持当前定义。
- `eventOccurredAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：事件发生时间。 用于按真实发生时刻落周期，而不是按消费者接收时间计算。。结论：保留。建议：维持当前定义。
- `context`：当前 `jsonb()`。注释：变更上下文。 保存额外业务上下文、事件摘要或补偿线索，便于排障。。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：日志写入时间。 与 eventOccurredAt 区分开来，后者表示业务事件真实发生时刻。。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique('task_progress_log_assignment_id_event_biz_key_key').on( table.assignmentId, table.eventBizKey, )`：唯一性约束明确，字段类型调整后通常继续保留。
- `index('task_progress_log_assignment_id_idx').on(table.assignmentId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('task_progress_log_user_id_created_at_idx').on( table.userId, table.createdAt, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('task_progress_log_event_code_created_at_idx').on( table.eventCode, table.createdAt, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `assignment`：`r.one.taskAssignment({ from: r.taskProgressLog.assignmentId, to: r.taskAssignment.id, })`。from=`r.taskProgressLog.assignmentId`，to=`r.taskAssignment.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `user`：`r.one.appUser({ from: r.taskProgressLog.userId, to: r.appUser.id })`。from=`r.taskProgressLog.userId`，to=`r.appUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### user_badge（userBadge）

- Schema 文件：`db/schema/app/user-badge.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/app.ts`
- 表注释：用户徽章表 - 存储通用用户徽章信息
- 重点结论：缺少显式数值边界约束。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `name`：当前 `varchar({ length: 20 }).notNull()`。注释：徽章名称。结论：保留。建议：维持当前定义。
- `type`：当前 `smallint().notNull()`。注释：徽章类型（1=系统徽章, 2=成就徽章, 3=活动徽章）。结论：保留。建议：维持当前定义。
- `description`：当前 `varchar({ length: 200 })`。注释：徽章描述。结论：保留。建议：维持当前定义。
- `icon`：当前 `varchar({ length: 255 })`。注释：徽章图标URL。结论：保留。建议：维持当前定义。
- `business`：当前 `varchar({ length: 20 })`。注释：业务域标识（如 forum/comic）。结论：保留。建议：维持当前定义。
- `eventKey`：当前 `varchar({ length: 50 })`。注释：事件键（如 forum.topic.create）。结论：保留。建议：维持当前定义。
- `sortOrder`：当前 `smallint().default(0).notNull()`。注释：排序值（数值越小越靠前）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `isEnabled`：当前 `boolean().default(true).notNull()`。注释：是否启用。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `index("user_badge_type_idx").on(table.type)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_badge_business_event_key_idx").on(table.business, table.eventKey)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_badge_sort_order_idx").on(table.sortOrder)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_badge_is_enabled_idx").on(table.isEnabled)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_badge_created_at_idx").on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `assignments`：`r.many.userBadgeAssignment()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `users`：`r.many.appUser({ from: r.userBadge.id.through(r.userBadgeAssignment.badgeId), to: r.appUser.id.through(r.userBadgeAssignment.userId), })`。from=`r.userBadge.id.through(r.userBadgeAssignment.badgeId)`，to=`r.appUser.id.through(r.userBadgeAssignment.userId)` 结论：many 关系方向显式，便于排查多对多和自关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### user_badge_assignment（userBadgeAssignment）

- Schema 文件：`db/schema/app/user-badge-assignment.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/app.ts`
- 表注释：用户徽章关联表 - 管理用户获得的徽章
- 重点结论：当前未发现高优先级结构问题。

#### 字段审查

- `userId`：当前 `integer().notNull()`。注释：关联的用户ID。结论：保留。建议：维持当前定义。
- `badgeId`：当前 `integer().notNull()`。注释：关联的徽章ID。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：获得时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `index("user_badge_assignment_badge_id_created_at_idx").on(table.badgeId, table.createdAt.desc())`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_badge_assignment_user_id_created_at_idx").on(table.userId, table.createdAt.desc())`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `primaryKey({ columns: [table.userId, table.badgeId] })`：主键定义明确，保持现状。

#### Relations 审查

- `badge`：`r.one.userBadge({ from: r.userBadgeAssignment.badgeId, to: r.userBadge.id, })`。from=`r.userBadgeAssignment.badgeId`，to=`r.userBadge.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `user`：`r.one.appUser({ from: r.userBadgeAssignment.userId, to: r.appUser.id, })`。from=`r.userBadgeAssignment.userId`，to=`r.appUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### user_browse_log（userBrowseLog）

- Schema 文件：`db/schema/app/user-browse-log.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/app.ts`
- 表注释：用户浏览记录表 记录用户对各类目标（漫画、小说、章节、论坛主题）的浏览行为 用于浏览历史查询、热度统计、推荐算法等 支持用户删除浏览记录
- 重点结论：缺少显式数值边界约束。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID（自增）。结论：保留。建议：维持当前定义。
- `targetType`：当前 `smallint().notNull()`。注释：目标类型 1=漫画, 2=小说, 3=漫画章节, 4=小说章节, 5=论坛主题 注意：作品必须区分漫画(1)和小说(2)，不能使用通用类型。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `targetId`：当前 `integer().notNull()`。注释：目标ID 关联的具体目标记录ID - targetType=1/2 时：work.id - targetType=3/4 时：work_chapter.id - targetType=5 时：forum_topic.id。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `userId`：当前 `integer().notNull()`。注释：用户ID（关联 app_user.id） 执行浏览操作的用户。结论：保留。建议：维持当前定义。
- `ipAddress`：当前 `varchar({ length: 45 })`。注释：IP地址 用户浏览时的IP地址，用于地域统计、风控等。结论：保留。建议：维持当前定义。
- `device`：当前 `varchar({ length: 200 })`。注释：设备类型 用户使用的设备类型，如：mobile、desktop、tablet 用于设备统计和适配分析。结论：保留。建议：维持当前定义。
- `userAgent`：当前 `varchar({ length: 500 })`。注释：用户代理 浏览器User-Agent字符串，用于详细的设备和浏览器分析。结论：保留。建议：维持当前定义。
- `viewedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：浏览时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `index("user_browse_log_target_type_target_id_idx").on(table.targetType, table.targetId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_browse_log_user_id_idx").on(table.userId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_browse_log_viewed_at_idx").on(table.viewedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_browse_log_target_type_target_id_user_id_idx").on(table.targetType, table.targetId, table.userId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_browse_log_user_id_viewed_at_idx").on(table.userId, table.viewedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `user`：`r.one.appUser({ from: r.userBrowseLog.userId, to: r.appUser.id })`。from=`r.userBrowseLog.userId`，to=`r.appUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### user_comment（userComment）

- Schema 文件：`db/schema/app/user-comment.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/app.ts`
- 表注释：用户评论表 统一存储作品评论、章节评论和论坛回复
- 重点结论：缺少显式数值边界约束；smallint 字段注释未写清数值含义；闭集语义字段未使用 smallint。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `targetType`：当前 `smallint().notNull()`。注释：目标类型（1=漫画，2=小说，3=漫画章节，4=小说章节，5=论坛主题）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `targetId`：当前 `integer().notNull()`。注释：目标ID。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `userId`：当前 `integer().notNull()`。注释：评论用户ID。结论：保留。建议：维持当前定义。
- `content`：当前 `text().notNull()`。注释：评论内容。结论：保留。建议：维持当前定义。
- `bodyTokens`：当前 `jsonb()`。注释：评论正文解析 token 缓存 用于持久化 EmojiParser 输出，读路径可直接复用。结论：保留。建议：维持当前定义。
- `floor`：当前 `integer()`。注释：楼层号。结论：保留。建议：维持当前定义。
- `replyToId`：当前 `integer()`。注释：回复目标评论ID。结论：保留。建议：维持当前定义。
- `actualReplyToId`：当前 `integer()`。注释：实际回复的根评论ID。结论：保留。建议：维持当前定义。
- `isHidden`：当前 `boolean().default(false).notNull()`。注释：是否隐藏。结论：保留。建议：维持当前定义。
- `auditStatus`：当前 `smallint().default(0).notNull()`。注释：审核状态（0=待审核，1=通过，2=拒绝）。结论：保留。建议：维持当前定义。
- `auditById`：当前 `integer()`。注释：审核人ID。结论：保留。建议：维持当前定义。
- `auditRole`：当前 `smallint()`。注释：审核角色。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `auditReason`：当前 `varchar({ length: 500 })`。注释：审核原因。结论：保留。建议：维持当前定义。
- `auditAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：审核时间。结论：保留。建议：维持当前定义。
- `likeCount`：当前 `integer().default(0).notNull()`。注释：点赞数。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `sensitiveWordHits`：当前 `jsonb()`。注释：敏感词命中记录。结论：保留。建议：维持当前定义。
- `geoCountry`：当前 `varchar({ length: 100 })`。注释：评论提交时解析到的国家/地区 仅记录新写入评论的属地快照，无法解析或历史记录时为空。结论：保留。建议：维持当前定义。
- `geoProvince`：当前 `varchar({ length: 100 })`。注释：评论提交时解析到的省份/州 仅记录新写入评论的属地快照，无法解析或历史记录时为空。结论：保留。建议：维持当前定义。
- `geoCity`：当前 `varchar({ length: 100 })`。注释：评论提交时解析到的城市 仅记录新写入评论的属地快照，无法解析或历史记录时为空。结论：保留。建议：维持当前定义。
- `geoIsp`：当前 `varchar({ length: 100 })`。注释：评论提交时解析到的网络运营商 仅记录新写入评论的属地快照，无法解析或历史记录时为空。结论：保留。建议：维持当前定义。
- `geoSource`：当前 `varchar({ length: 50 })`。注释：属地解析来源 当前固定为 ip2region；历史记录或未补齐属地快照时为空。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .defaultNow() .notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .$onUpdate(() => new Date()) .notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。
- `deletedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：删除时间（软删除）。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `index('user_comment_target_type_target_id_created_at_idx').on( table.targetType, table.targetId, table.createdAt, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('user_comment_target_type_target_id_reply_to_id_floor_idx').on( table.targetType, table.targetId, table.replyToId, table.floor, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('user_comment_target_type_target_id_audit_status_is_hidden_d_idx').on( table.targetType, table.targetId, table.auditStatus, table.isHidden, table.deletedAt, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('user_comment_actual_reply_to_id_audit_status_is_hidden_dele_idx').on( table.actualReplyToId, table.auditStatus, table.isHidden, table.deletedAt, table.createdAt, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('user_comment_target_type_target_id_deleted_at_created_at_idx').on( table.targetType, table.targetId, table.deletedAt, table.createdAt, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('user_comment_user_id_idx').on(table.userId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('user_comment_user_id_created_at_desc_idx').on( table.userId, table.createdAt.desc(), )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('user_comment_user_id_deleted_at_created_at_desc_idx').on( table.userId, table.deletedAt, table.createdAt.desc(), )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('user_comment_created_at_idx').on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('user_comment_audit_status_idx').on(table.auditStatus)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('user_comment_is_hidden_idx').on(table.isHidden)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('user_comment_reply_to_id_idx').on(table.replyToId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('user_comment_actual_reply_to_id_idx').on(table.actualReplyToId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('user_comment_deleted_at_idx').on(table.deletedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `user`：`r.one.appUser({ from: r.userComment.userId, to: r.appUser.id })`。from=`r.userComment.userId`，to=`r.appUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `replyTo`：`r.one.userComment({ from: r.userComment.replyToId, to: r.userComment.id, alias: 'CommentReply', })`。from=`r.userComment.replyToId`，to=`r.userComment.id`，alias=`CommentReply` 结论：from/to 明确，属于单对象软关联。 alias=CommentReply，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `replies`：`r.many.userComment({ from: r.userComment.id, to: r.userComment.replyToId, alias: 'CommentReply', })`。from=`r.userComment.id`，to=`r.userComment.replyToId`，alias=`CommentReply` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=CommentReply，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `actualReplyTo`：`r.one.userComment({ from: r.userComment.actualReplyToId, to: r.userComment.id, alias: 'CommentActualReply', })`。from=`r.userComment.actualReplyToId`，to=`r.userComment.id`，alias=`CommentActualReply` 结论：from/to 明确，属于单对象软关联。 alias=CommentActualReply，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `actualReplies`：`r.many.userComment({ from: r.userComment.id, to: r.userComment.actualReplyToId, alias: 'CommentActualReply', })`。from=`r.userComment.id`，to=`r.userComment.actualReplyToId`，alias=`CommentActualReply` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=CommentActualReply，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### user_download_record（userDownloadRecord）

- Schema 文件：`db/schema/app/user-download-record.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/app.ts`
- 表注释：用户下载记录表 记录用户对作品、章节等内容的下载操作 支持下载计数统计和用户下载历史查询
- 重点结论：缺少显式数值边界约束。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID（自增）。结论：保留。建议：维持当前定义。
- `targetType`：当前 `smallint().notNull()`。注释：目标类型 1=漫画章节, 2=小说章节。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `targetId`：当前 `integer().notNull()`。注释：目标ID。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `userId`：当前 `integer().notNull()`。注释：用户ID（关联 app_user.id）。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间（下载时间）。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("user_download_record_target_type_target_id_user_id_key").on(table.targetType, table.targetId, table.userId)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("user_download_record_target_type_target_id_idx").on(table.targetType, table.targetId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_download_record_user_id_idx").on(table.userId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_download_record_created_at_idx").on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `user`：`r.one.appUser({ from: r.userDownloadRecord.userId, to: r.appUser.id, })`。from=`r.userDownloadRecord.userId`，to=`r.appUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### user_experience_rule（userExperienceRule）

- Schema 文件：`db/schema/app/user-experience-rule.ts`
- 风格来源：legacy 自动转换
- 对应 relations：未定义
- 表注释：用户经验规则表 - 定义经验获取规则，包括发帖、回复、点赞、签到等
- 重点结论：smallint 字段注释未写清数值含义；缺少显式数值边界约束；闭集语义字段未使用 smallint。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `type`：当前 `smallint().notNull()`。注释：规则类型。 取值与语义统一以 GrowthRuleTypeEnum 为准； 举报奖励当前以 REPORT_VALID / REPORT_INVALID 表达裁决结果，\*\_REPORT 仅保留历史兼容语义； 章节类编码已统一收敛到 300 / 400 段。。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `experience`：当前 `integer().notNull()`。注释：经验奖励值（正整数）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `dailyLimit`：当前 `integer().default(0).notNull()`。注释：每日上限（0=无限制，禁止负值）。结论：闭集语义字段未使用 smallint；缺少显式数值边界约束。建议：改为 `smallint()`，并在注释中写清每个数值的含义。；结合业务语义补充 `check(...)`，明确非负或正数边界。
- `totalLimit`：当前 `integer().default(0).notNull()`。注释：总上限（0=无限制，禁止负值）。结论：闭集语义字段未使用 smallint；缺少显式数值边界约束。建议：改为 `smallint()`，并在注释中写清每个数值的含义。；结合业务语义补充 `check(...)`，明确非负或正数边界。
- `isEnabled`：当前 `boolean().default(true).notNull()`。注释：是否启用。结论：保留。建议：维持当前定义。
- `remark`：当前 `varchar({ length: 500 })`。注释：备注。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("user_experience_rule_type_key").on(table.type)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("user_experience_rule_type_idx").on(table.type)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_experience_rule_is_enabled_idx").on(table.isEnabled)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_experience_rule_created_at_idx").on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- 当前未声明 soft relations。结论：表内关联字段只停留在列语义层。建议：若后续需要 Drizzle relational query，再补 `defineRelationsPart`，但仍不引入数据库 FK。

### user_favorite（userFavorite）

- Schema 文件：`db/schema/app/user-favorite.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/app.ts`
- 表注释：用户收藏记录表 记录用户对各类目标（漫画、小说、论坛主题）的收藏操作 支持收藏计数统计和用户收藏列表查询
- 重点结论：缺少显式数值边界约束。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID（自增）。结论：保留。建议：维持当前定义。
- `targetType`：当前 `smallint().notNull()`。注释：目标类型 1=漫画, 2=小说, 3=论坛主题。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `targetId`：当前 `integer().notNull()`。注释：目标ID。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `userId`：当前 `integer().notNull()`。注释：用户ID（关联 app_user.id）。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间（收藏时间）。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("user_favorite_target_type_target_id_user_id_key").on(table.targetType, table.targetId, table.userId)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("user_favorite_target_type_target_id_idx").on(table.targetType, table.targetId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_favorite_user_id_idx").on(table.userId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_favorite_created_at_idx").on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `user`：`r.one.appUser({ from: r.userFavorite.userId, to: r.appUser.id })`。from=`r.userFavorite.userId`，to=`r.appUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### user_follow（userFollow）

- Schema 文件：`db/schema/app/user-follow.ts`
- 风格来源：手工建模 / 新增表
- 对应 relations：未定义
- 表注释：用户关注事实表 统一记录用户对用户、作者、论坛板块等目标的单向关注关系
- 重点结论：当前无对应 soft relations 定义；缺少显式数值边界约束。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键 ID。结论：保留。建议：维持当前定义。
- `targetType`：当前 `smallint().notNull()`。注释：关注目标类型 1=用户，2=作者，3=论坛板块。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `targetId`：当前 `integer().notNull()`。注释：关注目标 ID。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `userId`：当前 `integer().notNull()`。注释：发起关注的用户 ID。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .defaultNow() .notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique('user_follow_target_type_target_id_user_id_key').on( table.targetType, table.targetId, table.userId, )`：唯一性约束明确，字段类型调整后通常继续保留。
- `index('user_follow_user_id_target_type_created_at_idx').on( table.userId, table.targetType, table.createdAt, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('user_follow_target_type_target_id_created_at_idx').on( table.targetType, table.targetId, table.createdAt, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('user_follow_target_type_target_id_idx').on( table.targetType, table.targetId, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- 当前未声明 soft relations。结论：表内关联字段只停留在列语义层。建议：若后续需要 Drizzle relational query，再补 `defineRelationsPart`，但仍不引入数据库 FK。

### user_level_rule（userLevelRule）

- Schema 文件：`db/schema/app/user-level-rule.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/app.ts`
- 表注释：用户等级规则表 - 定义用户等级规则，包括等级名称、所需经验、等级权益等
- 重点结论：缺少显式数值边界约束。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `name`：当前 `varchar({ length: 20 }).notNull()`。注释：等级名称。结论：保留。建议：维持当前定义。
- `requiredExperience`：当前 `integer().notNull()`。注释：所需经验值。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `loginDays`：当前 `smallint().default(0).notNull()`。注释：所需登录天数。结论：保留。建议：维持当前定义。
- `description`：当前 `varchar({ length: 200 })`。注释：等级描述。结论：保留。建议：维持当前定义。
- `icon`：当前 `varchar({ length: 255 })`。注释：等级图标URL。结论：保留。建议：维持当前定义。
- `color`：当前 `varchar({ length: 20 })`。注释：等级专属颜色（十六进制）。结论：保留。建议：维持当前定义。
- `sortOrder`：当前 `smallint().default(0).notNull()`。注释：排序值（数值越小越靠前）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `isEnabled`：当前 `boolean().default(true).notNull()`。注释：是否启用。结论：保留。建议：维持当前定义。
- `business`：当前 `varchar({ length: 20 })`。注释：业务域标识（可选）。结论：保留。建议：维持当前定义。
- `dailyTopicLimit`：当前 `smallint().default(0).notNull()`。注释：每日发帖数量上限，0表示无限制。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `dailyReplyCommentLimit`：当前 `smallint().default(0).notNull()`。注释：每日回复和评论数量上限，0表示无限制。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `postInterval`：当前 `smallint().default(0).notNull()`。注释：发帖间隔秒数（防刷屏），0表示无限制。结论：保留。建议：维持当前定义。
- `dailyLikeLimit`：当前 `smallint().default(0).notNull()`。注释：每日点赞次数上限，0表示无限制。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `dailyFavoriteLimit`：当前 `smallint().default(0).notNull()`。注释：每日收藏次数上限，0表示无限制。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `blacklistLimit`：当前 `smallint().default(10).notNull()`。注释：黑名单上限。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `workCollectionLimit`：当前 `smallint().default(100).notNull()`。注释：作品收藏上限。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `purchasePayableRate`：当前 `numeric({ precision: 3, scale: 2 }) .default('1.00') .notNull()`。注释：积分支付比例（0-1之间的小数，1表示原价支付）。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .defaultNow() .notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .$onUpdate(() => new Date()) .notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique('user_level_rule_name_key').on(table.name)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index('user_level_rule_is_enabled_sort_order_idx').on( table.isEnabled, table.sortOrder, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `users`：`r.many.appUser()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `sections`：`r.many.forumSection({ from: r.userLevelRule.id, to: r.forumSection.userLevelRuleId, })`。from=`r.userLevelRule.id`，to=`r.forumSection.userLevelRuleId` 结论：many 关系方向显式，便于排查多对多和自关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `chaptersAsReadLevel`：`r.many.workChapter({ from: r.userLevelRule.id, to: r.workChapter.requiredViewLevelId, alias: 'ChapterReadLevel', })`。from=`r.userLevelRule.id`，to=`r.workChapter.requiredViewLevelId`，alias=`ChapterReadLevel` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=ChapterReadLevel，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `worksAsViewLevel`：`r.many.work({ from: r.userLevelRule.id, to: r.work.requiredViewLevelId, alias: 'WorkViewLevel', })`。from=`r.userLevelRule.id`，to=`r.work.requiredViewLevelId`，alias=`WorkViewLevel` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=WorkViewLevel，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### user_like（userLike）

- Schema 文件：`db/schema/app/user-like.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/app.ts`
- 表注释：用户点赞记录表 统一存储作品、章节、论坛主题、评论的点赞行为
- 重点结论：smallint 字段注释未写清数值含义；缺少显式数值边界约束。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键 ID。结论：保留。建议：维持当前定义。
- `targetType`：当前 `smallint().notNull()`。注释：点赞直接目标类型 取值见 like 模块的 LikeTargetTypeEnum。结论：smallint 字段注释未写清数值含义；缺少显式数值边界约束。建议：在注释中补齐每个数值对应的业务语义。；结合业务语义补充 `check(...)`，明确非负或正数边界。
- `targetId`：当前 `integer().notNull()`。注释：点赞直接目标 ID。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `sceneType`：当前 `smallint().notNull()`。注释：目标所属业务场景类型 取值见 SceneTypeEnum。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `sceneId`：当前 `integer().notNull()`。注释：目标所属业务场景根对象 ID 例如评论点赞时，这里存评论挂载的作品、章节或主题 ID。结论：保留。建议：维持当前定义。
- `commentLevel`：当前 `smallint()`。注释：评论层级类型 仅当 targetType=COMMENT 时有值 取值见 CommentLevelEnum。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `userId`：当前 `integer().notNull()`。注释：点赞用户 ID。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：点赞时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("user_like_target_type_target_id_user_id_key").on(table.targetType, table.targetId, table.userId)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("user_like_target_type_target_id_idx").on(table.targetType, table.targetId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_like_scene_type_scene_id_idx").on(table.sceneType, table.sceneId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_like_user_id_scene_type_created_at_idx").on(table.userId, table.sceneType, table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_like_created_at_idx").on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `user`：`r.one.appUser({ from: r.userLike.userId, to: r.appUser.id })`。from=`r.userLike.userId`，to=`r.appUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### user_mention（userMention）

- Schema 文件：`db/schema/app/user-mention.ts`
- 风格来源：legacy 自动转换
- 对应 relations：未定义
- 表注释：用户提及事实表 统一记录评论与论坛主题中的 @ 用户事实，并标记通知是否已补发。
- 重点结论：当前无对应 soft relations 定义。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `sourceType`：当前 `smallint().notNull()`。注释：来源类型（1=评论，2=论坛主题）。结论：保留。建议：维持当前定义。
- `sourceId`：当前 `integer().notNull()`。注释：来源ID。结论：保留。建议：维持当前定义。
- `mentionedUserId`：当前 `integer().notNull()`。注释：被提及用户ID。结论：保留。建议：维持当前定义。
- `startOffset`：当前 `integer().notNull()`。注释：提及开始偏移（基于正文 [start, end)）。结论：保留。建议：维持当前定义。
- `endOffset`：当前 `integer().notNull()`。注释：提及结束偏移（基于正文 [start, end)）。结论：保留。建议：维持当前定义。
- `notifiedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：已通知时间。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("user_mention_source_user_offset_key").on( table.sourceType, table.sourceId, table.mentionedUserId, table.startOffset, table.endOffset, )`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("user_mention_source_idx").on(table.sourceType, table.sourceId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_mention_receiver_created_at_idx").on(table.mentionedUserId, table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_mention_notified_at_idx").on(table.notifiedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- 当前未声明 soft relations。结论：表内关联字段只停留在列语义层。建议：若后续需要 Drizzle relational query，再补 `defineRelationsPart`，但仍不引入数据库 FK。

### user_point_rule（userPointRule）

- Schema 文件：`db/schema/app/user-point-rule.ts`
- 风格来源：legacy 自动转换
- 对应 relations：未定义
- 表注释：用户积分规则表 - 定义积分获取和消费规则，包括发帖、回复、点赞、签到等
- 重点结论：smallint 字段注释未写清数值含义；缺少显式数值边界约束；闭集语义字段未使用 smallint。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `type`：当前 `smallint().notNull()`。注释：规则类型。 取值与语义统一以 GrowthRuleTypeEnum 为准； 举报奖励当前以 REPORT_VALID / REPORT_INVALID 表达裁决结果，\*\_REPORT 仅保留历史兼容语义； 章节类编码已统一收敛到 300 / 400 段。。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `points`：当前 `integer().notNull()`。注释：积分奖励值（正整数）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `dailyLimit`：当前 `integer().default(0).notNull()`。注释：每日上限（0=无限制，禁止负值）。结论：闭集语义字段未使用 smallint；缺少显式数值边界约束。建议：改为 `smallint()`，并在注释中写清每个数值的含义。；结合业务语义补充 `check(...)`，明确非负或正数边界。
- `totalLimit`：当前 `integer().default(0).notNull()`。注释：总上限（0=无限制，禁止负值）。结论：闭集语义字段未使用 smallint；缺少显式数值边界约束。建议：改为 `smallint()`，并在注释中写清每个数值的含义。；结合业务语义补充 `check(...)`，明确非负或正数边界。
- `isEnabled`：当前 `boolean().default(true).notNull()`。注释：是否启用。结论：保留。建议：维持当前定义。
- `remark`：当前 `varchar({ length: 500 })`。注释：备注。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("user_point_rule_type_key").on(table.type)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("user_point_rule_type_idx").on(table.type)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_point_rule_is_enabled_idx").on(table.isEnabled)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_point_rule_created_at_idx").on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- 当前未声明 soft relations。结论：表内关联字段只停留在列语义层。建议：若后续需要 Drizzle relational query，再补 `defineRelationsPart`，但仍不引入数据库 FK。

### user_purchase_record（userPurchaseRecord）

- Schema 文件：`db/schema/app/user-purchase-record.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/app.ts`
- 表注释：用户购买记录表 记录用户对作品、章节等内容的购买操作 支持购买历史查询和消费统计
- 重点结论：缺少显式数值边界约束；闭集语义字段未使用 smallint。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID（自增）。结论：保留。建议：维持当前定义。
- `targetType`：当前 `smallint().notNull()`。注释：目标类型 1=漫画章节, 2=小说章节。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `targetId`：当前 `integer().notNull()`。注释：目标ID（作品ID或章节ID）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `userId`：当前 `integer().notNull()`。注释：用户ID（关联 app_user.id）。结论：保留。建议：维持当前定义。
- `originalPrice`：当前 `integer().notNull()`。注释：原价快照。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `paidPrice`：当前 `integer().notNull()`。注释：实付价格快照。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `payableRate`：当前 `numeric({ precision: 3, scale: 2 }).default('1.00').notNull()`。注释：支付比例快照（1=原价支付，0.9=9折）。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `status`：当前 `smallint().default(1).notNull()`。注释：购买状态（1=成功, 2=失败, 3=退款中, 4=已退款）。结论：保留。建议：维持当前定义。
- `paymentMethod`：当前 `smallint().notNull()`。注释：支付方式（1=余额, 2=支付宝, 3=微信, 4=积分兑换）。结论：保留。建议：维持当前定义。
- `outTradeNo`：当前 `varchar({ length: 100 })`。注释：第三方支付订单号。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .defaultNow() .notNull()`。注释：创建时间（购买时间）。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .$onUpdate(() => new Date()) .notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `uniqueIndex('user_purchase_record_success_unique_idx') .on(table.targetType, table.targetId, table.userId) .where(sql\`${table.status} = 1\`)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index('user_purchase_record_target_type_target_id_idx').on( table.targetType, table.targetId, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('user_purchase_record_user_id_idx').on(table.userId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('user_purchase_record_status_idx').on(table.status)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('user_purchase_record_created_at_idx').on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('user_purchase_record_user_id_status_target_type_created_at__idx').on( table.userId, table.status, table.targetType, table.createdAt, table.targetId, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `user`：`r.one.appUser({ from: r.userPurchaseRecord.userId, to: r.appUser.id, })`。from=`r.userPurchaseRecord.userId`，to=`r.appUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### user_report（userReport）

- Schema 文件：`db/schema/app/user-report.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/app.ts`
- 表注释：用户举报记录表 统一存储作品、章节、论坛主题、评论、用户的举报行为
- 重点结论：smallint 字段注释未写清数值含义；缺少显式数值边界约束。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键 ID。结论：保留。建议：维持当前定义。
- `reporterId`：当前 `integer().notNull()`。注释：举报人 ID。结论：保留。建议：维持当前定义。
- `handlerId`：当前 `integer()`。注释：处理人 ID。结论：保留。建议：维持当前定义。
- `targetType`：当前 `smallint().notNull()`。注释：举报直接目标类型 取值见 ReportTargetTypeEnum。结论：smallint 字段注释未写清数值含义；缺少显式数值边界约束。建议：在注释中补齐每个数值对应的业务语义。；结合业务语义补充 `check(...)`，明确非负或正数边界。
- `targetId`：当前 `integer().notNull()`。注释：举报直接目标 ID。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `sceneType`：当前 `smallint().notNull()`。注释：目标所属业务场景类型 取值见 SceneTypeEnum。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `sceneId`：当前 `integer().notNull()`。注释：目标所属业务场景根对象 ID 例如评论举报时，这里存评论挂载的作品、章节或主题 ID。结论：保留。建议：维持当前定义。
- `commentLevel`：当前 `smallint()`。注释：评论层级类型 仅当 targetType=COMMENT 时有值 取值见 CommentLevelEnum。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `reasonType`：当前 `smallint().notNull()`。注释：举报原因类型 取值见 ReportReasonEnum。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `description`：当前 `varchar({ length: 500 })`。注释：举报补充说明。结论：保留。建议：维持当前定义。
- `evidenceUrl`：当前 `varchar({ length: 500 })`。注释：证据链接。结论：保留。建议：维持当前定义。
- `status`：当前 `smallint().default(1).notNull()`。注释：举报状态 取值见 ReportStatusEnum。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `handlingNote`：当前 `varchar({ length: 500 })`。注释：处理备注。结论：保留。建议：维持当前定义。
- `handledAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：处理时间。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("user_report_reporter_id_target_type_target_id_key").on(table.reporterId, table.targetType, table.targetId)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("user_report_target_type_target_id_idx").on(table.targetType, table.targetId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_report_scene_type_scene_id_status_idx").on(table.sceneType, table.sceneId, table.status)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_report_scene_type_status_created_at_idx").on(table.sceneType, table.status, table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_report_reason_type_status_created_at_idx").on(table.reasonType, table.status, table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_report_handler_id_status_handled_at_idx").on(table.handlerId, table.status, table.handledAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_report_created_at_idx").on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `reporter`：`r.one.appUser({ from: r.userReport.reporterId, to: r.appUser.id, alias: 'UserReportReporter', })`。from=`r.userReport.reporterId`，to=`r.appUser.id`，alias=`UserReportReporter` 结论：from/to 明确，属于单对象软关联。 alias=UserReportReporter，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `handler`：`r.one.appUser({ from: r.userReport.handlerId, to: r.appUser.id, alias: 'UserReportHandler', })`。from=`r.userReport.handlerId`，to=`r.appUser.id`，alias=`UserReportHandler` 结论：from/to 明确，属于单对象软关联。 alias=UserReportHandler，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### user_work_reading_state（userWorkReadingState）

- Schema 文件：`db/schema/app/user-work-reading-state.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/app.ts`
- 表注释：用户作品阅读状态表 用于保存用户对作品（漫画/小说）的阅读进度状态
- 重点结论：当前未发现高优先级结构问题。

#### 字段审查

- `userId`：当前 `integer().notNull()`。注释：用户 ID。结论：保留。建议：维持当前定义。
- `workId`：当前 `integer().notNull()`。注释：作品 ID。结论：保留。建议：维持当前定义。
- `workType`：当前 `smallint().notNull()`。注释：作品类型（1=漫画, 2=小说）。结论：保留。建议：维持当前定义。
- `lastReadAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).notNull()`。注释：最近一次阅读时间。结论：保留。建议：维持当前定义。
- `lastReadChapterId`：当前 `integer()`。注释：最近一次阅读到的章节 ID，用于继续阅读。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `index("user_work_reading_state_user_id_work_type_last_read_at_idx").on(table.userId, table.workType, table.lastReadAt.desc())`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_work_reading_state_user_id_last_read_at_idx").on(table.userId, table.lastReadAt.desc())`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_work_reading_state_work_id_idx").on(table.workId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("user_work_reading_state_last_read_chapter_id_idx").on(table.lastReadChapterId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `primaryKey({ columns: [table.userId, table.workId] })`：主键定义明确，保持现状。

#### Relations 审查

- `user`：`r.one.appUser({ from: r.userWorkReadingState.userId, to: r.appUser.id, })`。from=`r.userWorkReadingState.userId`，to=`r.appUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `work`：`r.one.work({ from: r.userWorkReadingState.workId, to: r.work.id })`。from=`r.userWorkReadingState.workId`，to=`r.work.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `lastReadChapter`：`r.one.workChapter({ from: r.userWorkReadingState.lastReadChapterId, to: r.workChapter.id, alias: 'UserWorkReadingStateLastReadChapter', })`。from=`r.userWorkReadingState.lastReadChapterId`，to=`r.workChapter.id`，alias=`UserWorkReadingStateLastReadChapter` 结论：from/to 明确，属于单对象软关联。 alias=UserWorkReadingStateLastReadChapter，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

## forum 域

- 表数量：10
- 高风险项：9 张表存在结构性问题或缺失项。

### forum_moderator（forumModerator）

- Schema 文件：`db/schema/forum/forum-moderator.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/forum.ts`
- 表注释：论坛版主表 - 管理论坛版主信息，包括角色类型、权限设置、启用状态等
- 重点结论：闭集语义字段未使用 smallint。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `userId`：当前 `integer().notNull()`。注释：关联的用户ID。结论：保留。建议：维持当前定义。
- `groupId`：当前 `integer()`。注释：关联的分组ID（分组版主时必填）。结论：保留。建议：维持当前定义。
- `roleType`：当前 `integer().default(3).notNull()`。注释：版主角色类型（1=超级版主，2=分组版主，3=板块版主）。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `permissions`：当前 `integer().array().default(sql\`ARRAY[]::integer[]\`)`。注释：权限数组（1=置顶, 2=加精, 3=锁定, 4=删除, 5=审核, 6=移动）。结论：闭集语义字段未使用 smallint。建议：改为 `smallint().array()`，并在注释中写清每个数值的含义。
- `isEnabled`：当前 `boolean().default(true).notNull()`。注释：是否启用。结论：保留。建议：维持当前定义。
- `remark`：当前 `varchar({ length: 500 })`。注释：备注。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。
- `deletedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：软删除时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("forum_moderator_user_id_key").on(table.userId)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("forum_moderator_group_id_idx").on(table.groupId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_moderator_role_type_idx").on(table.roleType)`：涉及待改 `smallint` 字段，索引语义可以保留，但生成语句要跟随字段类型一起调整。
- `index("forum_moderator_is_enabled_idx").on(table.isEnabled)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_moderator_created_at_idx").on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_moderator_deleted_at_idx").on(table.deletedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `user`：`r.one.appUser({ from: r.forumModerator.userId, to: r.appUser.id })`。from=`r.forumModerator.userId`，to=`r.appUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `group`：`r.one.forumSectionGroup({ from: r.forumModerator.groupId, to: r.forumSectionGroup.id, })`。from=`r.forumModerator.groupId`，to=`r.forumSectionGroup.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `actionLogs`：`r.many.forumModeratorActionLog()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `moderatorSections`：`r.many.forumModeratorSection()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `moderatedSections`：`r.many.forumSection({ from: r.forumModerator.id.through(r.forumModeratorSection.moderatorId), to: r.forumSection.id.through(r.forumModeratorSection.sectionId), })`。from=`r.forumModerator.id.through(r.forumModeratorSection.moderatorId)`，to=`r.forumSection.id.through(r.forumModeratorSection.sectionId)` 结论：many 关系方向显式，便于排查多对多和自关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### forum_moderator_action_log（forumModeratorActionLog）

- Schema 文件：`db/schema/forum/forum-moderator-action-log.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/forum.ts`
- 表注释：论坛版主操作日志表 - 记录版主的所有操作行为，包括主题管理、回复管理、审核等操作
- 重点结论：缺少显式数值边界约束。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `moderatorId`：当前 `integer().notNull()`。注释：关联的版主ID。结论：保留。建议：维持当前定义。
- `targetId`：当前 `integer().notNull()`。注释：目标ID。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `actionType`：当前 `smallint().notNull()`。注释：操作类型（1=置顶主题, 2=取消置顶, 3=加精主题, 4=取消加精, 5=锁定主题, 6=解锁主题, 7=删除主题, 8=移动主题, 9=审核主题, 10=删除回复）。结论：保留。建议：维持当前定义。
- `targetType`：当前 `smallint().notNull()`。注释：目标类型（1=主题, 2=回复）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `actionDescription`：当前 `varchar({ length: 200 }).notNull()`。注释：操作描述。结论：保留。建议：维持当前定义。
- `beforeData`：当前 `text()`。注释：操作前数据（JSON格式）。结论：保留。建议：维持当前定义。
- `afterData`：当前 `text()`。注释：操作后数据（JSON格式）。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：操作时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `index("forum_moderator_action_log_moderator_id_idx").on(table.moderatorId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_moderator_action_log_action_type_idx").on(table.actionType)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_moderator_action_log_target_type_target_id_idx").on(table.targetType, table.targetId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_moderator_action_log_created_at_idx").on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `moderator`：`r.one.forumModerator({ from: r.forumModeratorActionLog.moderatorId, to: r.forumModerator.id, })`。from=`r.forumModeratorActionLog.moderatorId`，to=`r.forumModerator.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### forum_moderator_application（forumModeratorApplication）

- Schema 文件：`db/schema/forum/forum-moderator-application.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/forum.ts`
- 表注释：论坛版主申请表 - 管理用户申请成为版主的申请记录，包括申请信息、审核状态、审核结果等
- 重点结论：闭集语义字段未使用 smallint。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `applicantId`：当前 `integer().notNull()`。注释：申请人用户ID。结论：保留。建议：维持当前定义。
- `sectionId`：当前 `integer().notNull()`。注释：申请的板块ID。结论：保留。建议：维持当前定义。
- `auditById`：当前 `integer()`。注释：审核人ID。结论：保留。建议：维持当前定义。
- `status`：当前 `smallint().default(0).notNull()`。注释：申请状态（0=待审核, 1=已通过, 2=已拒绝）。结论：保留。建议：维持当前定义。
- `permissions`：当前 `integer().array().default(sql\`ARRAY[]::integer[]\`)`。注释：申请的权限数组（1=置顶, 2=加精, 3=锁定, 4=删除, 5=审核, 6=移动）。结论：闭集语义字段未使用 smallint。建议：改为 `smallint().array()`，并在注释中写清每个数值的含义。
- `reason`：当前 `varchar({ length: 500 }).notNull()`。注释：申请理由。结论：保留。建议：维持当前定义。
- `auditReason`：当前 `varchar({ length: 500 })`。注释：审核原因（通过或拒绝的原因）。结论：保留。建议：维持当前定义。
- `remark`：当前 `varchar({ length: 500 })`。注释：备注。结论：保留。建议：维持当前定义。
- `auditAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：审核时间。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。
- `deletedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：软删除时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("forum_moderator_application_applicant_id_section_id_key").on(table.applicantId, table.sectionId)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("forum_moderator_application_applicant_id_idx").on(table.applicantId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_moderator_application_section_id_idx").on(table.sectionId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_moderator_application_status_idx").on(table.status)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_moderator_application_audit_by_id_idx").on(table.auditById)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_moderator_application_created_at_idx").on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_moderator_application_deleted_at_idx").on(table.deletedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `applicant`：`r.one.appUser({ from: r.forumModeratorApplication.applicantId, to: r.appUser.id, alias: 'ModeratorApplicant', })`。from=`r.forumModeratorApplication.applicantId`，to=`r.appUser.id`，alias=`ModeratorApplicant` 结论：from/to 明确，属于单对象软关联。 alias=ModeratorApplicant，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `auditBy`：`r.one.appUser({ from: r.forumModeratorApplication.auditById, to: r.appUser.id, alias: 'ModeratorAuditor', })`。from=`r.forumModeratorApplication.auditById`，to=`r.appUser.id`，alias=`ModeratorAuditor` 结论：from/to 明确，属于单对象软关联。 alias=ModeratorAuditor，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `section`：`r.one.forumSection({ from: r.forumModeratorApplication.sectionId, to: r.forumSection.id, })`。from=`r.forumModeratorApplication.sectionId`，to=`r.forumSection.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### forum_moderator_section（forumModeratorSection）

- Schema 文件：`db/schema/forum/forum-moderator-section.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/forum.ts`
- 表注释：论坛版主板块关联表 - 管理板块版主与板块的多对多关系，一个板块版主可以管理多个板块
- 重点结论：闭集语义字段未使用 smallint。

#### 字段审查

- `moderatorId`：当前 `integer().notNull()`。注释：关联的版主ID。结论：保留。建议：维持当前定义。
- `sectionId`：当前 `integer().notNull()`。注释：关联的板块ID。结论：保留。建议：维持当前定义。
- `permissions`：当前 `integer().array().default(sql\`ARRAY[]::integer[]\`)`。注释：自定义权限数组（与版主基础权限做合并）。结论：闭集语义字段未使用 smallint。建议：改为 `smallint().array()`，并在注释中写清每个数值的含义。

#### 索引与约束审查

- `index("forum_moderator_section_section_id_idx").on(table.sectionId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `primaryKey({ columns: [table.moderatorId, table.sectionId] })`：主键定义明确，保持现状。

#### Relations 审查

- `moderator`：`r.one.forumModerator({ from: r.forumModeratorSection.moderatorId, to: r.forumModerator.id, })`。from=`r.forumModeratorSection.moderatorId`，to=`r.forumModerator.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `section`：`r.one.forumSection({ from: r.forumModeratorSection.sectionId, to: r.forumSection.id, })`。from=`r.forumModeratorSection.sectionId`，to=`r.forumSection.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### forum_section（forumSection）

- Schema 文件：`db/schema/forum/forum-section.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/forum.ts`
- 表注释：论坛板块表 - 管理论坛板块信息，包括板块名称、描述、统计信息等
- 重点结论：缺少显式数值边界约束；闭集语义字段未使用 smallint。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `groupId`：当前 `integer()`。注释：板块分组ID（可选，用于将板块分组管理）。结论：保留。建议：维持当前定义。
- `userLevelRuleId`：当前 `integer()`。注释：用户的论坛等级规则ID。结论：保留。建议：维持当前定义。
- `lastTopicId`：当前 `integer()`。注释：最后发表主题ID。结论：保留。建议：维持当前定义。
- `name`：当前 `varchar({ length: 100 }).notNull()`。注释：板块名称。结论：保留。建议：维持当前定义。
- `description`：当前 `varchar({ length: 500 })`。注释：板块描述。结论：保留。建议：维持当前定义。
- `icon`：当前 `varchar({ length: 500 }).notNull()`。注释：板块图标URL。结论：保留。建议：维持当前定义。
- `cover`：当前 `varchar({ length: 500 }).notNull()`。注释：板块封面URL。结论：保留。建议：维持当前定义。
- `sortOrder`：当前 `integer().default(0).notNull()`。注释：排序值（数值越小越靠前）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `isEnabled`：当前 `boolean().default(true).notNull()`。注释：是否启用。结论：保留。建议：维持当前定义。
- `topicReviewPolicy`：当前 `integer().default(1).notNull()`。注释：主题审核策略 （0：无需审核，1：触发严重敏感词时审核，2：触一般敏感词时审核，3：触发轻微敏感词时审核，4：强制人工审核）。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `remark`：当前 `varchar({ length: 500 })`。注释：备注信息。结论：保留。建议：维持当前定义。
- `topicCount`：当前 `integer().default(0).notNull()`。注释：主题数。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `commentCount`：当前 `integer().default(0).notNull()`。注释：评论数（包含所有可见主题下的评论）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `followersCount`：当前 `integer().default(0).notNull()`。注释：关注人数。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `lastPostAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：最后发表时间。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。
- `deletedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：软删除时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `index("forum_section_group_id_idx").on(table.groupId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_section_sort_order_idx").on(table.sortOrder)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_section_is_enabled_idx").on(table.isEnabled)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_section_topic_count_idx").on(table.topicCount)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_section_last_post_at_idx").on(table.lastPostAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_section_created_at_idx").on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_section_deleted_at_idx").on(table.deletedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `group`：`r.one.forumSectionGroup({ from: r.forumSection.groupId, to: r.forumSectionGroup.id, })`。from=`r.forumSection.groupId`，to=`r.forumSectionGroup.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `userLevelRule`：`r.one.userLevelRule({ from: r.forumSection.userLevelRuleId, to: r.userLevelRule.id, })`。from=`r.forumSection.userLevelRuleId`，to=`r.userLevelRule.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `lastTopic`：`r.one.forumTopic({ from: r.forumSection.lastTopicId, to: r.forumTopic.id, alias: 'LastTopic', })`。from=`r.forumSection.lastTopicId`，to=`r.forumTopic.id`，alias=`LastTopic` 结论：from/to 明确，属于单对象软关联。 alias=LastTopic，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `topics`：`r.many.forumTopic()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `moderatorSections`：`r.many.forumModeratorSection()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `moderators`：`r.many.forumModerator({ from: r.forumSection.id.through(r.forumModeratorSection.sectionId), to: r.forumModerator.id.through(r.forumModeratorSection.moderatorId), })`。from=`r.forumSection.id.through(r.forumModeratorSection.sectionId)`，to=`r.forumModerator.id.through(r.forumModeratorSection.moderatorId)` 结论：many 关系方向显式，便于排查多对多和自关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `applications`：`r.many.forumModeratorApplication()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `work`：`r.one.work({ from: r.forumSection.id, to: r.work.forumSectionId, })`。from=`r.forumSection.id`，to=`r.work.forumSectionId` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### forum_section_group（forumSectionGroup）

- Schema 文件：`db/schema/forum/forum-section-group.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/forum.ts`
- 表注释：论坛板块分组表 - 管理论坛板块分组信息，用于对板块进行分类组织
- 重点结论：缺少显式数值边界约束。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `name`：当前 `varchar({ length: 50 }).notNull()`。注释：分组名称。结论：保留。建议：维持当前定义。
- `description`：当前 `varchar({ length: 500 })`。注释：分组描述。结论：保留。建议：维持当前定义。
- `sortOrder`：当前 `integer().default(0).notNull()`。注释：排序值（数值越小越靠前）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `isEnabled`：当前 `boolean().default(true).notNull()`。注释：是否启用。结论：保留。建议：维持当前定义。
- `maxModerators`：当前 `integer().default(0).notNull()`。注释：分组版主数量限制（0表示不限制）。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。
- `deletedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：软删除时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("forum_section_group_name_key").on(table.name)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("forum_section_group_sort_order_idx").on(table.sortOrder)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_section_group_is_enabled_idx").on(table.isEnabled)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_section_group_created_at_idx").on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_section_group_deleted_at_idx").on(table.deletedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `sections`：`r.many.forumSection()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `moderators`：`r.many.forumModerator()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### forum_tag（forumTag）

- Schema 文件：`db/schema/forum/forum-tag.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/forum.ts`
- 表注释：论坛标签表 - 管理论坛标签信息，包括标签名称、图标、使用次数等
- 重点结论：缺少显式数值边界约束。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `name`：当前 `varchar({ length: 20 }).notNull()`。注释：标签名称。结论：保留。建议：维持当前定义。
- `icon`：当前 `varchar({ length: 255 })`。注释：标签图标URL。结论：保留。建议：维持当前定义。
- `description`：当前 `varchar({ length: 200 })`。注释：标签描述。结论：保留。建议：维持当前定义。
- `sortOrder`：当前 `smallint().default(0).notNull()`。注释：排序值（数值越小越靠前）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `isEnabled`：当前 `boolean().default(true).notNull()`。注释：是否启用。结论：保留。建议：维持当前定义。
- `useCount`：当前 `integer().default(0).notNull()`。注释：使用次数。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("forum_tag_name_key").on(table.name)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("forum_tag_sort_order_idx").on(table.sortOrder)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_tag_name_idx").on(table.name)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_tag_is_enabled_idx").on(table.isEnabled)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_tag_use_count_idx").on(table.useCount)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_tag_created_at_idx").on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `topicTags`：`r.many.forumTopicTag()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `topics`：`r.many.forumTopic({ from: r.forumTag.id.through(r.forumTopicTag.tagId), to: r.forumTopic.id.through(r.forumTopicTag.topicId), })`。from=`r.forumTag.id.through(r.forumTopicTag.tagId)`，to=`r.forumTopic.id.through(r.forumTopicTag.topicId)` 结论：many 关系方向显式，便于排查多对多和自关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### forum_topic（forumTopic）

- Schema 文件：`db/schema/forum/forum-topic.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/forum.ts`
- 表注释：论坛主题表
- 重点结论：smallint 字段注释未写清数值含义；闭集语义字段未使用 smallint。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `sectionId`：当前 `integer().notNull()`。注释：版块ID。结论：保留。建议：维持当前定义。
- `userId`：当前 `integer().notNull()`。注释：发帖用户ID。结论：保留。建议：维持当前定义。
- `lastCommentUserId`：当前 `integer()`。注释：最后评论用户ID。结论：保留。建议：维持当前定义。
- `auditById`：当前 `integer()`。注释：审核人ID。结论：保留。建议：维持当前定义。
- `title`：当前 `varchar({ length: 200 }).notNull()`。注释：标题。结论：保留。建议：维持当前定义。
- `content`：当前 `text().notNull()`。注释：内容。结论：保留。建议：维持当前定义。
- `bodyTokens`：当前 `jsonb()`。注释：正文解析 token 缓存 存储 EmojiParser 结果，供详情渲染直接使用。结论：保留。建议：维持当前定义。
- `images`：当前 `varchar({ length: 500 }).array().default(sql\`ARRAY[]::varchar[]\`).notNull()`。注释：图片列表。结论：保留。建议：维持当前定义。
- `videos`：当前 `varchar({ length: 500 }).array().default(sql\`ARRAY[]::varchar[]\`).notNull()`。注释：视频列表。结论：保留。建议：维持当前定义。
- `isPinned`：当前 `boolean().default(false).notNull()`。注释：是否置顶。结论：保留。建议：维持当前定义。
- `isFeatured`：当前 `boolean().default(false).notNull()`。注释：是否精选。结论：保留。建议：维持当前定义。
- `isLocked`：当前 `boolean().default(false).notNull()`。注释：是否锁定。结论：保留。建议：维持当前定义。
- `isHidden`：当前 `boolean().default(false).notNull()`。注释：是否隐藏。结论：保留。建议：维持当前定义。
- `auditStatus`：当前 `smallint().default(1).notNull()`。注释：审核状态。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `auditRole`：当前 `smallint()`。注释：审核角色。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `auditReason`：当前 `varchar({ length: 500 })`。注释：审核原因。结论：保留。建议：维持当前定义。
- `auditAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：审核时间。结论：保留。建议：维持当前定义。
- `version`：当前 `integer().default(0).notNull()`。注释：乐观锁版本号。结论：保留。建议：维持当前定义。
- `sensitiveWordHits`：当前 `jsonb()`。注释：敏感词命中记录。结论：保留。建议：维持当前定义。
- `geoCountry`：当前 `varchar({ length: 100 })`。注释：发帖时解析到的国家/地区 仅记录新写入主题的属地快照，无法解析或历史记录时为空。结论：保留。建议：维持当前定义。
- `geoProvince`：当前 `varchar({ length: 100 })`。注释：发帖时解析到的省份/州 仅记录新写入主题的属地快照，无法解析或历史记录时为空。结论：保留。建议：维持当前定义。
- `geoCity`：当前 `varchar({ length: 100 })`。注释：发帖时解析到的城市 仅记录新写入主题的属地快照，无法解析或历史记录时为空。结论：保留。建议：维持当前定义。
- `geoIsp`：当前 `varchar({ length: 100 })`。注释：发帖时解析到的网络运营商 仅记录新写入主题的属地快照，无法解析或历史记录时为空。结论：保留。建议：维持当前定义。
- `geoSource`：当前 `varchar({ length: 50 })`。注释：属地解析来源 当前固定为 ip2region；历史记录或未补齐属地快照时为空。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `viewCount`：当前 `integer().default(0).notNull()`。注释：浏览数。结论：保留。建议：维持当前定义。
- `likeCount`：当前 `integer().default(0).notNull()`。注释：点赞数。结论：保留。建议：维持当前定义。
- `commentCount`：当前 `integer().default(0).notNull()`。注释：评论数。结论：保留。建议：维持当前定义。
- `favoriteCount`：当前 `integer().default(0).notNull()`。注释：收藏数。结论：保留。建议：维持当前定义。
- `lastCommentAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：最后评论时间。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。
- `deletedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：删除时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `index("forum_topic_section_id_idx").on(table.sectionId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_topic_user_id_idx").on(table.userId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_topic_user_id_created_at_live_idx") .on(table.userId, table.createdAt.desc()) .where(sql\`${table.deletedAt} is null\`)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_topic_user_id_section_id_created_at_live_idx") .on(table.userId, table.sectionId, table.createdAt.desc()) .where(sql\`${table.deletedAt} is null\`)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_topic_is_pinned_created_at_idx").on(table.isPinned, table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_topic_is_featured_created_at_idx").on(table.isFeatured, table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_topic_is_locked_idx").on(table.isLocked)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_topic_is_hidden_idx").on(table.isHidden)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_topic_audit_status_idx").on(table.auditStatus)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_topic_view_count_idx").on(table.viewCount)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_topic_like_count_idx").on(table.likeCount)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_topic_comment_count_idx").on(table.commentCount)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_topic_favorite_count_idx").on(table.favoriteCount)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `check("forum_topic_view_count_non_negative_chk", sql\`${table.viewCount} >= 0\`)`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check("forum_topic_like_count_non_negative_chk", sql\`${table.likeCount} >= 0\`)`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check("forum_topic_comment_count_non_negative_chk", sql\`${table.commentCount} >= 0\`)`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check("forum_topic_favorite_count_non_negative_chk", sql\`${table.favoriteCount} >= 0\`)`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `index("forum_topic_last_comment_at_idx").on(table.lastCommentAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_topic_created_at_idx").on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_topic_updated_at_idx").on(table.updatedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_topic_deleted_at_idx").on(table.deletedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_topic_section_id_is_pinned_created_at_idx").on(table.sectionId, table.isPinned, table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_topic_section_id_is_featured_created_at_idx").on(table.sectionId, table.isFeatured, table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_topic_section_id_last_comment_at_idx").on(table.sectionId, table.lastCommentAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `section`：`r.one.forumSection({ from: r.forumTopic.sectionId, to: r.forumSection.id, })`。from=`r.forumTopic.sectionId`，to=`r.forumSection.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `user`：`r.one.appUser({ from: r.forumTopic.userId, to: r.appUser.id, alias: 'UserTopics', })`。from=`r.forumTopic.userId`，to=`r.appUser.id`，alias=`UserTopics` 结论：from/to 明确，属于单对象软关联。 alias=UserTopics，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `lastCommentUser`：`r.one.appUser({ from: r.forumTopic.lastCommentUserId, to: r.appUser.id, alias: 'UserLastCommentTopics', })`。from=`r.forumTopic.lastCommentUserId`，to=`r.appUser.id`，alias=`UserLastCommentTopics` 结论：from/to 明确，属于单对象软关联。 alias=UserLastCommentTopics，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `lastSections`：`r.many.forumSection({ from: r.forumTopic.id, to: r.forumSection.lastTopicId, alias: 'LastTopic', })`。from=`r.forumTopic.id`，to=`r.forumSection.lastTopicId`，alias=`LastTopic` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=LastTopic，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `topicTags`：`r.many.forumTopicTag()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `tags`：`r.many.forumTag({ from: r.forumTopic.id.through(r.forumTopicTag.topicId), to: r.forumTag.id.through(r.forumTopicTag.tagId), })`。from=`r.forumTopic.id.through(r.forumTopicTag.topicId)`，to=`r.forumTag.id.through(r.forumTopicTag.tagId)` 结论：many 关系方向显式，便于排查多对多和自关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### forum_topic_tag（forumTopicTag）

- Schema 文件：`db/schema/forum/forum-topic-tag.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/forum.ts`
- 表注释：论坛主题标签关联表 - 管理主题与标签的多对多关系
- 重点结论：当前未发现高优先级结构问题。

#### 字段审查

- `topicId`：当前 `integer().notNull()`。注释：关联的主题ID。结论：保留。建议：维持当前定义。
- `tagId`：当前 `integer().notNull()`。注释：关联的标签ID。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `index("forum_topic_tag_tag_id_created_at_idx").on(table.tagId, table.createdAt.desc())`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `primaryKey({ columns: [table.topicId, table.tagId] })`：主键定义明确，保持现状。

#### Relations 审查

- `tag`：`r.one.forumTag({ from: r.forumTopicTag.tagId, to: r.forumTag.id })`。from=`r.forumTopicTag.tagId`，to=`r.forumTag.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `topic`：`r.one.forumTopic({ from: r.forumTopicTag.topicId, to: r.forumTopic.id, })`。from=`r.forumTopicTag.topicId`，to=`r.forumTopic.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### forum_user_action_log（forumUserActionLog）

- Schema 文件：`db/schema/forum/forum-user-action-log.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/forum.ts`
- 表注释：论坛用户操作日志表 - 记录用户的所有操作行为，包括创建主题、评论、点赞、收藏等操作
- 重点结论：缺少显式数值边界约束；闭集语义字段未使用 smallint。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `userId`：当前 `integer().notNull()`。注释：关联的用户ID。结论：保留。建议：维持当前定义。
- `targetId`：当前 `integer().notNull()`。注释：目标ID。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `actionType`：当前 `smallint().notNull()`。注释：操作类型（1=创建主题, 2=创建评论, 3=点赞主题, 4=取消点赞主题, 5=点赞评论, 6=取消点赞评论, 7=收藏主题, 8=取消收藏主题, 9=更新主题, 10=更新评论, 11=删除主题, 12=删除评论）。结论：保留。建议：维持当前定义。
- `targetType`：当前 `smallint().notNull()`。注释：目标类型（1=主题, 2=评论）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `beforeData`：当前 `text()`。注释：操作前数据（JSON格式）。结论：保留。建议：维持当前定义。
- `afterData`：当前 `text()`。注释：操作后数据（JSON格式）。结论：保留。建议：维持当前定义。
- `ipAddress`：当前 `varchar({ length: 45 })`。注释：IP地址。结论：保留。建议：维持当前定义。
- `userAgent`：当前 `varchar({ length: 500 })`。注释：User Agent。结论：保留。建议：维持当前定义。
- `geoCountry`：当前 `varchar({ length: 100 })`。注释：操作发生时解析到的国家/地区 仅记录新写入操作日志的属地快照，无法解析或历史记录时为空。结论：保留。建议：维持当前定义。
- `geoProvince`：当前 `varchar({ length: 100 })`。注释：操作发生时解析到的省份/州 仅记录新写入操作日志的属地快照，无法解析或历史记录时为空。结论：保留。建议：维持当前定义。
- `geoCity`：当前 `varchar({ length: 100 })`。注释：操作发生时解析到的城市 仅记录新写入操作日志的属地快照，无法解析或历史记录时为空。结论：保留。建议：维持当前定义。
- `geoIsp`：当前 `varchar({ length: 100 })`。注释：操作发生时解析到的网络运营商 仅记录新写入操作日志的属地快照，无法解析或历史记录时为空。结论：保留。建议：维持当前定义。
- `geoSource`：当前 `varchar({ length: 50 })`。注释：属地解析来源 当前固定为 ip2region；历史记录或未补齐属地快照时为空。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：操作时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `index("forum_user_action_log_user_id_idx").on(table.userId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_user_action_log_action_type_idx").on(table.actionType)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_user_action_log_target_type_target_id_idx").on(table.targetType, table.targetId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_user_action_log_ip_address_idx").on(table.ipAddress)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_user_action_log_created_at_idx").on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("forum_user_action_log_user_id_created_at_idx").on(table.userId, table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `user`：`r.one.appUser({ from: r.forumUserActionLog.userId, to: r.appUser.id, })`。from=`r.forumUserActionLog.userId`，to=`r.appUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

## message 域

- 表数量：8
- 高风险项：6 张表存在结构性问题或缺失项。

### chat_conversation（chatConversation）

- Schema 文件：`db/schema/message/chat-conversation.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/message.ts`
- 表注释：聊天会话表（仅私聊）
- 重点结论：当前未发现高优先级结构问题。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `bizKey`：当前 `varchar({ length: 100 }).notNull()`。注释：业务键（direct:{minUserId}:{maxUserId}）。结论：保留。建议：维持当前定义。
- `lastMessageId`：当前 `bigint({ mode: "bigint" })`。注释：最后一条消息ID（快照字段）。结论：保留。建议：维持当前定义。
- `lastMessageAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：最后一条消息时间（快照字段）。结论：保留。建议：维持当前定义。
- `lastSenderId`：当前 `integer()`。注释：最后发言人ID（快照字段）。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("chat_conversation_biz_key_key").on(table.bizKey)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("chat_conversation_last_message_at_idx").on(table.lastMessageAt.desc())`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("chat_conversation_last_message_id_idx").on(table.lastMessageId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `lastMessage`：`r.one.chatMessage({ from: r.chatConversation.lastMessageId, to: r.chatMessage.id, alias: 'ChatConversationLastMessage', })`。from=`r.chatConversation.lastMessageId`，to=`r.chatMessage.id`，alias=`ChatConversationLastMessage` 结论：from/to 明确，属于单对象软关联。 alias=ChatConversationLastMessage，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `lastSender`：`r.one.appUser({ from: r.chatConversation.lastSenderId, to: r.appUser.id, alias: 'ChatConversationLastSender', })`。from=`r.chatConversation.lastSenderId`，to=`r.appUser.id`，alias=`ChatConversationLastSender` 结论：from/to 明确，属于单对象软关联。 alias=ChatConversationLastSender，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `conversationMembers`：`r.many.chatConversationMember()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `participants`：`r.many.appUser({ from: r.chatConversation.id.through( r.chatConversationMember.conversationId, ), to: r.appUser.id.through(r.chatConversationMember.userId), alias: 'ChatConversationParticipants', })`。from=`r.chatConversation.id.through( r.chatConversationMember.conversationId, )`，to=`r.appUser.id.through(r.chatConversationMember.userId)`，alias=`ChatConversationParticipants` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=ChatConversationParticipants，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `messages`：`r.many.chatMessage()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### chat_conversation_member（chatConversationMember）

- Schema 文件：`db/schema/message/chat-conversation-member.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/message.ts`
- 表注释：聊天会话成员表（仅私聊）
- 重点结论：缺少显式数值边界约束。

#### 字段审查

- `conversationId`：当前 `integer().notNull()`。注释：会话ID。结论：保留。建议：维持当前定义。
- `userId`：当前 `integer().notNull()`。注释：用户ID。结论：保留。建议：维持当前定义。
- `role`：当前 `smallint().notNull()`。注释：成员角色（1=会话所有者,2=普通成员）。结论：保留。建议：维持当前定义。
- `joinedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：加入时间。结论：保留。建议：维持当前定义。
- `leftAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：离开时间。结论：保留。建议：维持当前定义。
- `isMuted`：当前 `boolean().default(false).notNull()`。注释：是否静音。结论：保留。建议：维持当前定义。
- `lastReadMessageId`：当前 `bigint({ mode: "bigint" })`。注释：最后已读消息ID。结论：保留。建议：维持当前定义。
- `lastReadAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：最后已读时间。结论：保留。建议：维持当前定义。
- `unreadCount`：当前 `integer().default(0).notNull()`。注释：未读数缓存。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。

#### 索引与约束审查

- `index("chat_conversation_member_last_read_message_id_idx").on(table.lastReadMessageId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("chat_conversation_member_user_id_joined_at_idx").on(table.userId, table.joinedAt, table.conversationId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("chat_conversation_member_user_id_unread_count_conversation__idx").on(table.userId, table.unreadCount, table.conversationId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `primaryKey({ columns: [table.conversationId, table.userId] })`：主键定义明确，保持现状。

#### Relations 审查

- `conversation`：`r.one.chatConversation({ from: r.chatConversationMember.conversationId, to: r.chatConversation.id, })`。from=`r.chatConversationMember.conversationId`，to=`r.chatConversation.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `lastReadMessage`：`r.one.chatMessage({ from: r.chatConversationMember.lastReadMessageId, to: r.chatMessage.id, alias: 'ChatConversationMemberLastReadMessage', })`。from=`r.chatConversationMember.lastReadMessageId`，to=`r.chatMessage.id`，alias=`ChatConversationMemberLastReadMessage` 结论：from/to 明确，属于单对象软关联。 alias=ChatConversationMemberLastReadMessage，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `user`：`r.one.appUser({ from: r.chatConversationMember.userId, to: r.appUser.id, alias: 'ChatConversationMemberUser', })`。from=`r.chatConversationMember.userId`，to=`r.appUser.id`，alias=`ChatConversationMemberUser` 结论：from/to 明确，属于单对象软关联。 alias=ChatConversationMemberUser，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### chat_message（chatMessage）

- Schema 文件：`db/schema/message/chat-message.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/message.ts`
- 表注释：聊天消息表（仅私聊）
- 重点结论：当前未发现高优先级结构问题。

#### 字段审查

- `id`：当前 `bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `conversationId`：当前 `integer().notNull()`。注释：会话ID。结论：保留。建议：维持当前定义。
- `messageSeq`：当前 `bigint({ mode: "bigint" }).notNull()`。注释：会话内递增序号。结论：保留。建议：维持当前定义。
- `senderId`：当前 `integer().notNull()`。注释：发送用户ID。结论：保留。建议：维持当前定义。
- `clientMessageId`：当前 `varchar({ length: 64 })`。注释：客户端幂等键（同发送者同会话下唯一）。结论：保留。建议：维持当前定义。
- `messageType`：当前 `smallint().notNull()`。注释：消息类型（1=文本,2=图片,3=系统）。结论：保留。建议：维持当前定义。
- `content`：当前 `text().notNull()`。注释：文本内容。结论：保留。建议：维持当前定义。
- `bodyTokens`：当前 `jsonb()`。注释：正文解析 token 缓存 持久化 EmojiParser 输出，供消息渲染与回放使用。结论：保留。建议：维持当前定义。
- `payload`：当前 `jsonb()`。注释：扩展载荷。结论：保留。建议：维持当前定义。
- `status`：当前 `smallint().notNull()`。注释：消息状态（1=正常,2=撤回,3=删除）。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `editedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：编辑时间。结论：保留。建议：维持当前定义。
- `revokedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：撤回时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("chat_message_conversation_id_message_seq_key").on(table.conversationId, table.messageSeq)`：唯一性约束明确，字段类型调整后通常继续保留。
- `unique("chat_message_conversation_id_sender_id_client_message_id_key").on(table.conversationId, table.senderId, table.clientMessageId)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("chat_message_conversation_id_created_at_idx").on(table.conversationId, table.createdAt.desc())`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("chat_message_sender_id_created_at_idx").on(table.senderId, table.createdAt.desc())`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `conversation`：`r.one.chatConversation({ from: r.chatMessage.conversationId, to: r.chatConversation.id, })`。from=`r.chatMessage.conversationId`，to=`r.chatConversation.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `sender`：`r.one.appUser({ from: r.chatMessage.senderId, to: r.appUser.id, alias: 'ChatMessageSender', })`。from=`r.chatMessage.senderId`，to=`r.appUser.id`，alias=`ChatMessageSender` 结论：from/to 明确，属于单对象软关联。 alias=ChatMessageSender，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### message_ws_metric（messageWsMetric）

- Schema 文件：`db/schema/message/message-ws-metric.ts`
- 风格来源：legacy 自动转换
- 对应 relations：未定义
- 表注释：WebSocket 监控分钟聚合表
- 重点结论：缺少显式数值边界约束。

#### 字段审查

- `id`：当前 `bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `bucketAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).notNull()`。注释：统计桶时间（按分钟截断）。结论：保留。建议：维持当前定义。
- `requestCount`：当前 `integer().default(0).notNull()`。注释：WS 请求总数。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `ackSuccessCount`：当前 `integer().default(0).notNull()`。注释：ack 成功数量（code=0）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `ackErrorCount`：当前 `integer().default(0).notNull()`。注释：ack 失败数量（code!=0）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `ackLatencyTotalMs`：当前 `bigint({ mode: "bigint" }).default(0n).notNull()`。注释：ack 延迟累积毫秒。结论：保留。建议：维持当前定义。
- `reconnectCount`：当前 `integer().default(0).notNull()`。注释：连接/重连次数。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `resyncTriggerCount`：当前 `integer().default(0).notNull()`。注释：补偿触发次数（afterSeq 查询触发）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `resyncSuccessCount`：当前 `integer().default(0).notNull()`。注释：补偿成功次数（afterSeq 查询成功返回）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("message_ws_metric_bucket_at_key").on(table.bucketAt)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("message_ws_metric_bucket_at_idx").on(table.bucketAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- 当前未声明 soft relations。结论：表内关联字段只停留在列语义层。建议：若后续需要 Drizzle relational query，再补 `defineRelationsPart`，但仍不引入数据库 FK。

### notification_delivery（notificationDelivery）

- Schema 文件：`db/schema/message/notification-delivery.ts`
- 风格来源：手工建模 / 新增表
- 对应 relations：`db/relations/message.ts`
- 表注释：通知 consumer 处理结果表。 记录 notification consumer 对单条 dispatch 的最终业务处理结果。
- 重点结论：缺少字段注释；闭集语义字段未使用 smallint。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `eventId`：当前 `bigint({ mode: 'bigint' }).notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `dispatchId`：当前 `bigint({ mode: 'bigint' }).notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `eventKey`：当前 `varchar({ length: 120 }).notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `receiverUserId`：当前 `integer()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `projectionKey`：当前 `varchar({ length: 180 })`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `categoryKey`：当前 `varchar({ length: 80 })`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `notificationId`：当前 `integer()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `status`：当前 `varchar({ length: 32 }).notNull()`。注释：缺失。结论：缺少字段注释；闭集语义字段未使用 smallint。建议：补充字段注释，明确字段语义和取值约束。；改为 `smallint()`，并在注释中写清每个数值的含义。
- `templateId`：当前 `integer()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `usedTemplate`：当前 `boolean().default(false).notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `fallbackReason`：当前 `varchar({ length: 64 })`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `failureReason`：当前 `varchar({ length: 500 })`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `lastAttemptAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .defaultNow() .notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .$onUpdate(() => new Date()) .notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。

#### 索引与约束审查

- `unique('notification_delivery_dispatch_id_key').on(table.dispatchId)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index('notification_delivery_status_updated_at_idx').on( table.status, table.updatedAt.desc(), )`：涉及待改 `smallint` 字段，索引语义可以保留，但生成语句要跟随字段类型一起调整。
- `index('notification_delivery_receiver_user_id_updated_at_idx').on( table.receiverUserId, table.updatedAt.desc(), )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('notification_delivery_category_key_status_updated_at_idx').on( table.categoryKey, table.status, table.updatedAt.desc(), )`：涉及待改 `smallint` 字段，索引语义可以保留，但生成语句要跟随字段类型一起调整。
- `index('notification_delivery_event_id_idx').on(table.eventId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `receiverUser`：`r.one.appUser({ from: r.notificationDelivery.receiverUserId, to: r.appUser.id, })`。from=`r.notificationDelivery.receiverUserId`，to=`r.appUser.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `notification`：`r.one.userNotification({ from: r.notificationDelivery.notificationId, to: r.userNotification.id, })`。from=`r.notificationDelivery.notificationId`，to=`r.userNotification.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### notification_preference（notificationPreference）

- Schema 文件：`db/schema/message/notification-preference.ts`
- 风格来源：手工建模 / 新增表
- 对应 relations：`db/relations/message.ts`
- 表注释：通知偏好表。 只按用户与通知分类维度保存显式覆盖值。
- 重点结论：缺少字段注释。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `userId`：当前 `integer().notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `categoryKey`：当前 `varchar({ length: 80 }).notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `isEnabled`：当前 `boolean().notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。

#### 索引与约束审查

- `unique('notification_preference_user_id_category_key_key').on( table.userId, table.categoryKey, )`：唯一性约束明确，字段类型调整后通常继续保留。
- `index('notification_preference_user_id_idx').on(table.userId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('notification_preference_user_id_is_enabled_idx').on( table.userId, table.isEnabled, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `user`：`r.one.appUser({ from: r.notificationPreference.userId, to: r.appUser.id, alias: 'NotificationPreferenceUser', })`。from=`r.notificationPreference.userId`，to=`r.appUser.id`，alias=`NotificationPreferenceUser` 结论：from/to 明确，属于单对象软关联。 alias=NotificationPreferenceUser，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### notification_template（notificationTemplate）

- Schema 文件：`db/schema/message/notification-template.ts`
- 风格来源：手工建模 / 新增表
- 对应 relations：`db/relations/message.ts`
- 表注释：通知模板表。 以 categoryKey 为唯一稳定配置键。
- 重点结论：缺少字段注释。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `categoryKey`：当前 `varchar({ length: 80 }).notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `titleTemplate`：当前 `varchar({ length: 200 }).notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `contentTemplate`：当前 `varchar({ length: 1000 }).notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `isEnabled`：当前 `boolean().default(true).notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `remark`：当前 `varchar({ length: 500 })`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。

#### 索引与约束审查

- `unique('notification_template_category_key_key').on(table.categoryKey)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index('notification_template_category_key_idx').on(table.categoryKey)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('notification_template_is_enabled_idx').on(table.isEnabled)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('notification_template_updated_at_idx').on(table.updatedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `db/relations/message.ts` 中存在空关系块。结论：当前未声明可用关系。建议：仅在实际查询需要时补充，避免无效关系配置。

### user_notification（userNotification）

- Schema 文件：`db/schema/message/user-notification.ts`
- 风格来源：手工建模 / 新增表
- 对应 relations：`db/relations/message.ts`
- 表注释：用户通知投影表。 只承载通知中心对用户可见的读模型，不再承担 producer 侧通知类型事实源职责。
- 重点结论：缺少字段注释。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `categoryKey`：当前 `varchar({ length: 80 }).notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `projectionKey`：当前 `varchar({ length: 180 }).notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `receiverUserId`：当前 `integer().notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `actorUserId`：当前 `integer()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `title`：当前 `varchar({ length: 200 }).notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `content`：当前 `varchar({ length: 1000 }).notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `payload`：当前 `jsonb()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `isRead`：当前 `boolean().default(false).notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `readAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `expiresAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .defaultNow() .notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .$onUpdate(() => new Date()) .notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。

#### 索引与约束审查

- `unique('user_notification_receiver_user_id_projection_key_key').on( table.receiverUserId, table.projectionKey, )`：唯一性约束明确，字段类型调整后通常继续保留。
- `index('user_notification_receiver_user_id_is_read_created_at_idx').on( table.receiverUserId, table.isRead, table.createdAt.desc(), )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('user_notification_receiver_user_id_category_key_created_at_idx').on( table.receiverUserId, table.categoryKey, table.createdAt.desc(), )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('user_notification_receiver_user_id_created_at_idx').on( table.receiverUserId, table.createdAt.desc(), )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('user_notification_receiver_user_id_expires_at_idx').on( table.receiverUserId, table.expiresAt, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `user`：`r.one.appUser({ from: r.userNotification.receiverUserId, to: r.appUser.id, alias: 'UserNotificationReceiver', })`。from=`r.userNotification.receiverUserId`，to=`r.appUser.id`，alias=`UserNotificationReceiver` 结论：from/to 明确，属于单对象软关联。 alias=UserNotificationReceiver，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `actorUser`：`r.one.appUser({ from: r.userNotification.actorUserId, to: r.appUser.id, alias: 'UserNotificationActor', })`。from=`r.userNotification.actorUserId`，to=`r.appUser.id`，alias=`UserNotificationActor` 结论：from/to 明确，属于单对象软关联。 alias=UserNotificationActor，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `deliveryRecords`：`r.many.notificationDelivery({ from: r.userNotification.id, to: r.notificationDelivery.notificationId, })`。from=`r.userNotification.id`，to=`r.notificationDelivery.notificationId` 结论：many 关系方向显式，便于排查多对多和自关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

## system 域

- 表数量：7
- 高风险项：4 张表存在结构性问题或缺失项。

### domain_event（domainEvent）

- Schema 文件：`db/schema/system/domain-event.ts`
- 风格来源：手工建模 / 新增表
- 对应 relations：`db/relations/system.ts`
- 表注释：通用领域事件表。 只存放“发生了什么”的事实，不存放按 consumer 拆开的处理状态。
- 重点结论：缺少字段注释；闭集语义字段未使用 smallint；缺少显式数值边界约束。

#### 字段审查

- `id`：当前 `bigint({ mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `eventKey`：当前 `varchar({ length: 120 }).notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `domain`：当前 `varchar({ length: 40 }).notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `subjectType`：当前 `varchar({ length: 40 }).notNull()`。注释：缺失。结论：缺少字段注释；闭集语义字段未使用 smallint。建议：补充字段注释，明确字段语义和取值约束。；改为 `smallint()`，并在注释中写清每个数值的含义。
- `subjectId`：当前 `integer().notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `targetType`：当前 `varchar({ length: 40 }).notNull()`。注释：缺失。结论：缺少字段注释；闭集语义字段未使用 smallint。建议：补充字段注释，明确字段语义和取值约束。；改为 `smallint()`，并在注释中写清每个数值的含义。
- `targetId`：当前 `integer().notNull()`。注释：缺失。结论：缺少字段注释；缺少显式数值边界约束。建议：补充字段注释，明确字段语义和取值约束。；结合业务语义补充 `check(...)`，明确非负或正数边界。
- `operatorId`：当前 `integer()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `occurredAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `context`：当前 `jsonb()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .defaultNow() .notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。

#### 索引与约束审查

- `index('domain_event_event_key_created_at_idx').on( table.eventKey, table.createdAt.desc(), )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('domain_event_domain_occurred_at_idx').on( table.domain, table.occurredAt.desc(), )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('domain_event_subject_type_subject_id_idx').on( table.subjectType, table.subjectId, )`：涉及待改 `smallint` 字段，索引语义可以保留，但生成语句要跟随字段类型一起调整。
- `index('domain_event_target_type_target_id_idx').on( table.targetType, table.targetId, )`：涉及待改 `smallint` 字段，索引语义可以保留，但生成语句要跟随字段类型一起调整。

#### Relations 审查

- `dispatches`：`r.many.domainEventDispatch()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### domain_event_dispatch（domainEventDispatch）

- Schema 文件：`db/schema/system/domain-event-dispatch.ts`
- 风格来源：手工建模 / 新增表
- 对应 relations：`db/relations/system.ts`
- 表注释：通用领域事件分发表。 一条领域事件会按 consumer 拆分成多条 dispatch 记录，分别追踪处理状态。
- 重点结论：缺少字段注释；闭集语义字段未使用 smallint；缺少显式数值边界约束。

#### 字段审查

- `id`：当前 `bigint({ mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `eventId`：当前 `bigint({ mode: 'bigint' }).notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `consumer`：当前 `varchar({ length: 40 }).notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `status`：当前 `varchar({ length: 24 }).default('pending').notNull()`。注释：缺失。结论：缺少字段注释；闭集语义字段未使用 smallint。建议：补充字段注释，明确字段语义和取值约束。；改为 `smallint()`，并在注释中写清每个数值的含义。
- `retryCount`：当前 `integer().default(0).notNull()`。注释：缺失。结论：缺少字段注释；缺少显式数值边界约束。建议：补充字段注释，明确字段语义和取值约束。；结合业务语义补充 `check(...)`，明确非负或正数边界。
- `nextRetryAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `lastError`：当前 `varchar({ length: 500 })`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `processedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .defaultNow() .notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .$onUpdate(() => new Date()) .notNull()`。注释：缺失。结论：缺少字段注释。建议：补充字段注释，明确字段语义和取值约束。

#### 索引与约束审查

- `unique('domain_event_dispatch_event_id_consumer_key').on( table.eventId, table.consumer, )`：唯一性约束明确，字段类型调整后通常继续保留。
- `index('domain_event_dispatch_consumer_status_next_retry_at_id_idx').on( table.consumer, table.status, table.nextRetryAt, table.id, )`：涉及待改 `smallint` 字段，索引语义可以保留，但生成语句要跟随字段类型一起调整。
- `index('domain_event_dispatch_event_id_idx').on(table.eventId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `event`：`r.one.domainEvent({ from: r.domainEventDispatch.eventId, to: r.domainEvent.id, })`。from=`r.domainEventDispatch.eventId`，to=`r.domainEvent.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### sensitive_word（sensitiveWord）

- Schema 文件：`db/schema/system/sensitive-word.ts`
- 风格来源：legacy 自动转换
- 对应 relations：未定义
- 表注释：通用敏感词表 - 存储敏感词信息，用于内容过滤和审核
- 重点结论：缺少显式数值边界约束。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `word`：当前 `varchar({ length: 100 }).notNull()`。注释：敏感词。结论：保留。建议：维持当前定义。
- `replaceWord`：当前 `varchar({ length: 100 })`。注释：替换词。结论：保留。建议：维持当前定义。
- `level`：当前 `smallint().default(2).notNull()`。注释：敏感词级别（1=严重, 2=一般, 3=轻微）。结论：保留。建议：维持当前定义。
- `type`：当前 `smallint().default(5).notNull()`。注释：敏感词类型（1=政治, 2=色情, 3=暴力, 4=广告, 5=其他）。结论：保留。建议：维持当前定义。
- `matchMode`：当前 `smallint().default(1).notNull()`。注释：匹配模式（1=精确匹配, 2=模糊匹配, 3=正则匹配）。结论：保留。建议：维持当前定义。
- `isEnabled`：当前 `boolean().default(true).notNull()`。注释：是否启用。结论：保留。建议：维持当前定义。
- `version`：当前 `integer().default(0).notNull()`。注释：版本号（用于乐观锁）。结论：保留。建议：维持当前定义。
- `remark`：当前 `varchar({ length: 500 })`。注释：备注。结论：保留。建议：维持当前定义。
- `createdBy`：当前 `integer()`。注释：创建人ID。结论：保留。建议：维持当前定义。
- `updatedBy`：当前 `integer()`。注释：更新人ID。结论：保留。建议：维持当前定义。
- `hitCount`：当前 `integer().default(0).notNull()`。注释：命中次数。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `lastHitAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：最后命中时间。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("sensitive_word_word_key").on(table.word)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("sensitive_word_word_idx").on(table.word)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("sensitive_word_type_idx").on(table.type)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("sensitive_word_level_idx").on(table.level)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("sensitive_word_is_enabled_idx").on(table.isEnabled)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("sensitive_word_match_mode_idx").on(table.matchMode)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("sensitive_word_created_at_idx").on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- 当前未声明 soft relations。结论：表内关联字段只停留在列语义层。建议：若后续需要 Drizzle relational query，再补 `defineRelationsPart`，但仍不引入数据库 FK。

### sys_config（systemConfig）

- Schema 文件：`db/schema/system/system-config.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/system.ts`
- 表注释：系统配置
- 重点结论：当前未发现高优先级结构问题。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键id。结论：保留。建议：维持当前定义。
- `updatedById`：当前 `integer()`。注释：最后修改人ID。结论：保留。建议：维持当前定义。
- `aliyunConfig`：当前 `jsonb()`。注释：阿里云配置（JSON格式，包含 accessKeyId/accessKeySecret）。结论：保留。建议：维持当前定义。
- `siteConfig`：当前 `jsonb()`。注释：站点基础配置（JSON格式，名称/描述/关键词/Logo等）。结论：保留。建议：维持当前定义。
- `maintenanceConfig`：当前 `jsonb()`。注释：维护模式配置（JSON格式，开关与提示文案）。结论：保留。建议：维持当前定义。
- `contentReviewPolicy`：当前 `jsonb()`。注释：内容审核策略（JSON格式，敏感词等级处理策略）。结论：保留。建议：维持当前定义。
- `uploadConfig`：当前 `jsonb()`。注释：上传配置（JSON格式，包含 provider/七牛/Superbed 配置）。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `index("sys_config_updated_by_id_idx").on(table.updatedById)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("sys_config_created_at_idx").on(table.createdAt.desc())`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `updatedBy`：`r.one.adminUser({ from: r.systemConfig.updatedById, to: r.adminUser.id, alias: 'SystemConfigUpdater', })`。from=`r.systemConfig.updatedById`，to=`r.adminUser.id`，alias=`SystemConfigUpdater` 结论：from/to 明确，属于单对象软关联。 alias=SystemConfigUpdater，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### sys_dictionary（dictionary）

- Schema 文件：`db/schema/system/system-dictionary.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/system.ts`
- 表注释：数据字典
- 重点结论：当前未发现高优先级结构问题。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `name`：当前 `varchar({ length: 50 }).notNull()`。注释：字典名称。结论：保留。建议：维持当前定义。
- `code`：当前 `varchar({ length: 50 }).notNull()`。注释：字典编码。结论：保留。建议：维持当前定义。
- `cover`：当前 `varchar({ length: 200 })`。注释：字典封面图片URL。结论：保留。建议：维持当前定义。
- `isEnabled`：当前 `boolean().default(true).notNull()`。注释：字典状态：true=启用，false=禁用。结论：保留。建议：维持当前定义。
- `description`：当前 `varchar({ length: 255 })`。注释：字典描述信息。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("sys_dictionary_name_key").on(table.name)`：唯一性约束明确，字段类型调整后通常继续保留。
- `unique("sys_dictionary_code_key").on(table.code)`：唯一性约束明确，字段类型调整后通常继续保留。

#### Relations 审查

- `dictionaryItems`：`r.many.dictionaryItem()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### sys_dictionary_item（dictionaryItem）

- Schema 文件：`db/schema/system/system-dictionary.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/system.ts`
- 表注释：数据字典项
- 重点结论：当前未发现高优先级结构问题。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `dictionaryCode`：当前 `text().notNull()`。注释：所属字典编码。结论：保留。建议：维持当前定义。
- `name`：当前 `varchar({ length: 50 }).notNull()`。注释：字典项名称。结论：保留。建议：维持当前定义。
- `code`：当前 `varchar({ length: 50 }).notNull()`。注释：字典项编码。结论：保留。建议：维持当前定义。
- `sortOrder`：当前 `smallserial()`。注释：显示排序（数值越小越靠前）。结论：保留。建议：维持当前定义。
- `cover`：当前 `varchar({ length: 200 })`。注释：字典项图标URL。结论：保留。建议：维持当前定义。
- `isEnabled`：当前 `boolean().default(true).notNull()`。注释：字典项状态：true=启用，false=禁用。结论：保留。建议：维持当前定义。
- `description`：当前 `varchar({ length: 255 })`。注释：字典项描述信息。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("sys_dictionary_item_dictionary_code_code_key").on(table.dictionaryCode, table.code)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("sys_dictionary_item_dictionary_code_idx").on(table.dictionaryCode)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("sys_dictionary_item_sort_order_idx").on(table.sortOrder)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `parentDictionary`：`r.one.dictionary({ from: r.dictionaryItem.dictionaryCode, to: r.dictionary.code, })`。from=`r.dictionaryItem.dictionaryCode`，to=`r.dictionary.code` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### sys_request_log（requestLog）

- Schema 文件：`db/schema/system/request-log.ts`
- 风格来源：legacy 自动转换
- 对应 relations：未定义
- 表注释：请求日志
- 重点结论：闭集语义字段未使用 smallint。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键id。结论：保留。建议：维持当前定义。
- `userId`：当前 `integer()`。注释：用户ID（可空）。结论：保留。建议：维持当前定义。
- `username`：当前 `text()`。注释：用户名（可空）。结论：保留。建议：维持当前定义。
- `apiType`：当前 `varchar({ length: 20 })`。注释：接口类型（admin/app/system等，可空）。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `method`：当前 `varchar({ length: 10 }).notNull()`。注释：请求方法（GET/POST等）。结论：保留。建议：维持当前定义。
- `path`：当前 `varchar({ length: 255 }).notNull()`。注释：请求路径。结论：保留。建议：维持当前定义。
- `params`：当前 `jsonb()`。注释：请求参数（JSON格式）。结论：保留。建议：维持当前定义。
- `ip`：当前 `varchar({ length: 45 })`。注释：IP地址（自动获取）。结论：保留。建议：维持当前定义。
- `userAgent`：当前 `varchar({ length: 255 })`。注释：设备信息（User-Agent 原始字符串）。结论：保留。建议：维持当前定义。
- `device`：当前 `jsonb()`。注释：设备信息（User-Agent 解析结果，JSON）。结论：保留。建议：维持当前定义。
- `geoCountry`：当前 `varchar({ length: 100 })`。注释：请求发起时解析到的国家/地区 仅记录新写入请求日志的属地快照，无法解析或历史记录时为空。结论：保留。建议：维持当前定义。
- `geoProvince`：当前 `varchar({ length: 100 })`。注释：请求发起时解析到的省份/州 仅记录新写入请求日志的属地快照，无法解析或历史记录时为空。结论：保留。建议：维持当前定义。
- `geoCity`：当前 `varchar({ length: 100 })`。注释：请求发起时解析到的城市 仅记录新写入请求日志的属地快照，无法解析或历史记录时为空。结论：保留。建议：维持当前定义。
- `geoIsp`：当前 `varchar({ length: 100 })`。注释：请求发起时解析到的网络运营商 仅记录新写入请求日志的属地快照，无法解析或历史记录时为空。结论：保留。建议：维持当前定义。
- `geoSource`：当前 `varchar({ length: 50 })`。注释：属地解析来源 当前固定为 ip2region；历史记录或未补齐属地快照时为空。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `actionType`：当前 `varchar({ length: 50 })`。注释：操作类型（如登录/注册）。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `isSuccess`：当前 `boolean().notNull()`。注释：操作结果。结论：保留。建议：维持当前定义。
- `content`：当前 `text().notNull()`。注释：自定义日志内容（必填）。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `index("sys_request_log_created_at_idx").on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("sys_request_log_user_id_idx").on(table.userId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("sys_request_log_username_idx").on(table.username)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("sys_request_log_is_success_idx").on(table.isSuccess)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- 当前未声明 soft relations。结论：表内关联字段只停留在列语义层。建议：若后续需要 Drizzle relational query，再补 `defineRelationsPart`，但仍不引入数据库 FK。

## work 域

- 表数量：11
- 高风险项：9 张表存在结构性问题或缺失项。

### work（work）

- Schema 文件：`db/schema/work/work.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/work.ts`
- 表注释：作品表 统一存储漫画与小说的基础信息
- 重点结论：smallint 字段注释未写清数值含义；闭集语义字段未使用 smallint；缺少显式数值边界约束。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `type`：当前 `smallint().notNull()`。注释：作品类型 (1=漫画, 2 =小说)。结论：保留。建议：维持当前定义。
- `name`：当前 `varchar({ length: 80 }).notNull()`。注释：作品名称。结论：保留。建议：维持当前定义。
- `alias`：当前 `varchar({ length: 200 })`。注释：别名。结论：保留。建议：维持当前定义。
- `cover`：当前 `varchar({ length: 500 }).notNull()`。注释：封面。结论：保留。建议：维持当前定义。
- `description`：当前 `text().notNull()`。注释：简介。结论：保留。建议：维持当前定义。
- `language`：当前 `varchar({ length: 10 }).notNull()`。注释：语言。结论：保留。建议：维持当前定义。
- `region`：当前 `varchar({ length: 10 }).notNull()`。注释：地区。结论：保留。建议：维持当前定义。
- `ageRating`：当前 `varchar({ length: 10 })`。注释：年龄分级。结论：保留。建议：维持当前定义。
- `serialStatus`：当前 `smallint().default(0).notNull()`。注释：连载状态。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `publisher`：当前 `varchar({ length: 100 })`。注释：出版方。结论：保留。建议：维持当前定义。
- `originalSource`：当前 `varchar({ length: 100 })`。注释：原作来源。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `copyright`：当前 `varchar({ length: 500 })`。注释：版权信息。结论：保留。建议：维持当前定义。
- `disclaimer`：当前 `text()`。注释：免责声明。结论：保留。建议：维持当前定义。
- `remark`：当前 `varchar({ length: 1000 })`。注释：备注。结论：保留。建议：维持当前定义。
- `isPublished`：当前 `boolean().default(true).notNull()`。注释：是否发布。结论：保留。建议：维持当前定义。
- `isRecommended`：当前 `boolean().default(false).notNull()`。注释：是否推荐。结论：保留。建议：维持当前定义。
- `isHot`：当前 `boolean().default(false).notNull()`。注释：是否热门。结论：保留。建议：维持当前定义。
- `isNew`：当前 `boolean().default(false).notNull()`。注释：是否最新。结论：保留。建议：维持当前定义。
- `publishAt`：当前 `date()`。注释：发布日期。结论：保留。建议：维持当前定义。
- `lastUpdated`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：最近更新时间。结论：保留。建议：维持当前定义。
- `viewRule`：当前 `smallint().default(0).notNull()`。注释：阅读规则。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `requiredViewLevelId`：当前 `integer()`。注释：阅读等级限制ID。结论：保留。建议：维持当前定义。
- `forumSectionId`：当前 `integer("forum_section_id")`。注释：关联论坛板块ID。结论：保留。建议：维持当前定义。
- `chapterPrice`：当前 `integer().default(0).notNull()`。注释：章节价格。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `canComment`：当前 `boolean().default(true).notNull()`。注释：是否可评论。结论：保留。建议：维持当前定义。
- `recommendWeight`：当前 `doublePrecision().default(1.0).notNull()`。注释：推荐权重。结论：保留。建议：维持当前定义。
- `viewCount`：当前 `integer().default(0).notNull()`。注释：浏览数。结论：保留。建议：维持当前定义。
- `favoriteCount`：当前 `integer().default(0).notNull()`。注释：收藏数。结论：保留。建议：维持当前定义。
- `likeCount`：当前 `integer().default(0).notNull()`。注释：点赞数。结论：保留。建议：维持当前定义。
- `commentCount`：当前 `integer().default(0).notNull()`。注释：评论数。结论：保留。建议：维持当前定义。
- `downloadCount`：当前 `integer().default(0).notNull()`。注释：下载数。结论：保留。建议：维持当前定义。
- `rating`：当前 `doublePrecision()`。注释：评分。结论：保留。建议：维持当前定义。
- `popularity`：当前 `integer().default(0).notNull()`。注释：热度值。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。
- `deletedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：删除时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `index("work_is_published_publish_at_idx").on(table.isPublished, table.publishAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_popularity_idx").on(table.popularity)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_language_region_idx").on(table.language, table.region)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_serial_status_idx").on(table.serialStatus)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_last_updated_idx").on(table.lastUpdated)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_name_idx").on(table.name)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_is_recommended_idx").on(table.isRecommended)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_is_hot_is_new_idx").on(table.isHot, table.isNew)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_type_idx").on(table.type)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_view_rule_idx").on(table.viewRule)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_required_view_level_id_idx").on(table.requiredViewLevelId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_forum_section_id_idx").on(table.forumSectionId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `unique("work_forum_section_id_key").on(table.forumSectionId)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("work_comment_count_idx").on(table.commentCount)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `check("work_view_count_non_negative_chk", sql\`${table.viewCount} >= 0\`)`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check("work_favorite_count_non_negative_chk", sql\`${table.favoriteCount} >= 0\`)`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check("work_like_count_non_negative_chk", sql\`${table.likeCount} >= 0\`)`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check("work_comment_count_non_negative_chk", sql\`${table.commentCount} >= 0\`)`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check("work_download_count_non_negative_chk", sql\`${table.downloadCount} >= 0\`)`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `index("work_deleted_at_idx").on(table.deletedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `comic`：`r.one.workComic({ from: r.work.id, to: r.workComic.workId, })`。from=`r.work.id`，to=`r.workComic.workId` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `novel`：`r.one.workNovel({ from: r.work.id, to: r.workNovel.workId, })`。from=`r.work.id`，to=`r.workNovel.workId` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `authorRelations`：`r.many.workAuthorRelation()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `authors`：`r.many.workAuthor({ from: r.work.id.through(r.workAuthorRelation.workId), to: r.workAuthor.id.through(r.workAuthorRelation.authorId), })`。from=`r.work.id.through(r.workAuthorRelation.workId)`，to=`r.workAuthor.id.through(r.workAuthorRelation.authorId)` 结论：many 关系方向显式，便于排查多对多和自关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `categoryRelations`：`r.many.workCategoryRelation()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `categories`：`r.many.workCategory({ from: r.work.id.through(r.workCategoryRelation.workId), to: r.workCategory.id.through(r.workCategoryRelation.categoryId), })`。from=`r.work.id.through(r.workCategoryRelation.workId)`，to=`r.workCategory.id.through(r.workCategoryRelation.categoryId)` 结论：many 关系方向显式，便于排查多对多和自关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `tagRelations`：`r.many.workTagRelation()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `tags`：`r.many.workTag({ from: r.work.id.through(r.workTagRelation.workId), to: r.workTag.id.through(r.workTagRelation.tagId), })`。from=`r.work.id.through(r.workTagRelation.workId)`，to=`r.workTag.id.through(r.workTagRelation.tagId)` 结论：many 关系方向显式，便于排查多对多和自关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `chapters`：`r.many.workChapter()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `comicArchiveImportTasks`：`r.many.workComicArchiveImportTask({ from: r.work.id, to: r.workComicArchiveImportTask.workId, })`。from=`r.work.id`，to=`r.workComicArchiveImportTask.workId` 结论：many 关系方向显式，便于排查多对多和自关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `userReadingStates`：`r.many.userWorkReadingState({ from: r.work.id, to: r.userWorkReadingState.workId, })`。from=`r.work.id`，to=`r.userWorkReadingState.workId` 结论：many 关系方向显式，便于排查多对多和自关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `requiredViewLevel`：`r.one.userLevelRule({ from: r.work.requiredViewLevelId, to: r.userLevelRule.id, alias: 'WorkViewLevel', })`。from=`r.work.requiredViewLevelId`，to=`r.userLevelRule.id`，alias=`WorkViewLevel` 结论：from/to 明确，属于单对象软关联。 alias=WorkViewLevel，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `forumSection`：`r.one.forumSection({ from: r.work.forumSectionId, to: r.forumSection.id, })`。from=`r.work.forumSectionId`，to=`r.forumSection.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### work_author（workAuthor）

- Schema 文件：`db/schema/work/work-author.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/work.ts`
- 表注释：作者信息模型
- 重点结论：缺少显式数值边界约束。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `name`：当前 `varchar({ length: 100 }).notNull()`。注释：作者姓名。结论：保留。建议：维持当前定义。
- `avatar`：当前 `varchar({ length: 500 })`。注释：作者头像URL。结论：保留。建议：维持当前定义。
- `description`：当前 `varchar({ length: 1000 })`。注释：作者描述。结论：保留。建议：维持当前定义。
- `nationality`：当前 `varchar({ length: 50 })`。注释：国籍。结论：保留。建议：维持当前定义。
- `gender`：当前 `smallint().default(0).notNull()`。注释：性别（0: 未知, 1: 男性, 2: 女性, 3: 其他）。结论：保留。建议：维持当前定义。
- `type`：当前 `smallint().array()`。注释：作者类型（1: 漫画家, 2: 轻小说作者）。结论：保留。建议：维持当前定义。
- `isEnabled`：当前 `boolean().default(true).notNull()`。注释：启用状态（true: 启用, false: 禁用）。结论：保留。建议：维持当前定义。
- `isRecommended`：当前 `boolean().default(false).notNull()`。注释：是否为推荐作者（用于前台推荐展示）。结论：保留。建议：维持当前定义。
- `remark`：当前 `varchar({ length: 1000 })`。注释：管理员备注。结论：保留。建议：维持当前定义。
- `workCount`：当前 `integer().default(0).notNull()`。注释：作品数量（冗余字段，用于提升查询性能）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `followersCount`：当前 `integer().default(0).notNull()`。注释：粉丝数量（冗余字段，用于前台展示）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。
- `deletedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：软删除时间（用于数据恢复或归档）。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("work_author_name_key").on(table.name)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("work_author_type_idx").using("gin", table.type)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_author_is_enabled_idx").on(table.isEnabled)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_author_is_enabled_is_recommended_idx").on(table.isEnabled, table.isRecommended)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_author_is_enabled_deleted_at_idx").on(table.isEnabled, table.deletedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_author_deleted_at_idx").on(table.deletedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_author_nationality_idx").on(table.nationality)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_author_gender_idx").on(table.gender)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_author_is_recommended_work_count_idx").on(table.isRecommended, table.workCount.desc())`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_author_created_at_idx").on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `workRelations`：`r.many.workAuthorRelation()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `works`：`r.many.work({ from: r.workAuthor.id.through(r.workAuthorRelation.authorId), to: r.work.id.through(r.workAuthorRelation.workId), })`。from=`r.workAuthor.id.through(r.workAuthorRelation.authorId)`，to=`r.work.id.through(r.workAuthorRelation.workId)` 结论：many 关系方向显式，便于排查多对多和自关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### work_author_relation（workAuthorRelation）

- Schema 文件：`db/schema/work/work-author-relation.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/work.ts`
- 表注释：作品作者关联表（多对多关系中间表）
- 重点结论：缺少显式数值边界约束。

#### 字段审查

- `workId`：当前 `integer().notNull()`。注释：作品ID。结论：保留。建议：维持当前定义。
- `authorId`：当前 `integer().notNull()`。注释：作者ID。结论：保留。建议：维持当前定义。
- `sortOrder`：当前 `integer().default(0).notNull()`。注释：排序顺序（用于展示顺序）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。

#### 索引与约束审查

- `index("work_author_relation_author_id_idx").on(table.authorId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_author_relation_work_id_sort_order_idx").on(table.workId, table.sortOrder)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `primaryKey({ columns: [table.workId, table.authorId] })`：主键定义明确，保持现状。

#### Relations 审查

- `work`：`r.one.work({ from: r.workAuthorRelation.workId, to: r.work.id })`。from=`r.workAuthorRelation.workId`，to=`r.work.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `author`：`r.one.workAuthor({ from: r.workAuthorRelation.authorId, to: r.workAuthor.id, })`。from=`r.workAuthorRelation.authorId`，to=`r.workAuthor.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### work_category（workCategory）

- Schema 文件：`db/schema/work/work-category.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/work.ts`
- 表注释：作品分类模型
- 重点结论：smallint 字段注释未写清数值含义；缺少显式数值边界约束。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `name`：当前 `varchar({ length: 20 }).notNull()`。注释：分类名称（唯一）。结论：保留。建议：维持当前定义。
- `description`：当前 `varchar({ length: 200 })`。注释：分类描述。结论：保留。建议：维持当前定义。
- `icon`：当前 `varchar({ length: 255 })`。注释：分类图标URL。结论：保留。建议：维持当前定义。
- `contentType`：当前 `smallint().array()`。注释：关联内容类型（如：1漫画、2小说、4插画、8写真）。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `sortOrder`：当前 `smallint().default(0).notNull()`。注释：排序值（数值越小越靠前）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `isEnabled`：当前 `boolean().default(true).notNull()`。注释：是否启用。结论：保留。建议：维持当前定义。
- `popularity`：当前 `integer().default(0).notNull()`。注释：人气值（用于展示和排序）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("work_category_name_key").on(table.name)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("work_category_sort_order_idx").on(table.sortOrder)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_category_name_idx").on(table.name)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_category_content_type_idx").using("gin", table.contentType)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `workRelations`：`r.many.workCategoryRelation()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `works`：`r.many.work({ from: r.workCategory.id.through(r.workCategoryRelation.categoryId), to: r.work.id.through(r.workCategoryRelation.workId), })`。from=`r.workCategory.id.through(r.workCategoryRelation.categoryId)`，to=`r.work.id.through(r.workCategoryRelation.workId)` 结论：many 关系方向显式，便于排查多对多和自关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### work_category_relation（workCategoryRelation）

- Schema 文件：`db/schema/work/work-category-relation.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/work.ts`
- 表注释：作品分类关联表
- 重点结论：缺少显式数值边界约束。

#### 字段审查

- `workId`：当前 `integer().notNull()`。注释：作品ID。结论：保留。建议：维持当前定义。
- `categoryId`：当前 `integer().notNull()`。注释：分类ID。结论：保留。建议：维持当前定义。
- `sortOrder`：当前 `integer().default(0).notNull()`。注释：排序顺序（用于展示顺序）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。

#### 索引与约束审查

- `index("work_category_relation_category_id_idx").on(table.categoryId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_category_relation_work_id_sort_order_idx").on(table.workId, table.sortOrder)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `primaryKey({ columns: [table.workId, table.categoryId] })`：主键定义明确，保持现状。

#### Relations 审查

- `work`：`r.one.work({ from: r.workCategoryRelation.workId, to: r.work.id })`。from=`r.workCategoryRelation.workId`，to=`r.work.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `category`：`r.one.workCategory({ from: r.workCategoryRelation.categoryId, to: r.workCategory.id, })`。from=`r.workCategoryRelation.categoryId`，to=`r.workCategory.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### work_chapter（workChapter）

- Schema 文件：`db/schema/work/work-chapter.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/work.ts`
- 表注释：作品章节表 存储漫画/小说章节信息与统计数据
- 重点结论：smallint 字段注释未写清数值含义；缺少显式数值边界约束。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `workId`：当前 `integer().notNull()`。注释：作品ID。结论：保留。建议：维持当前定义。
- `workType`：当前 `smallint().notNull()`。注释：作品类型。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `title`：当前 `varchar({ length: 100 }).notNull()`。注释：章节标题。结论：保留。建议：维持当前定义。
- `subtitle`：当前 `varchar({ length: 200 })`。注释：章节副标题。结论：保留。建议：维持当前定义。
- `cover`：当前 `varchar({ length: 500 })`。注释：章节封面。结论：保留。建议：维持当前定义。
- `description`：当前 `varchar({ length: 1000 })`。注释：章节简介。结论：保留。建议：维持当前定义。
- `sortOrder`：当前 `integer().default(0).notNull()`。注释：排序值。结论：保留。建议：维持当前定义。
- `isPublished`：当前 `boolean().default(false).notNull()`。注释：是否发布。结论：保留。建议：维持当前定义。
- `isPreview`：当前 `boolean().default(false).notNull()`。注释：是否预览章节。结论：保留。建议：维持当前定义。
- `publishAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：发布时间。结论：保留。建议：维持当前定义。
- `viewRule`：当前 `smallint().default(-1).notNull()`。注释：阅读规则。结论：smallint 字段注释未写清数值含义。建议：在注释中补齐每个数值对应的业务语义。
- `requiredViewLevelId`：当前 `integer('required_read_level_id')`。注释：阅读等级限制ID。结论：保留。建议：维持当前定义。
- `price`：当前 `integer().default(0).notNull()`。注释：章节价格。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `canDownload`：当前 `boolean().default(true).notNull()`。注释：是否可下载。结论：保留。建议：维持当前定义。
- `canComment`：当前 `boolean().default(true).notNull()`。注释：是否可评论。结论：保留。建议：维持当前定义。
- `content`：当前 `text()`。注释：章节内容。结论：保留。建议：维持当前定义。
- `wordCount`：当前 `integer().default(0).notNull()`。注释：字数。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `viewCount`：当前 `integer().default(0).notNull()`。注释：浏览数。结论：保留。建议：维持当前定义。
- `likeCount`：当前 `integer().default(0).notNull()`。注释：点赞数。结论：保留。建议：维持当前定义。
- `commentCount`：当前 `integer().default(0).notNull()`。注释：评论数。结论：保留。建议：维持当前定义。
- `purchaseCount`：当前 `integer().default(0).notNull()`。注释：购买数。结论：保留。建议：维持当前定义。
- `downloadCount`：当前 `integer().default(0).notNull()`。注释：下载数。结论：保留。建议：维持当前定义。
- `remark`：当前 `varchar({ length: 1000 })`。注释：备注。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .defaultNow() .notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }) .$onUpdate(() => new Date()) .notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。
- `deletedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：删除时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `uniqueIndex('work_chapter_work_id_sort_order_live_idx').on( table.workId, table.sortOrder, ).where(sql\`${table.deletedAt} is null\`)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index('work_chapter_deleted_at_idx').on(table.deletedAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('work_chapter_work_id_idx').on(table.workId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('work_chapter_work_id_sort_order_idx').on( table.workId, table.sortOrder, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('work_chapter_is_published_publish_at_idx').on( table.isPublished, table.publishAt, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('work_chapter_view_rule_idx').on(table.viewRule)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('work_chapter_is_preview_idx').on(table.isPreview)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('work_chapter_view_count_idx').on(table.viewCount)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('work_chapter_like_count_idx').on(table.likeCount)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('work_chapter_created_at_idx').on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('work_chapter_publish_at_idx').on(table.publishAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('work_chapter_required_read_level_id_idx').on( table.requiredViewLevelId, )`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('work_chapter_work_type_idx').on(table.workType)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `check('work_chapter_view_count_non_negative_chk', sql\`${table.viewCount} >= 0\`)`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check('work_chapter_like_count_non_negative_chk', sql\`${table.likeCount} >= 0\`)`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check('work_chapter_comment_count_non_negative_chk', sql\`${table.commentCount} >= 0\`)`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check('work_chapter_purchase_count_non_negative_chk', sql\`${table.purchaseCount} >= 0\`)`：检查约束能表达业务边界，建议保留并补齐缺失字段。
- `check('work_chapter_download_count_non_negative_chk', sql\`${table.downloadCount} >= 0\`)`：检查约束能表达业务边界，建议保留并补齐缺失字段。

#### Relations 审查

- `work`：`r.one.work({ from: r.workChapter.workId, to: r.work.id })`。from=`r.workChapter.workId`，to=`r.work.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `requiredViewLevel`：`r.one.userLevelRule({ from: r.workChapter.requiredViewLevelId, to: r.userLevelRule.id, alias: 'ChapterReadLevel', })`。from=`r.workChapter.requiredViewLevelId`，to=`r.userLevelRule.id`，alias=`ChapterReadLevel` 结论：from/to 明确，属于单对象软关联。 alias=ChapterReadLevel，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `readingStates`：`r.many.userWorkReadingState({ from: r.workChapter.id, to: r.userWorkReadingState.lastReadChapterId, alias: 'UserWorkReadingStateLastReadChapter', })`。from=`r.workChapter.id`，to=`r.userWorkReadingState.lastReadChapterId`，alias=`UserWorkReadingStateLastReadChapter` 结论：many 关系方向显式，便于排查多对多和自关联。 alias=UserWorkReadingStateLastReadChapter，多重关系歧义已消除。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### work_comic（workComic）

- Schema 文件：`db/schema/work/work-comic.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/work.ts`
- 表注释：漫画作品扩展表
- 重点结论：当前未发现高优先级结构问题。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键id。结论：保留。建议：维持当前定义。
- `workId`：当前 `integer().notNull()`。注释：关联的作品ID。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("work_comic_work_id_key").on(table.workId)`：唯一性约束明确，字段类型调整后通常继续保留。

#### Relations 审查

- `work`：`r.one.work({ from: r.workComic.workId, to: r.work.id })`。from=`r.workComic.workId`，to=`r.work.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### work_comic_archive_import_task（workComicArchiveImportTask）

- Schema 文件：`db/schema/work/work-comic-archive-import-task.ts`
- 风格来源：手工建模 / 新增表
- 对应 relations：`db/relations/work.ts`
- 表注释：漫画压缩包导入任务表。 统一持久化预解析草稿、用户确认结果和后台导入执行状态。
- 重点结论：闭集语义字段未使用 smallint。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。。结论：保留。建议：维持当前定义。
- `taskId`：当前 `varchar({ length: 36 }).notNull()`。注释：对外暴露的任务ID。。结论：保留。建议：维持当前定义。
- `workId`：当前 `integer().notNull()`。注释：关联作品ID。。结论：保留。建议：维持当前定义。
- `mode`：当前 `varchar({ length: 32 }).notNull()`。注释：预解析模式。。结论：保留。建议：维持当前定义。
- `status`：当前 `varchar({ length: 32 }).notNull()`。注释：当前任务状态。。结论：闭集语义字段未使用 smallint。建议：改为 `smallint()`，并在注释中写清每个数值的含义。
- `archiveName`：当前 `varchar({ length: 255 }).notNull()`。注释：原始压缩包文件名。。结论：保留。建议：维持当前定义。
- `archivePath`：当前 `varchar({ length: 1000 }).notNull()`。注释：原始压缩包本地存储路径。。结论：保留。建议：维持当前定义。
- `extractPath`：当前 `varchar({ length: 1000 }).notNull()`。注释：解压目录本地路径。。结论：保留。建议：维持当前定义。
- `requireConfirm`：当前 `boolean().default(true).notNull()`。注释：是否需要前端确认。。结论：保留。建议：维持当前定义。
- `summary`：当前 `jsonb().notNull()`。注释：预解析汇总结果。。结论：保留。建议：维持当前定义。
- `matchedItems`：当前 `jsonb().notNull()`。注释：章节匹配结果。。结论：保留。建议：维持当前定义。
- `ignoredItems`：当前 `jsonb().notNull()`。注释：预解析忽略项。。结论：保留。建议：维持当前定义。
- `resultItems`：当前 `jsonb().notNull()`。注释：正式导入结果。。结论：保留。建议：维持当前定义。
- `confirmedChapterIds`：当前 `jsonb().notNull()`。注释：用户确认的章节ID列表。。结论：保留。建议：维持当前定义。
- `startedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：后台开始处理时间。。结论：保留。建议：维持当前定义。
- `finishedAt`：当前 `timestamp({ withTimezone: true, precision: 6 })`。注释：后台完成处理时间。。结论：保留。建议：维持当前定义。
- `expiresAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).notNull()`。注释：草稿任务过期时间。。结论：保留。建议：维持当前定义。
- `lastError`：当前 `text()`。注释：最近一次错误信息。。结论：保留。建议：维持当前定义。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique('work_comic_archive_import_task_task_id_key').on(table.taskId)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index('work_comic_archive_import_task_work_id_idx').on(table.workId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('work_comic_archive_import_task_status_idx').on(table.status)`：涉及待改 `smallint` 字段，索引语义可以保留，但生成语句要跟随字段类型一起调整。
- `index('work_comic_archive_import_task_status_expires_at_idx').on( table.status, table.expiresAt, )`：涉及待改 `smallint` 字段，索引语义可以保留，但生成语句要跟随字段类型一起调整。
- `index('work_comic_archive_import_task_expires_at_idx').on(table.expiresAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index('work_comic_archive_import_task_created_at_idx').on(table.createdAt)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `work`：`r.one.work({ from: r.workComicArchiveImportTask.workId, to: r.work.id, })`。from=`r.workComicArchiveImportTask.workId`，to=`r.work.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### work_novel（workNovel）

- Schema 文件：`db/schema/work/work-novel.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/work.ts`
- 表注释：小说作品扩展表
- 重点结论：缺少显式数值边界约束。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键id。结论：保留。建议：维持当前定义。
- `workId`：当前 `integer().notNull()`。注释：关联的作品ID。结论：保留。建议：维持当前定义。
- `wordCount`：当前 `integer().default(0).notNull()`。注释：总字数。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("work_novel_work_id_key").on(table.workId)`：唯一性约束明确，字段类型调整后通常继续保留。

#### Relations 审查

- `work`：`r.one.work({ from: r.workNovel.workId, to: r.work.id })`。from=`r.workNovel.workId`，to=`r.work.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### work_tag（workTag）

- Schema 文件：`db/schema/work/work-tag.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/work.ts`
- 表注释：标签模型
- 重点结论：缺少显式数值边界约束。

#### 字段审查

- `id`：当前 `integer().primaryKey().generatedAlwaysAsIdentity()`。注释：主键ID。结论：保留。建议：维持当前定义。
- `name`：当前 `varchar({ length: 20 }).notNull()`。注释：标签名称（唯一）。结论：保留。建议：维持当前定义。
- `icon`：当前 `varchar({ length: 255 })`。注释：标签图标URL。结论：保留。建议：维持当前定义。
- `description`：当前 `varchar({ length: 200 })`。注释：标签描述。结论：保留。建议：维持当前定义。
- `sortOrder`：当前 `smallint().default(0).notNull()`。注释：排序值（数值越小越靠前）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `isEnabled`：当前 `boolean().default(true).notNull()`。注释：是否启用。结论：保留。建议：维持当前定义。
- `popularity`：当前 `integer().default(0).notNull()`。注释：人气值（用于展示和排序）。结论：缺少显式数值边界约束。建议：结合业务语义补充 `check(...)`，明确非负或正数边界。
- `createdAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull()`。注释：创建时间。结论：保留。建议：维持当前定义。
- `updatedAt`：当前 `timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull()`。注释：更新时间。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `unique("work_tag_name_key").on(table.name)`：唯一性约束明确，字段类型调整后通常继续保留。
- `index("work_tag_sort_order_idx").on(table.sortOrder)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_tag_name_idx").on(table.name)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `index("work_tag_is_enabled_idx").on(table.isEnabled)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。

#### Relations 审查

- `workRelations`：`r.many.workTagRelation()`。未声明额外选项。 结论：many 关系依赖对端字段推断，Drizzle 允许这种写法。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `works`：`r.many.work({ from: r.workTag.id.through(r.workTagRelation.tagId), to: r.work.id.through(r.workTagRelation.workId), })`。from=`r.workTag.id.through(r.workTagRelation.tagId)`，to=`r.work.id.through(r.workTagRelation.workId)` 结论：many 关系方向显式，便于排查多对多和自关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

### work_tag_relation（workTagRelation）

- Schema 文件：`db/schema/work/work-tag-relation.ts`
- 风格来源：legacy 自动转换
- 对应 relations：`db/relations/work.ts`
- 表注释：作品标签关联表
- 重点结论：当前未发现高优先级结构问题。

#### 字段审查

- `workId`：当前 `integer().notNull()`。注释：作品ID。结论：保留。建议：维持当前定义。
- `tagId`：当前 `integer().notNull()`。注释：标签ID。结论：保留。建议：维持当前定义。

#### 索引与约束审查

- `index("work_tag_relation_tag_id_idx").on(table.tagId)`：索引命名和声明方式符合 Drizzle 习惯，按查询路径继续保留。
- `primaryKey({ columns: [table.workId, table.tagId] })`：主键定义明确，保持现状。

#### Relations 审查

- `work`：`r.one.work({ from: r.workTagRelation.workId, to: r.work.id })`。from=`r.workTagRelation.workId`，to=`r.work.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。
- `tag`：`r.one.workTag({ from: r.workTagRelation.tagId, to: r.workTag.id })`。from=`r.workTagRelation.tagId`，to=`r.workTag.id` 结论：from/to 明确，属于单对象软关联。 按当前约束要求，保持应用层 soft relation，不引入数据库 FK。

## Relations 聚合文件审查

- 文件：`db/relations/index.ts`
- 当前实现：`import { adminRelations } from './admin' import { appRelations } from './app' import { forumRelations } from './forum' import { messageRelations } from './message' import { systemRelations } from './system' import { workRelations } from './work' export const relations = { ...adminRelations, ...appRelations, ...forumRelations, ...messageRelations, ...systemRelations, ...workRelations, }`
- 结论：以对象展开方式聚合 `admin/app/forum/message/system/work` 六个关系分片，顺序稳定，符合 `defineRelationsPart` 的使用方式。
- 建议：后续若新增域关系文件，继续在此处显式接入；不要把缺省空对象放在后面覆盖已有表关系。

## 收尾建议

- 先处理所有“闭集语义字段未使用 `smallint`”的表，再补注释，再统一索引/约束。
- 处理字段类型时，同步调整对应 relations 中的 `from/to` 描述和依赖这些字段的索引、`check` 约束。
- 对 legacy 自动转换表，建议在后续真实改造时顺带统一注释风格和字段精度，减少新旧建模方式混杂。
