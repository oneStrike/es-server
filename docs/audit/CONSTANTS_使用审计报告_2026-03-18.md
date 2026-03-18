# 常量使用审计报告

审计日期：2026-03-18

## 1. 审计范围与方法

- 审计范围：当前仓库内全部 `*.constant.ts` 文件，共 `40` 个文件。
- 导出符号：共识别 `96` 个导出项，包含 `const`、`enum`、`interface`、`function` 以及同名重导出。
- 引用统计：基于当前源码中的命名导入做静态扫描，排除了 `.history`、`node_modules`、`dist`、`coverage`、`.next`。
- 统计口径说明：
  - “引用数”表示外部文件的命名导入次数，不代表运行时反射、字符串访问或同文件内部使用。
  - 同名重导出场景下，纯计数会天然有歧义；本报告对高风险项做了手工复核。

## 2. 总体结论

当前项目的常量体系并不是“全面失控”，大部分常量文件仍然保持了“按模块就近定义，DTO/Service 就近消费”的基本结构，例如：

- `libs/config/src/system-config/system-config.constant.ts`
- `libs/forum/src/config/forum-config-cache.constant.ts`
- `libs/message/src/outbox/outbox.constant.ts`
- `libs/message/src/chat/chat.constant.ts`

但是，当前常量体系已经出现 4 类明显的规范问题：

1. 单一事实源被破坏：同一业务概念存在重复定义，甚至同名但不同语义。
2. 常量文件出现“同名重导出/包装层”，导致定义位置和消费位置脱节。
3. 命名规则与文件职责不一致，增加理解成本。
4. 已经存在一批“当前无外部命名导入”的常量文件或导出项，公共面暴露偏大。

本次审计的关键数字如下：

- 重名导出组：`0` 组
- 显式 `export { ... } from ...` 重导出链：`0` 处
- 整文件当前无外部命名导入：`0` 个
- 当前无外部命名导入的导出项：`0` 个

## 2.1 整改状态更新

- 状态：`已完成`
- 完成时间：`2026-03-18`
- 已将 `AdminUserRoleEnum` 收敛到平台唯一事实源：`libs/platform/src/constant/user.constant.ts`
- 已删除管理端重复定义文件：`apps/admin-api/src/modules/admin-user/admin-user.constant.ts`
- 已删除历史遗留文件：`libs/platform/src/constant/business.constant.ts`
- 已移除重复且未使用的导出：`libs/platform/src/constant/content.constant.ts` 中的 `BusinessModuleEnum`
- 已将作品场景恢复为精确子集建模：`WorkTypeEnum` 现位于 `libs/platform/src/constant/content.constant.ts`，并直接复用 `ContentTypeEnum` 的取值
- 已将作品类 DTO/调用点切回 `WorkTypeEnum`，避免把 `TOPIC` 暴露到作品场景
- 已删除同名重导出常量文件：`libs/forum/src/topic/forum-topic.constant.ts`、`libs/forum/src/section/forum-section.constant.ts`、`libs/growth/src/experience/experience.constant.ts`、`libs/growth/src/point/point.constant.ts`
- 已将论坛与 Growth 的消费方统一改为直接使用 source/barrel，不再经过 `*.constant.ts` 包装层
- 已将 Auth 包装层收敛为“仅保留本端私有常量”，不再重导出 `AuthConstants` / `AuthDefaultValue`
- 已将本地 Auth 私有常量改为上下文命名：`AdminAuthCacheKeys`、`AdminAuthRedisKeys`、`AppAuthRedisKeys`
- 已完成一轮命名统一：`ActionTypeEnum -> AuditActionTypeEnum`、`LoggerLevel -> LoggerLevelEnum`、`PLATFORMS -> COMIC_THIRD_PARTY_PLATFORMS`
- 已完成一轮职责拆分：`createAuthRedisKeys` 已迁移到 `libs/platform/src/modules/auth/auth.helpers.ts`；`response-dto.constant.ts` 已拆分为 `response-dto.metadata.ts` 与 `response-dto.decorator.ts`
- 已统一认证错误文案命名：平台共享层改为 `AuthErrorMessages`，应用端私有错误文案改为 `AppAuthErrorMessages`
- 已完成第四阶段清理：删除 `libs/platform/src/constant/sort.constant.ts`，并移除全部 `0` 外部命名导入导出项
- `RevokeTokenReasonEnum` 已接入密码重置、刷新令牌轮换、主动登出和过期清理链路
- `LoggerLevelEnum` 已改为 logger 模块内部直接依赖，不再通过 `@libs/platform/constant` barrel 对外暴露
- 当前统一结论：内容域常量统一收敛在 `content.constant.ts`，其中 `ContentTypeEnum` 负责顶层内容分类，`WorkTypeEnum` 负责作品子集分类
- 当前统计：`40` 个常量文件、`96` 个导出项、`0` 组重名导出、`0` 处显式重导出链
- 校验结果：`pnpm type-check` 已通过

