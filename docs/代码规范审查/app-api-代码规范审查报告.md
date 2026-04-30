# apps/app-api 模块代码规范审查报告

## 审查概览

- 审查模块：`apps/app-api`
- 审查方式：逐目录、逐文件阅读源码与配置，对照根 `AGENTS.md`、`.trae/rules/PROJECT_RULES.md`、`.trae/rules/01-import-boundaries.md` 至 `.trae/rules/08-testing.md`
- 已读源码/配置文件：62 个
- 规范来源总数：10 份
- 本模块适用校验点：52 项
- 已闭合校验点：52 项
- 合规校验点：37 项
- 违规校验点：15 项

### 风险分布

- HIGH：2
- MEDIUM：11
- LOW：2

## 规范条款逐条校验汇总

| 规范来源                       | 本模块适用校验点 | 结论                                               |
| ------------------------------ | ---------------: | -------------------------------------------------- |
| `AGENTS.md` 项目级约束         |                6 | 发现配置安全与交付风险                             |
| `.trae/rules/PROJECT_RULES.md` |                5 | 发现入口层装配重复与规范收敛问题                   |
| `01-import-boundaries.md`      |                7 | 发现未授权平台入口                                 |
| `02-controller.md`             |                7 | 发现 OptionalAuth 与参数类型不一致                 |
| `03-dto.md`                    |                5 | Controller 入参总体复用 DTO，未发现新增 app DTO    |
| `04-typescript-types.md`       |                9 | 发现复杂签名、`as never` 绕过、内联对象类型        |
| `05-comments.md`               |                5 | 发现大量方法未使用紧邻行注释，常量字段缺少逐项注释 |
| `06-error-handling.md`         |                4 | 发现服务层用 HTTP 异常表达可预期失败               |
| `07-drizzle.md`                |                2 | 本模块未发现明确 Drizzle 查询构造违规              |
| `08-testing.md`                |                2 | 正式 spec 保留；部分测试绕过类型契约               |

## 详细违规清单

### HIGH

#### H-01 硬编码本地凭据进入应用环境文件

- 文件位置：`apps/app-api/.env.development:7`、`apps/app-api/.env.development:10`、`apps/app-api/.env.development:11`
- 对应规范：安全风险审查项；`AGENTS.md` 要求交付前识别配置/部署现实冲突
- 违规原因：环境文件直接保存默认密码、PostgreSQL 连接串和 Redis 密码
- 整改建议：迁移真实值到未跟踪本地环境文件；仓库中仅保留 `.env.example` 占位值；若凭据可能被共享，按泄露处理并轮换

#### H-02 密码生成使用 `Math.random()`

- 文件位置：`apps/app-api/src/modules/auth/password.service.ts:53` 至 `apps/app-api/src/modules/auth/password.service.ts:66`
- 对应规范：安全风险审查项；认证/密码逻辑必须使用安全随机源
- 违规原因：`generateSecureRandomPassword()` 用 `Math.random()` 选择字符和洗牌，不能提供密码场景需要的不可预测性
- 整改建议：改用 `node:crypto` 的 `randomInt` / `randomBytes`，并避免 `sort(() => Math.random() - 0.5)` 洗牌

### MEDIUM

#### M-01 平台模块导入未命中白名单入口

- 文件位置：`apps/app-api/src/app.module.ts:14`
- 对应规范：`01-import-boundaries.md`，`libs/platform` 只能使用例外白名单公共入口
- 违规原因：导入 `@libs/platform/platform.module`，该路径不在白名单中
- 整改建议：将平台模块能力暴露到允许入口，或改用已授权的 `@libs/platform/...` 公共入口

#### M-02 导出常量对象字段缺少逐项注释

- 文件位置：`apps/app-api/src/modules/auth/auth.constant.ts:5` 至 `apps/app-api/src/modules/auth/auth.constant.ts:25`
- 对应规范：`05-comments.md`，导出的常量对象、映射常量、配置常量中的每一个字段都必须有紧邻注释
- 违规原因：`AppAuthErrorMessages` 导出对象包含多项错误文案，但字段未逐项说明业务语义
- 整改建议：为每个字段补紧邻中文行注释；若只是技术 key 复述，应补真实使用场景

#### M-03 服务方法签名中直接书写内联对象/复杂类型

- 文件位置：
  - `apps/app-api/src/modules/auth/auth.service.ts:58`
  - `apps/app-api/src/modules/auth/auth.service.ts:315`
  - `apps/app-api/src/modules/user/user.service.ts:87`
  - `apps/app-api/src/modules/user/user.service.ts:108`
  - `apps/app-api/src/modules/user/user.service.ts:124`
- 对应规范：`04-typescript-types.md`，方法签名中的复杂类型表达式必须先在 `*.type.ts` 中命名后引用
- 违规原因：签名中直接使用对象字面量类型和 `Partial<...>`
- 整改建议：提取 `SessionAllowedUserState`、`UserGrowthSnapshot`、`UserCenterCountView` 等 owner type 后在方法签名引用

#### M-04 服务层用 HTTP 异常表达可预期业务失败

- 文件位置：
  - `apps/app-api/src/modules/auth/auth.service.ts:103`
  - `apps/app-api/src/modules/auth/auth.service.ts:129`
  - `apps/app-api/src/modules/auth/auth.service.ts:135`
  - `apps/app-api/src/modules/auth/auth.service.ts:141`
  - `apps/app-api/src/modules/auth/sms.service.ts:63`
  - `apps/app-api/src/modules/auth/sms.service.ts:76`
- 对应规范：`06-error-handling.md`，Service 对可预期业务失败抛 `BusinessException`；协议层错误留给 ValidationPipe / Controller 边界
- 违规原因：缺少手机号、缺少密码/验证码、验证码发送/校验失败等可预期失败在 service 内直接抛 Nest HTTP 异常
- 整改建议：能由 DTO 校验表达的放回 DTO/ValidationPipe；业务失败使用 `BusinessException` 和共享错误码

#### M-05 `@OptionalAuth()` 接口把当前用户声明成必选 `number`

- 文件位置：
  - `apps/app-api/src/modules/work/work.controller.ts:62`、`apps/app-api/src/modules/work/work.controller.ts:69`
  - `apps/app-api/src/modules/work/work-chapter.controller.ts:49`、`apps/app-api/src/modules/work/work-chapter.controller.ts:56`
  - `apps/app-api/src/modules/work/work-chapter.controller.ts:92`、`apps/app-api/src/modules/work/work-chapter.controller.ts:99`
  - `apps/app-api/src/modules/work/work-chapter.controller.ts:112`、`apps/app-api/src/modules/work/work-chapter.controller.ts:119`
  - `apps/app-api/src/modules/work/work-chapter.controller.ts:132`、`apps/app-api/src/modules/work/work-chapter.controller.ts:139`
  - `apps/app-api/src/modules/work/work-chapter.controller.ts:148`、`apps/app-api/src/modules/work/work-chapter.controller.ts:155`
- 对应规范：`02-controller.md`，Controller 负责正确装配上下文，契约不能与运行时身份状态冲突
- 违规原因：可匿名接口上 `@CurrentUser('sub') userId: number` 实际可能为 `undefined`，类型契约和运行时不一致
- 整改建议：将参数改为 `userId?: number`，或移除 `@OptionalAuth()` 并明确要求登录

#### M-06 系统模块重复导入同一模块

- 文件位置：`apps/app-api/src/modules/system/system.module.ts:16`、`apps/app-api/src/modules/system/system.module.ts:21`
- 对应规范：工程风格与模块组织要求，入口层应保持清晰、最小装配
- 违规原因：`AppPageModule` 在同一 `imports` 数组中出现两次
- 整改建议：删除重复导入，保留一次即可

#### M-07 方法注释形式大面积不符合规则

- 文件位置示例：
  - `apps/app-api/src/modules/comment/comment.controller.ts:30`
  - `apps/app-api/src/modules/download/download.controller.ts:24`
  - `apps/app-api/src/modules/forum/forum-topic.controller.ts:44`
  - `apps/app-api/src/modules/message/message.controller.ts:44`
  - `apps/app-api/src/modules/work/work.controller.ts:27`
- 对应规范：`05-comments.md`，每个方法定义前必须有紧邻中文行注释，禁止为方法使用 JSDoc
- 违规原因：大量 controller/service 方法只有 Swagger 装饰器或 JSDoc，没有方法定义正上方的 `//` 行注释
- 整改建议：为所有方法补 1-2 行紧邻行注释；已有方法级 JSDoc 改为行注释

#### M-08 `UserController` 方法注释使用 JSDoc

- 文件位置：`apps/app-api/src/modules/user/user.controller.ts:19`、`apps/app-api/src/modules/user/user.controller.ts:31`、`apps/app-api/src/modules/user/user.controller.ts:46`
- 对应规范：`05-comments.md`，方法注释统一使用紧邻方法定义的行注释，不使用 JSDoc
- 违规原因：多个 controller 方法使用 `/** ... */` 作为方法注释
- 整改建议：改为 `// 获取当前用户资料。` 这类紧邻行注释