## 3. 关键问题

### 3.1 已完成：`AdminUserRoleEnum` 完全重复定义，且调用方已经混用来源

原重复定义位置：

- `apps/admin-api/src/modules/admin-user/admin-user.constant.ts`
- `libs/platform/src/constant/user.constant.ts:47`

两处定义内容一致，均为：

- `NORMAL_ADMIN = 0`
- `SUPER_ADMIN = 1`

原调用方混用情况：

- DTO 从平台层导入：`apps/admin-api/src/modules/admin-user/dto/admin-user.dto.ts:1`
- Service 从本地模块导入：`apps/admin-api/src/modules/admin-user/admin-user.service.ts`
- 另一个 Service 也从本地模块导入：`apps/admin-api/src/modules/app-user/app-user.service.ts`

判断：

- 这是当前最典型的“重复定义 + 使用混乱”案例。
- 该常量应只保留一个事实源；建议保留平台层或 admin 模块层中的一个，另一处删除。

整改结果：

- 已按“全局平台概念”处理，只保留 `libs/platform/src/constant/user.constant.ts` 中的 `AdminUserRoleEnum`
- `apps/admin-api/src/modules/admin-user/admin-user.service.ts` 已改为从平台层导入
- `apps/admin-api/src/modules/app-user/app-user.service.ts` 已改为从平台层导入
- 管理端本地重复定义文件已删除

### 3.2 已完成：`BusinessModuleEnum` 同名但不同语义，属于高风险设计

定义一：

- `libs/platform/src/constant/business.constant.ts:1`
- 含义：`WORK = 1`、`FORUM = 2`

定义二：

- 原位于 `libs/platform/src/constant/content.constant.ts`
- 含义：`COMIC = 1`、`NOVEL = 2`、`FORUM = 3`

问题点：

- 名称完全一样，但语义层级不同。
- 第一份更像“业务域枚举”，第二份更像“内容子类型枚举”。
- `business.constant.ts` 当前没有任何外部命名导入，也没有被 `libs/platform/src/constant/index.ts` 暴露，极像遗留文件。

判断：

- 这是“同名不同义”的典型坏味道，比普通重复定义更危险。
- 后续一旦有人按名字搜索并复用，极易引入错误映射。

整改结果：

- 已删除 `libs/platform/src/constant/business.constant.ts`
- 已从 `libs/platform/src/constant/content.constant.ts` 移除未使用的 `BusinessModuleEnum`
- 已将 `WorkTypeEnum` 保留为 `content.constant.ts` 内的作品子集枚举，并复用 `ContentTypeEnum` 的数值来源

说明：

- 这次没有恢复到“两个文件各自定义同类常量”的旧结构，而是把内容域常量集中到一个文件中
- `ContentTypeEnum` 与 `WorkTypeEnum` 现在是“顶层分类 / 作品子集”的关系，不再是“两个文件、两套事实源”的关系

### 3.3 已完成：多个常量文件的“同名重导出”已全部清理

整改结果：

- 已删除论坛与 Growth 中仅用于转发的 wrapper 常量文件，`*.constant.ts -> *.constant.ts` 的同名重导出链已清零
- `libs/forum/src/section/dto/forum-section.dto.ts` 已直接改为从 `libs/forum/src/config/forum-config.constant.ts` 导入 `ForumReviewPolicyEnum`
- Auth 共享常量已统一直接从 `libs/platform/src/modules/auth/auth.constant.ts` 消费，本地文件只保留管理端/应用端私有常量
- 本轮清理后，常量文件之间的重名导出组已降为 `0`

#### A. 论坛审核常量

源定义：

- `libs/platform/src/constant/audit.constant.ts:10`
- `libs/platform/src/constant/audit.constant.ts:32`

重导出：

- `libs/forum/src/topic/forum-topic.constant.ts:5`

实际消费却直接走平台层：

- `libs/forum/src/topic/dto/forum-topic.dto.ts:1`
- `libs/forum/src/topic/forum-topic.service.ts:4`

结论：

- `forum-topic.constant.ts` 名称看起来像“主题专属常量”，实际上只是平台审核枚举的别名层。
- 这会让调用方误以为论坛主题拥有自己的审核枚举。

整改结果：

- 已删除 `libs/forum/src/topic/forum-topic.constant.ts`
- `libs/forum/src/topic/index.ts` 已移除该文件的对外导出
- 论坛主题相关审核枚举继续统一从平台层导入

#### B. 论坛审核策略常量

源定义：

- `libs/forum/src/config/forum-config.constant.ts:80`

重导出：

- `libs/forum/src/section/forum-section.constant.ts:5`

调用方已混用来源：

- `libs/forum/src/section/dto/forum-section.dto.ts:14` 从 `forum-section.constant` 导入
- `libs/forum/src/topic/forum-topic.service.ts:22` 从 `forum-config.constant` 导入

结论：

- 同一个枚举在两个入口被消费，已经构成来源分叉。

整改结果：

- 已删除 `libs/forum/src/section/forum-section.constant.ts`
- `libs/forum/src/section/index.ts` 已移除该文件的对外导出
- `libs/forum/src/section/dto/forum-section.dto.ts` 已改为直接从 `../config/forum-config.constant` 的真实定义处导入

#### C. Growth 规则类型

源定义：

- `libs/growth/src/growth-rule.constant.ts:4`

重导出：

- `libs/growth/src/experience/experience.constant.ts:6`
- `libs/growth/src/point/point.constant.ts:2`

更复杂的是，`libs/growth/src/index.ts:1-8` 同时导出了：

- `./growth-rule.constant`
- `./experience`
- `./point`

而 `experience/index.ts:3` 与 `point/index.ts:4` 又继续把这些常量导出出去。

实际消费则并不统一：

- `libs/growth/src/experience/dto/experience-rule.dto.ts:14` 直接导入 `../../growth-rule.constant`
- `libs/growth/src/point/dto/point-rule.dto.ts:14` 直接导入 `../../growth-rule.constant`
- `libs/growth/src/growth-reward/growth-reward.service.ts:8` 直接导入 `../growth-rule.constant`
- 其他模块又从 `@libs/growth` 导入，例如 `libs/interaction/src/comment/comment.constant.ts:1`

结论：

- `experience.constant.ts` 与 `point.constant.ts` 本质上只是别名层，不是它们各自真正拥有的常量。
- 这类设计最容易让 barrel 导出边界变模糊。

整改结果：

- 已删除 `libs/growth/src/experience/experience.constant.ts`
- 已删除 `libs/growth/src/point/point.constant.ts`
- `libs/growth/src/experience/index.ts` 与 `libs/growth/src/point/index.ts` 已移除对应出口
- Growth 规则类型当前只保留 `libs/growth/src/growth-rule.constant.ts` 这一事实源，并继续通过 `libs/growth/src/index.ts` 对外暴露

#### D. Auth 常量包装层

共享源定义：

- `libs/platform/src/modules/auth/auth.constant.ts:10`
- `libs/platform/src/modules/auth/auth.constant.ts:22`
- `libs/platform/src/modules/auth/auth.constant.ts:34`

管理端包装层：

- `apps/admin-api/src/modules/auth/auth.constant.ts:4`
- `apps/admin-api/src/modules/auth/auth.constant.ts:12`
- `apps/admin-api/src/modules/auth/auth.constant.ts:15`

应用端包装层：

- `apps/app-api/src/modules/auth/auth.constant.ts:5`
- `apps/app-api/src/modules/auth/auth.constant.ts:11`
- `apps/app-api/src/modules/auth/auth.constant.ts:13`

实际消费混用：

- 管理端服务从本地包装层导入：`apps/admin-api/src/modules/auth/auth.service.ts:17`
- 应用端服务从本地包装层导入：`apps/app-api/src/modules/auth/auth.service.ts:14`
- 身份会话服务直接从平台共享层导入：`libs/identity/src/session.service.ts:4`

结论：

- `AuthConstants`、`AuthDefaultValue` 在“平台共享层”和“应用包装层”同名存在，阅读时无法一眼确认来源。
- 这类包装层可以存在，但不应继续使用与共享源完全相同的导出名。

整改结果：