#### M-09 `UserService` 类说明 JSDoc 未贴近导出符号

- 文件位置：`apps/app-api/src/modules/user/user.service.ts:4`、`apps/app-api/src/modules/user/user.service.ts:45`
- 对应规范：`05-comments.md`，同一符号只保留一组有效注释，注释必须紧邻目标符号
- 违规原因：类说明 JSDoc 写在 import 之前，未贴近 `export class UserService`
- 整改建议：移动到 `@Injectable()` / class 附近，或删除模板化类说明，保留必要方法级行注释

#### M-10 测试中大量使用 `as never` 绕过类型契约

- 文件位置：
  - `apps/app-api/src/modules/forum/forum-section.controller.spec.ts:9`
  - `apps/app-api/src/modules/forum/forum-section.controller.spec.ts:13`
  - `apps/app-api/src/modules/user/user.service.spec.ts:14` 至 `apps/app-api/src/modules/user/user.service.spec.ts:21`
  - `apps/app-api/src/modules/user/user.service.spec.ts:60`
  - `apps/app-api/src/modules/user/user.service.spec.ts:107`
- 对应规范：`04-typescript-types.md` 边界类型与类型安全要求；`08-testing.md` 测试应验证行为且不制造脆弱契约
- 违规原因：测试通过 `as never` 规避依赖和 DTO 类型，可能掩盖真实构造契约变化
- 整改建议：定义最小 mock 类型，或通过 Nest testing module 注入 provider；DTO 输入使用真实 DTO shape

#### M-11 `SmsService` 验证码失败语义与认证失败混用

- 文件位置：`apps/app-api/src/modules/auth/sms.service.ts:76`
- 对应规范：`06-error-handling.md`，业务码表达业务失败，鉴权失败才使用协议层 Unauthorized
- 违规原因：验证码错误或过期被抛成 `UnauthorizedException`，容易与登录态失效混淆
- 整改建议：使用 `BusinessException(BusinessErrorCode.OPERATION_NOT_ALLOWED, ...)` 或专门共享错误码表达验证码业务失败

### LOW

#### L-01 模块格式与导入风格不一致

- 文件位置示例：`apps/app-api/src/modules/work/work.module.ts:8`、`apps/app-api/src/modules/work/work.module.ts:9`
- 对应规范：工程风格一致性
- 违规原因：部分模块数组被拆成多行，部分文件仍保留分号/混合换行，风格与相邻文件不一致
- 整改建议：统一按项目格式化工具输出，避免手工维护风格差异

#### L-02 public 系统接口方法缺少行注释

- 文件位置：`apps/app-api/src/modules/system/system.controller.ts:36`、`apps/app-api/src/modules/system/system.controller.ts:47`、`apps/app-api/src/modules/system/system.controller.ts:58`
- 对应规范：`05-comments.md`，所有方法定义前都必须有简短注释
- 违规原因：公共配置、页面、公告等公开接口方法缺少紧邻行注释
- 整改建议：补充解释接口返回的业务视图和公开边界

## 逐文件审查结论

### 发现违规的文件

| 文件                                                              | 结论            |
| ----------------------------------------------------------------- | --------------- |
| `apps/app-api/.env.development`                                   | 发现 H-01       |
| `apps/app-api/src/app.module.ts`                                  | 发现 M-01       |
| `apps/app-api/src/modules/auth/auth.constant.ts`                  | 发现 M-02       |
| `apps/app-api/src/modules/auth/auth.service.ts`                   | 发现 M-03、M-04 |
| `apps/app-api/src/modules/auth/password.service.ts`               | 发现 H-02       |
| `apps/app-api/src/modules/auth/sms.service.ts`                    | 发现 M-04、M-11 |
| `apps/app-api/src/modules/comment/comment.controller.ts`          | 发现 M-07       |
| `apps/app-api/src/modules/download/download.controller.ts`        | 发现 M-07       |
| `apps/app-api/src/modules/forum/forum-section.controller.spec.ts` | 发现 M-10       |
| `apps/app-api/src/modules/forum/forum-topic.controller.ts`        | 发现 M-07       |
| `apps/app-api/src/modules/message/message.controller.ts`          | 发现 M-07       |
| `apps/app-api/src/modules/system/system.controller.ts`            | 发现 L-02       |
| `apps/app-api/src/modules/system/system.module.ts`                | 发现 M-06       |
| `apps/app-api/src/modules/user/user.controller.ts`                | 发现 M-08       |
| `apps/app-api/src/modules/user/user.service.spec.ts`              | 发现 M-10       |
| `apps/app-api/src/modules/user/user.service.ts`                   | 发现 M-03、M-09 |
| `apps/app-api/src/modules/work/work-chapter.controller.ts`        | 发现 M-05       |
| `apps/app-api/src/modules/work/work.controller.ts`                | 发现 M-05、M-07 |
| `apps/app-api/src/modules/work/work.module.ts`                    | 发现 L-01       |