- `apps/admin-api/src/modules/auth/auth.constant.ts` 已不再重导出 `AuthConstants`
- `apps/app-api/src/modules/auth/auth.constant.ts` 已不再重导出 `AuthConstants`、`AuthDefaultValue`
- 管理端服务与应用端服务已直接从平台层导入共享常量
- 管理端私有常量已更名为 `AdminAuthCacheKeys`、`AdminAuthRedisKeys`
- 应用端私有常量已更名为 `AppAuthRedisKeys`

### 3.4 中优先级：存在多套“目标类型枚举”，概念重叠明显

典型文件：

- `libs/platform/src/constant/interaction.constant.ts`
- `libs/interaction/src/comment/comment.constant.ts`
- `libs/interaction/src/browse-log/browse-log.constant.ts`
- `libs/interaction/src/favorite/favorite.constant.ts`
- `libs/interaction/src/like/like.constant.ts`
- `libs/interaction/src/report/report.constant.ts`

现象：

- 多个模块都在描述“作品 / 章节 / 论坛主题 / 评论 / 用户”等目标类型。
- 命名和编码并不完全统一，例如：
  - `InteractionTargetTypeEnum` 使用 `COMIC / NOVEL / FORUM_TOPIC / COMIC_CHAPTER`
  - `LikeTargetTypeEnum` 使用 `WORK_COMIC / WORK_NOVEL / FORUM_TOPIC / COMMENT`
  - `FavoriteTargetTypeEnum` 只覆盖部分目标
  - `ReportTargetTypeEnum` 又扩展了 `USER`

判断：

- 这不一定是错误，因为不同表可能确实需要不同编码。
- 但当前缺少“共享目标模型”和“模块特定映射”的边界说明，长期会演变为隐式重复定义。

建议：

- 如果多个表的目标域本质一致，优先抽出统一的 `InteractionTargetTypeEnum` 作为根枚举。
- 各模块只保留差异补充或映射表，例如 `ReportTargetTypeToInteractionTargetMap`。
- 如果确实不能统一，至少在注释里明确“为什么该模块不能复用平台目标枚举”。

### 3.5 已部分完成：命名规范不统一问题已开始收敛

本轮已完成的命名统一：

- `apps/admin-api/src/modules/system/audit/audit.constant.ts` 中的 `ActionTypeEnum` 已改为 `AuditActionTypeEnum`
- `libs/platform/src/constant/logger.constant.ts` 中的 `LoggerLevel` 已改为 `LoggerLevelEnum`
- `libs/platform/src/constant/interaction.constant.ts` 中的历史遗留 `InteractionActionType` 已在命名收口后移除
- `libs/platform/src/modules/auth/auth.constant.ts` 中的 `AuthErrorConstant` 已改为 `AuthErrorMessages`
- `apps/app-api/src/modules/auth/auth.constant.ts` 中的本地错误文案已改为 `AppAuthErrorMessages`
- `apps/admin-api/src/modules/content/comic/third-party/third-party.constant.ts` 中的 `PLATFORMS` 已改为 `COMIC_THIRD_PARTY_PLATFORMS`

具体表现：

- 枚举后缀不统一：
  - 原 `LoggerLevel` 没有 `Enum` 后缀
  - 原 `InteractionActionType` 没有 `Enum` 后缀
  - 其他大多数文件使用 `XxxEnum`
- 键名对象命名不统一：
  - `CacheKey`
  - `CACHE_KEY`
  - `FORUM_CONFIG_CACHE_KEYS`
- 消息常量命名不统一：
  - 原 `AuthErrorConstant`
  - `AuthErrorMessages`
  - `PERMISSION_ERROR_MESSAGE`
  - `SmsErrorMessages`
- 个别命名本身仍可继续优化：
  - `AuthDefaultValue` 仍偏单数语义，后续可评估是否统一为 `AuthDefaultValues`
  - 审计动作枚举仍然把中文展示文案直接作为稳定值，后续应继续拆分编码与标签

社区推荐做法：

- `enum` 一律使用 `XxxEnum`
- 只读对象使用 `XxxMap`、`XxxLabels`、`XxxDefaults`、`XxxCacheKeys`
- 错误文案统一为 `XxxErrorMessages`
- 业务动作的“稳定编码”和“展示文案”拆开

额外说明：