### 已读且未发现明确违规的文件

以下每个文件均已逐行阅读，对照本次登记规范点未发现明确违规：

- `apps/app-api/src/config/app.config.spec.ts`
- `apps/app-api/src/config/app.config.ts`
- `apps/app-api/src/config/validation.config.ts`
- `apps/app-api/src/global.d.ts`
- `apps/app-api/src/main.ts`
- `apps/app-api/src/modules/app.module.ts`
- `apps/app-api/src/modules/auth/app-user-status.guard.ts`
- `apps/app-api/src/modules/auth/auth.controller.ts`
- `apps/app-api/src/modules/auth/auth.module.ts`
- `apps/app-api/src/modules/check-in/check-in.controller.ts`
- `apps/app-api/src/modules/check-in/check-in.module.ts`
- `apps/app-api/src/modules/comment/comment.module.ts`
- `apps/app-api/src/modules/dictionary/dictionary.controller.ts`
- `apps/app-api/src/modules/dictionary/dictionary.module.ts`
- `apps/app-api/src/modules/download/download.module.ts`
- `apps/app-api/src/modules/emoji/emoji.controller.ts`
- `apps/app-api/src/modules/emoji/emoji.module.ts`
- `apps/app-api/src/modules/favorite/favorite.controller.ts`
- `apps/app-api/src/modules/favorite/favorite.module.ts`
- `apps/app-api/src/modules/follow/follow.controller.ts`
- `apps/app-api/src/modules/follow/follow.module.ts`
- `apps/app-api/src/modules/forum/forum-hashtag.controller.ts`
- `apps/app-api/src/modules/forum/forum-moderator-application.controller.ts`
- `apps/app-api/src/modules/forum/forum-moderator.controller.ts`
- `apps/app-api/src/modules/forum/forum-search.controller.ts`
- `apps/app-api/src/modules/forum/forum-section-group.controller.ts`
- `apps/app-api/src/modules/forum/forum-section.controller.ts`
- `apps/app-api/src/modules/forum/forum.module.ts`
- `apps/app-api/src/modules/like/like.controller.ts`
- `apps/app-api/src/modules/like/like.module.ts`
- `apps/app-api/src/modules/message/message.module.ts`
- `apps/app-api/src/modules/purchase/purchase.controller.ts`
- `apps/app-api/src/modules/purchase/purchase.module.ts`
- `apps/app-api/src/modules/reading-history/reading-history.controller.ts`
- `apps/app-api/src/modules/reading-history/reading-history.module.ts`
- `apps/app-api/src/modules/report/report.controller.ts`
- `apps/app-api/src/modules/report/report.module.ts`
- `apps/app-api/src/modules/system/upload/upload.controller.ts`
- `apps/app-api/src/modules/system/upload/upload.module.ts`
- `apps/app-api/src/modules/task/task.controller.ts`
- `apps/app-api/src/modules/task/task.module.ts`
- `apps/app-api/src/modules/user/user.module.ts`
- `apps/app-api/src/modules/work/work-chapter.controller.ts`
- `apps/app-api/tsconfig.app.json`

## 必改项清单

1. 移除 `.env.development` 中真实/可用凭据并轮换可能泄露的密码。
2. 将 `PasswordService.generateSecureRandomPassword()` 改为加密安全随机源。
3. 修复 `@libs/platform/platform.module` 非白名单导入。
4. 修正 `@OptionalAuth()` 接口中的必选 `userId: number`。
5. 将服务签名内联对象类型和 `Partial<>` 迁移到 owner `*.type.ts`。
6. 将验证码、注册参数缺失等可预期失败按 DTO 校验或 `BusinessException` 收口。

## 优化建议清单

1. 对 app-api controller/service 全量补齐方法级紧邻行注释。
2. 为导出的认证错误文案常量逐字段补注释。
3. 删除 `SystemModule` 重复导入。
4. 测试中的 `as never` 改成最小 mock 类型或 Nest testing module。

## 合规率总结

- 本模块按校验点统计合规率：37 / 52 = 71.15%
- 按已读文件统计：43 个文件未发现明确违规，19 个文件存在至少 1 项违规
- 结论：`apps/app-api` 不建议直接通过规范审查；需先处理 HIGH 与 MEDIUM 项，再进入下一轮复核。