- `apps/admin-api/src/modules/system/audit/audit.constant.ts:4` 当前仍把中文展示文案直接放进 `AuditActionTypeEnum` 值里。
- 更稳妥的做法是：
  - `AuditActionTypeEnum.LOGIN = 'LOGIN'`
  - `AuditActionTypeLabels[AuditActionTypeEnum.LOGIN] = '用户登录'`

### 3.6 已部分完成：`*.constant.ts` 文件职责已开始回收

例子：

- `libs/platform/src/modules/auth/auth.constant.ts` 原先导出的函数 `createAuthRedisKeys` 已迁移到 `libs/platform/src/modules/auth/auth.helpers.ts`
- `libs/platform/src/decorators/response-dto.constant.ts` 已删除，原有元数据常量/类型/装饰器已拆分到：
  - `libs/platform/src/decorators/response-dto.metadata.ts`
  - `libs/platform/src/decorators/response-dto.decorator.ts`

判断：

- 这些内容不是“错误”，但已经不再是纯常量文件。
- 长期来看，`*.constant.ts` 这个文件后缀会逐渐失去约束意义。

建议：

- 纯常量：保留在 `*.constant.ts`
- 构造器/工厂函数：迁移到 `*.factory.ts` 或 `*.helpers.ts`
- 元数据接口与装饰器：迁移到 `*.metadata.ts` / `*.decorator.ts`

### 3.7 已完成：`0` 外部命名导入的导出项已清理完毕

整改结果：

- 已删除整文件无人使用的 `libs/platform/src/constant/sort.constant.ts`
- 已移除一批仅定义未消费的导出，包括：
  - `WorkTypeMap`
  - `ForumUserActionTypeDescriptionMap`
  - `ForumModeratorPermissionNames`
  - `ForumModeratorRoleTypeNames`
  - `GrowthRuleTypeNames`
  - `getGrowthRuleTypeName`
  - `LevelRulePermissionNames`
  - `COMMENT_GROWTH_RULE_TYPE_MAP`
  - `ReportReasonNames`
  - `ReportStatusNames`
  - `ReportTargetTypeNames`
  - `AuditRoleNames`
  - `AuditStatusNames`
  - `SceneTypeNames`
  - `CommentLevelNames`
  - `InteractionActionTypeEnum`
- `RevokeTokenReasonEnum` 未删除，而是被接入真实业务调用点，回到“单一事实源”的角色
- 当前统计已收敛为：`0` 个整文件无人导入、`0` 个导出项无人导入

## 4. 社区最佳实践建议

### 4.1 建立“单一事实源”规则

每个业务概念只能有一个真实定义文件：

- 审核状态只在一个文件定义
- 成长规则类型只在一个文件定义
- 管理员角色只在一个文件定义

其他模块如果需要复用：

- 直接导入源文件
- 或通过一个稳定 barrel 暴露
- 但不要在另一个 `*.constant.ts` 中再次用同名导出包装

### 4.2 禁止“同名重导出”的常量包装层

建议新增团队约束：

- 可以在 `index.ts` 做 re-export
- 不建议在另一个 `*.constant.ts` 中做同名 re-export
- 如果必须包装，包装后的名字必须带上下文，例如：
  - `AdminAuthRedisKeys`
  - `AppAuthErrorMessages`
  - `ForumAuditStatusEnum` 仅当它与平台审核状态真的不同

### 4.3 统一命名规范

建议约定：

- 枚举：`XxxEnum`
- 标签映射：`XxxLabels`
- 名称映射：`XxxNames` 仅当团队明确统一使用
- 默认值：`DEFAULT_XXX`
- 缓存键：`XXX_CACHE_KEYS`
- 缓存时间：`XXX_CACHE_TTL_SECONDS`
- 错误文案：`XxxErrorMessages`

同时约束：

- 避免 `ActionTypeEnum`、`CacheKey`、`PLATFORMS` 这类过泛命名
- 避免 `FORUMTypeEnum` 这类大小写不一致命名

### 4.4 `enum` 与 `const` 的使用边界

结合当前项目形态，推荐不要“一刀切去 enum”，而是按用途划分：

- 持久化到数据库的状态码、类型码、审核码：
  - 继续使用 `enum`
- 默认配置、错误文案、缓存键、映射表：
  - 优先使用 `as const` 对象或显式 `Readonly<Record<...>>`

原因：

- 你们当前大量枚举会被 DTO 装饰器、Swagger、数据库状态值直接消费，保留运行时枚举对象更稳妥。
- 但纯消息和纯配置用 `as const` 更轻量，也更符合 TypeScript 社区常见写法。

### 4.5 把“目标类型体系”做成平台层公共模型

建议分两层：

- 第一层：平台根枚举，例如 `InteractionTargetTypeEnum`
- 第二层：模块映射，例如：
  - `LikeTargetTypeToInteractionTargetMap`
  - `ReportTargetTypeToInteractionTargetMap`
  - `CommentTargetTypeToInteractionTargetMap`

这样可以避免多个模块重复维护“漫画 / 小说 / 章节 / 论坛主题 / 评论 / 用户”的概念集合。

### 4.6 控制 barrel 导出面

建议：

- `index.ts` 只导出对外真正稳定的公共常量
- 未确定的、仅模块内部使用的常量不要进入公共 barrel
- 定期清理“已经 barrel 暴露但当前无人引用”的符号

当前最典型例子：

- `libs/platform/src/constant/business.constant.ts` 已在本次整改中删除

## 5. 建议的整改顺序

### 第一阶段：先解决事实源冲突

1. 已完成：只保留一个 `AdminUserRoleEnum`
2. 已完成：删除 `business.constant.ts`
3. 已完成：移除 `content.constant.ts` 中重复且未使用的 `BusinessModuleEnum`

### 第二阶段：去掉常量别名层

1. 已完成：删除 `forum-topic.constant.ts` 对平台审核枚举的同名重导出
2. 已完成：删除 `forum-section.constant.ts` 对 `ForumReviewPolicyEnum` 的同名重导出
3. 已完成：删除 `experience.constant.ts`、`point.constant.ts` 对 `GrowthRuleTypeEnum` 的同名重导出
4. 已完成：将 Auth 包装层改成“只保留本端特有常量”，共享常量统一从平台层导入

### 第三阶段：统一命名和职责

1. 已部分完成：统一 `Enum / Labels / Messages / CacheKeys / Defaults` 命名体系
2. 已部分完成：将行为型 helper 从 `*.constant.ts` 中迁出
3. 待处理：为跨模块共享的目标类型建立公共根模型

### 第四阶段：清理公共导出面

1. 已完成：逐项确认 `0` 外部命名导入的导出项
2. 已完成：删除确认无用的导出
3. 已完成：将 `RevokeTokenReasonEnum` 这类应保留的概念重新接入真实业务调用

## 6. 附录：常量文件外部引用清单

说明：括号中的数字表示“当前外部命名导入数量”。

```text
apps/admin-api/src/modules/auth/auth.constant.ts => AdminAuthCacheKeys(1), AdminAuthRedisKeys(2)
apps/admin-api/src/modules/content/comic/third-party/third-party.constant.ts => COMIC_THIRD_PARTY_PLATFORMS(1)
apps/admin-api/src/modules/system/audit/audit.constant.ts => AuditActionTypeEnum(10)
apps/app-api/src/modules/auth/auth.constant.ts => AppAuthErrorMessages(3), AppAuthRedisKeys(1)
libs/app-content/src/announcement/announcement.constant.ts => AnnouncementPriorityEnum(1), AnnouncementTypeEnum(1)
libs/app-content/src/page/page.constant.ts => PageRuleEnum(1)
libs/config/src/app-config/config.constant.ts => DEFAULT_APP_CONFIG(1)
libs/config/src/system-config/system-config.constant.ts => CACHE_KEY(2), CACHE_TTL(1), CONFIG_SECURITY_META(1), DEFAULT_CONFIG(2)
libs/content/src/author/author.constant.ts => AuthorTypeEnum(1)
libs/content/src/permission/content-permission.constant.ts => PERMISSION_ERROR_MESSAGE(1)
libs/content/src/work/core/work.constant.ts => WorkSerialStatusEnum(1)
libs/forum/src/action-log/action-log.constant.ts => ForumUserActionTargetTypeEnum(2), ForumUserActionTypeEnum(2)
libs/forum/src/config/forum-config-cache.constant.ts => FORUM_CONFIG_CACHE_KEYS(1), FORUM_CONFIG_CACHE_METRICS(1), FORUM_CONFIG_CACHE_TTL(1)
libs/forum/src/config/forum-config.constant.ts => ChangeTypeEnum(2), DEFAULT_FORUM_CONFIG(2), ForumReviewPolicyEnum(3)
libs/forum/src/moderator/moderator.constant.ts => ForumModeratorPermissionEnum(2), ForumModeratorRoleTypeEnum(2)
libs/forum/src/search/search.constant.ts => ForumSearchSortTypeEnum(2), ForumSearchTypeEnum(2)
libs/growth/src/badge/user-badge.constant.ts => UserBadgeTypeEnum(1)
libs/growth/src/growth-ledger/growth-ledger.constant.ts => GrowthAssetTypeEnum(14), GrowthLedgerActionEnum(4), GrowthLedgerFailReasonEnum(2), GrowthLedgerFailReasonLabel(1)
libs/growth/src/growth-rule.constant.ts => GrowthRuleTypeEnum(15)
libs/growth/src/level-rule/level-rule.constant.ts => UserLevelRulePermissionEnum(2)
libs/growth/src/task/task.constant.ts => TaskAssignmentStatusEnum(2), TaskClaimModeEnum(2), TaskCompleteModeEnum(2), TaskProgressActionTypeEnum(1), TaskRepeatTypeEnum(1), TaskStatusEnum(2), TaskTypeEnum(1)
libs/interaction/src/browse-log/browse-log.constant.ts => BROWSE_LOG_GROWTH_RULE_TYPE_MAP(1), BrowseLogTargetTypeEnum(9)
libs/interaction/src/comment/comment.constant.ts => CommentTargetTypeEnum(10)
libs/interaction/src/download/download.constant.ts => DownloadTargetTypeEnum(7)
libs/interaction/src/favorite/favorite.constant.ts => FAVORITE_GROWTH_RULE_TYPE_MAP(1), FavoriteTargetTypeEnum(9)
libs/interaction/src/like/like.constant.ts => LIKE_GROWTH_RULE_TYPE_MAP(1), LikeTargetTypeEnum(11)
libs/interaction/src/purchase/purchase.constant.ts => PaymentMethodEnum(1), PurchaseStatusEnum(4), PurchaseTargetTypeEnum(7)
libs/interaction/src/report/report.constant.ts => REPORT_GROWTH_RULE_TYPE_MAP(1), ReportReasonEnum(2), ReportStatusEnum(2), ReportTargetTypeEnum(14)
libs/message/src/chat/chat.constant.ts => CHAT_MESSAGE_PAGE_LIMIT_DEFAULT(1), CHAT_MESSAGE_PAGE_LIMIT_MAX(1), ChatConversationMemberRoleEnum(1), ChatMessageStatusEnum(1), ChatMessageTypeEnum(3), MESSAGE_CHAT_SERVICE_TOKEN(2)
libs/message/src/notification/notification.constant.ts => MessageNotificationSubjectTypeEnum(4), MessageNotificationTypeEnum(7)
libs/message/src/outbox/outbox.constant.ts => MESSAGE_OUTBOX_BATCH_SIZE(1), MESSAGE_OUTBOX_MAX_RETRY(1), MESSAGE_OUTBOX_PROCESSING_TIMEOUT_SECONDS(1), MessageOutboxDomainEnum(3), MessageOutboxStatusEnum(3)
libs/moderation/sensitive-word/src/sensitive-word-cache.constant.ts => SENSITIVE_WORD_CACHE_KEYS(1), SENSITIVE_WORD_CACHE_TTL(1)
libs/platform/src/constant/audit.constant.ts => AuditRoleEnum(1), AuditStatusEnum(7)
libs/platform/src/constant/base.constant.ts => ApiTypeEnum(3), EnablePlatformEnum(2), HttpMethodEnum(3)
libs/platform/src/constant/content.constant.ts => ContentTypeEnum(15), WorkTypeEnum(7), WorkViewPermissionEnum(7)
libs/platform/src/constant/interaction.constant.ts => CommentLevelEnum(7), InteractionTargetTypeEnum(7), SceneTypeEnum(17)
libs/platform/src/constant/logger.constant.ts => LoggerLevelEnum(1)
libs/platform/src/constant/user.constant.ts => AdminUserRoleEnum(3), GenderEnum(4), UserDefaults(1), UserStatusEnum(10)
libs/platform/src/modules/auth/auth.constant.ts => AuthConstants(2), AuthDefaultValue(2), AuthErrorMessages(3), RevokeTokenReasonEnum(4)
libs/platform/src/modules/sms/sms.constant.ts => SmsErrorMap(1), SmsErrorMessages(1), SmsTemplateCodeEnum(3)
```
