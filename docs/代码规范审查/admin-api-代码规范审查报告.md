# apps/admin-api 模块代码规范审查报告

## 审查概览

- 审查模块：`apps/admin-api`
- 审查方式：逐目录、逐文件阅读源码与配置，对照根 `AGENTS.md`、`.trae/rules/PROJECT_RULES.md`、`.trae/rules/01-import-boundaries.md` 至 `.trae/rules/08-testing.md`
- 已读源码/配置文件：122 个
- 非源码二进制文件：7 个 `uploads/**/*.png`，已登记为运行期上传资产，不纳入代码规范逐行审查
- 规范来源总数：10 份
- 本模块适用校验点：52 项
- 已闭合校验点：52 项
- 合规校验点：35 项
- 违规校验点：17 项

### 风险分布

- HIGH：2
- MEDIUM：13
- LOW：2

## 规范条款逐条校验汇总

| 规范来源                       | 本模块适用校验点 | 结论                                         |
| ------------------------------ | ---------------: | -------------------------------------------- |
| `AGENTS.md` 项目级约束         |                6 | 发现配置安全与导入边界问题                   |
| `.trae/rules/PROJECT_RULES.md` |                5 | 发现入口层复用与规范收敛问题                 |
| `01-import-boundaries.md`      |                7 | 发现未授权平台入口与新增 barrel              |
| `02-controller.md`             |                7 | 发现 controller 入参未统一 DTO               |
| `03-dto.md`                    |                5 | 发现单字段 query 绕过 DTO                    |
| `04-typescript-types.md`       |                9 | 发现顶层类型散落、复杂签名、`any`            |
| `05-comments.md`               |                5 | 发现大量方法未使用紧邻行注释                 |
| `06-error-handling.md`         |                4 | 发现服务层吞异常与 HTTP 异常表达业务失败     |
| `07-drizzle.md`                |                2 | 本模块未发现明确 Drizzle 查询构造违规        |
| `08-testing.md`                |                2 | 现有正式 spec 未删除；本次审查未涉及行为改动 |

## 详细违规清单

### HIGH

#### H-01 硬编码本地凭据进入应用环境文件

- 文件位置：`apps/admin-api/.env.development:7`、`apps/admin-api/.env.development:10`、`apps/admin-api/.env.development:11`
- 对应规范：安全风险审查项；`AGENTS.md` 要求交付前识别配置/部署现实冲突
- 违规原因：文件中直接保存默认密码、PostgreSQL 连接串和 Redis 密码，存在误提交、复制到共享环境或日志泄露风险
- 整改建议：把真实值迁移到本地未跟踪的环境文件；仓库内保留 `.env.example` 占位值；若这些凭据曾被共享，按真实凭据处理并轮换

#### H-02 默认管理员密码在代码配置中硬编码

- 文件位置：`apps/admin-api/src/config/app.config.ts:12`、`apps/admin-api/src/config/validation.config.ts:27`
- 对应规范：安全风险审查项；配置默认值不得制造生产弱口令风险
- 违规原因：`Aa@123456` 同时作为配置兜底值和校验默认值，环境变量缺失时会静默启用弱默认密码
- 整改建议：去掉密码默认值；启动校验强制要求显式配置；开发环境用 `.env.example` 提示本地设置，不在代码中内置可用密码

### MEDIUM

#### M-01 平台模块导入未命中白名单入口

- 文件位置：`apps/admin-api/src/app.module.ts:13`
- 对应规范：`01-import-boundaries.md`，`libs/platform` 只能使用例外白名单公共入口
- 违规原因：导入 `@libs/platform/platform.module`，该路径不在平台白名单中
- 整改建议：将需要暴露的能力收敛到白名单入口，或调整为已授权的 `@libs/platform/...` 公共入口

#### M-02 新增/保留 `*.types.ts` 类型文件命名不合规

- 文件位置：`apps/admin-api/src/common/decorators/audit.types.ts:1`
- 对应规范：`04-typescript-types.md`，禁止新增 `*.types.ts`，历史文件默认收敛到 `*.type.ts`
- 违规原因：文件名使用复数 `types.ts`
- 整改建议：迁移为同域 `audit.type.ts`，并同步所有直连导入

#### M-03 顶层 TypeScript 类型散落在业务文件中

- 文件位置：
  - `apps/admin-api/src/common/decorators/api-audit-doc.decorator.ts:8`
  - `apps/admin-api/src/modules/app-user/app-user-command.service.ts:25`
  - `apps/admin-api/src/modules/content/comic/third-party/libs/copy.service.ts:9`
  - `apps/admin-api/src/modules/content/comic/third-party/libs/copy.service.ts:13`
  - `apps/admin-api/src/modules/system/audit/audit.service.ts:19`
  - `apps/admin-api/src/modules/system/ip2region/ip2region.service.ts:23`
- 对应规范：`04-typescript-types.md`，纯 TypeScript 的 `type` / `interface` 统一放在 `*.type.ts`
- 违规原因：装饰器、service 文件中直接声明顶层类型，后续难以复用和审查 owner 归属
- 整改建议：按 owner 迁移到贴近模块的 `*.type.ts`，业务文件仅 `import type` 使用

#### M-04 方法签名中直接书写复杂类型表达式

- 文件位置：
  - `apps/admin-api/src/modules/app-user/app-user.service.ts:21`
  - `apps/admin-api/src/modules/app-user/app-user.service.ts:33`
  - `apps/admin-api/src/modules/growth/growth.service.ts:209`
  - `apps/admin-api/src/modules/growth/growth.service.ts:210`
  - `apps/admin-api/src/modules/message/message-template.service.ts:99`
  - `apps/admin-api/src/modules/message/message-template.service.ts:100`
  - `apps/admin-api/src/modules/system/audit/audit.service.ts:153`
- 对应规范：`04-typescript-types.md`，方法/函数签名中的复杂类型表达式必须先命名后引用
- 违规原因：签名里直接使用 `Parameters<>`、`Array<{...}>`、`Awaited<ReturnType<...>>`、内联泛型约束等复杂表达式
- 整改建议：在 owner `*.type.ts` 中定义命名类型，例如 facade 入参类型、任务绑定行类型、模板视图类型、审计日志装饰输入类型

#### M-05 Controller 单字段查询参数绕过 DTO

- 文件位置：
  - `apps/admin-api/src/modules/growth/experience/experience.controller.ts:44`
  - `apps/admin-api/src/modules/task/task.controller.ts:122`
- 对应规范：`02-controller.md`、`03-dto.md`，HTTP Controller 入参必须使用 DTO，平台通用 DTO 直接复用
- 违规原因：直接使用 `@Query('userId') userId: number`、`@Query('id', ParseIntPipe) id: number`
- 整改建议：改为 `@Query() dto: UserIdDto` 或 `IdDto`，由 DTO/管道统一表达文档与校验

#### M-06 论坛主题详情映射使用 `any`

- 文件位置：`apps/admin-api/src/modules/forum/topic/topic.controller.ts:52`、`apps/admin-api/src/modules/forum/topic/topic.controller.ts:155`
- 对应规范：`04-typescript-types.md`，禁止使用 `any`
- 违规原因：`mapTopicDetail(topic: Record<string, any>)` 与强制断言绕过了真实返回结构
- 整改建议：从 `ForumTopicService.getTopicById` 的返回类型推导命名类型，或在 owner type 中定义 admin 详情映射输入

#### M-07 新增转发型 barrel 文件

- 文件位置：`apps/admin-api/src/modules/content/novel/index.ts:1` 至 `apps/admin-api/src/modules/content/novel/index.ts:4`
- 对应规范：`01-import-boundaries.md`，禁止新增 `index.ts`、目录级转发入口
- 违规原因：该文件仅 `export *` 转发 controller/module
- 整改建议：删除该转发入口，调用方直连具体 owner 文件

#### M-08 服务层用 HTTP 异常表达可预期业务失败

- 文件位置：
  - `apps/admin-api/src/modules/content/comic/third-party/third-party-service.ts:16`
  - `apps/admin-api/src/modules/content/comic/third-party/libs/copy.service.ts:73`
  - `apps/admin-api/src/modules/content/comic/third-party/libs/copy.service.ts:107`
  - `apps/admin-api/src/modules/content/comic/third-party/libs/copy.service.ts:133`
  - `apps/admin-api/src/modules/content/comic/third-party/libs/copy.service.ts:159`
- 对应规范：`06-error-handling.md`，Service 对可预期业务失败抛 `BusinessException`
- 违规原因：三方平台不支持、解析服务失败等服务层可预期失败直接抛 `BadRequestException` / `InternalServerErrorException`
- 整改建议：使用共享业务错误码封装 `BusinessException`；未预期异常保留 cause 并交给全局过滤器

#### M-09 重试失败被吞掉并降级为 `false`

- 文件位置：`apps/admin-api/src/modules/message/message-monitor.service.ts:113`、`apps/admin-api/src/modules/message/message-monitor.service.ts:114`
- 对应规范：`06-error-handling.md`，禁止为了省事吞掉异常、降级为 `null` / `false` / 空数组而不保留错误语义
- 违规原因：`retryNotificationDeliveryByDispatchId` 捕获所有异常后直接返回 `false`，调用方无法区分非法 dispatchId、状态冲突、底层重试失败
- 整改建议：让底层异常按业务码返回，或至少记录结构化错误并返回明确失败原因 DTO

#### M-10 方法注释形式大面积不符合规则

- 文件位置示例：
  - `apps/admin-api/src/modules/auth/auth.controller.ts:28`
  - `apps/admin-api/src/modules/admin-user/admin-user.controller.ts:27`
  - `apps/admin-api/src/modules/message/message-template.controller.ts:19`
  - `apps/admin-api/src/modules/content/author/author.controller.ts:19`
  - `apps/admin-api/src/modules/comment/comment.controller.ts:31`
  - `apps/admin-api/src/modules/forum/section/forum-section.controller.ts:21`
  - `apps/admin-api/src/modules/message/message.controller.ts:20`
  - `apps/admin-api/src/modules/system/upload/upload.controller.ts:24`
- 对应规范：`05-comments.md`，每个方法定义前必须有紧邻行注释，禁止为方法使用 JSDoc
- 违规原因：大量方法使用 JSDoc，或只有 Swagger 装饰器没有方法行注释；装饰器与方法之间缺少紧邻 `//` 注释
- 整改建议：对每个方法在方法定义正上方补 1-2 行中文行注释；删除方法级 JSDoc，仅保留导出稳定符号的 JSDoc

#### M-11 Controller 查询/变更方法缺少方法注释

- 文件位置示例：
  - `apps/admin-api/src/modules/report/report.controller.ts:21`
  - `apps/admin-api/src/modules/report/report.controller.ts:30`
  - `apps/admin-api/src/modules/report/report.controller.ts:42`
  - `apps/admin-api/src/modules/growth/reward-rule/reward-rule.controller.ts:25`
  - `apps/admin-api/src/modules/growth/reward-rule/reward-rule.controller.ts:46`
  - `apps/admin-api/src/modules/forum/hashtag/forum-hashtag.controller.ts:28`
- 对应规范：`05-comments.md`，所有方法定义前都必须有简短注释
- 违规原因：这些方法没有任何方法用途注释
- 整改建议：按接口真实用途补紧邻行注释，避免复述函数名

#### M-12 `Ip2regionService` 服务层直接承接上传协议细节

- 文件位置：`apps/admin-api/src/modules/system/ip2region/ip2region.service.ts:76`、`apps/admin-api/src/modules/system/ip2region/ip2region.service.ts:93`、`apps/admin-api/src/modules/system/ip2region/ip2region.service.ts:190`
- 对应规范：`06-error-handling.md` 分层职责；Controller 接收入参，Service 定义业务规则
- 违规原因：Service 直接处理 `FastifyRequest` 上传对象并抛协议异常，协议边界和业务热切换逻辑耦合
- 整改建议：Controller 或专门 adapter 收口上传协议校验，Service 接收已验证的文件流/路径和 operator 信息，再抛业务异常

#### M-13 `copy.service.ts` 三方平台地址和协议参数硬编码在服务中

- 文件位置：`apps/admin-api/src/modules/content/comic/third-party/libs/copy.service.ts:27`、`apps/admin-api/src/modules/content/comic/third-party/libs/copy.service.ts:35`
- 对应规范：工程风格与配置治理要求；外部平台配置应可按环境调整
- 违规原因：三方 API 域名、平台号、版本号直接写在 service 字段中，后续环境切换或平台变更必须改代码
- 整改建议：迁移到配置项或受控常量，并在配置校验中标明默认值/环境覆盖方式

### LOW

#### L-01 测试中使用 `as never` 绕过类型契约

- 文件位置：`apps/admin-api/src/modules/forum/hashtag/forum-hashtag.controller.spec.ts:13`、`apps/admin-api/src/modules/forum/topic/topic.controller.spec.ts:17`
- 对应规范：`04-typescript-types.md` 边界类型与类型安全要求
- 违规原因：测试通过 `as never` 绕过构造依赖类型，容易让依赖契约漂移
- 整改建议：使用最小 mock 类型、`Partial<Pick<...>>` 的命名测试类型，或通过测试模块注入

#### L-02 best-effort 清理错误被完全忽略

- 文件位置：`apps/admin-api/src/modules/system/ip2region/ip2region.service.ts:147`、`apps/admin-api/src/modules/system/ip2region/ip2region.service.ts:251`
- 对应规范：`06-error-handling.md`，禁止吞异常不保留错误语义
- 违规原因：临时文件/旧 active 文件删除失败被 `catch(() => undefined)` 完全忽略，后续排查磁盘残留或权限问题缺少诊断信号
- 整改建议：保留 best-effort 行为，但至少记录结构化 warn 日志，包含路径和错误消息

## 逐文件审查结论

### 发现违规的文件

| 文件                                                                          | 结论                  |
| ----------------------------------------------------------------------------- | --------------------- |
| `apps/admin-api/.env.development`                                             | 发现 H-01             |
| `apps/admin-api/src/app.module.ts`                                            | 发现 M-01             |
| `apps/admin-api/src/common/decorators/api-audit-doc.decorator.ts`             | 发现 M-03             |
| `apps/admin-api/src/common/decorators/audit.types.ts`                         | 发现 M-02             |
| `apps/admin-api/src/config/app.config.ts`                                     | 发现 H-02             |
| `apps/admin-api/src/config/validation.config.ts`                              | 发现 H-02             |
| `apps/admin-api/src/modules/app-user/app-user-command.service.ts`             | 发现 M-03             |
| `apps/admin-api/src/modules/app-user/app-user.service.ts`                     | 发现 M-04             |
| `apps/admin-api/src/modules/auth/auth.controller.ts`                          | 发现 M-10             |
| `apps/admin-api/src/modules/admin-user/admin-user.controller.ts`              | 发现 M-10             |
| `apps/admin-api/src/modules/comment/comment.controller.ts`                    | 发现 M-10             |
| `apps/admin-api/src/modules/content/author/author.controller.ts`              | 发现 M-10             |
| `apps/admin-api/src/modules/content/comic/third-party/libs/copy.service.ts`   | 发现 M-03、M-08、M-13 |
| `apps/admin-api/src/modules/content/comic/third-party/third-party-service.ts` | 发现 M-08、M-10       |
| `apps/admin-api/src/modules/content/novel/index.ts`                           | 发现 M-07             |
| `apps/admin-api/src/modules/forum/hashtag/forum-hashtag.controller.spec.ts`   | 发现 L-01             |
| `apps/admin-api/src/modules/forum/hashtag/forum-hashtag.controller.ts`        | 发现 M-11             |
| `apps/admin-api/src/modules/forum/section/forum-section.controller.ts`        | 发现 M-10             |
| `apps/admin-api/src/modules/forum/topic/topic.controller.spec.ts`             | 发现 L-01             |
| `apps/admin-api/src/modules/forum/topic/topic.controller.ts`                  | 发现 M-06             |
| `apps/admin-api/src/modules/growth/experience/experience.controller.ts`       | 发现 M-05             |
| `apps/admin-api/src/modules/growth/growth.service.ts`                         | 发现 M-04             |
| `apps/admin-api/src/modules/growth/reward-rule/reward-rule.controller.ts`     | 发现 M-11             |
| `apps/admin-api/src/modules/message/message-monitor.service.ts`               | 发现 M-09             |
| `apps/admin-api/src/modules/message/message-template.controller.ts`           | 发现 M-10             |
| `apps/admin-api/src/modules/message/message-template.service.ts`              | 发现 M-04             |
| `apps/admin-api/src/modules/message/message.controller.ts`                    | 发现 M-10             |
| `apps/admin-api/src/modules/report/report.controller.ts`                      | 发现 M-11             |
| `apps/admin-api/src/modules/system/audit/audit.service.ts`                    | 发现 M-03、M-04       |
| `apps/admin-api/src/modules/system/ip2region/ip2region.service.ts`            | 发现 M-03、M-12、L-02 |
| `apps/admin-api/src/modules/system/upload/upload.controller.ts`               | 发现 M-10             |
| `apps/admin-api/src/modules/task/task.controller.ts`                          | 发现 M-05             |

### 已读且未发现明确违规的文件

以下每个文件均已逐行阅读，对照本次登记规范点未发现明确违规：

- `apps/admin-api/src/common/decorators/audit.decorator.ts`
- `apps/admin-api/src/common/interceptors/audit.interceptor.ts`
- `apps/admin-api/src/config/app.config.spec.ts`
- `apps/admin-api/src/global.d.ts`
- `apps/admin-api/src/main.ts`
- `apps/admin-api/src/modules/admin-user/admin-user.module.ts`
- `apps/admin-api/src/modules/admin-user/admin-user.service.ts`
- `apps/admin-api/src/modules/admin.module.ts`
- `apps/admin-api/src/modules/app-content/agreement/agreement.controller.ts`
- `apps/admin-api/src/modules/app-content/agreement/agreement.module.ts`
- `apps/admin-api/src/modules/app-content/announcement/announcement.controller.ts`
- `apps/admin-api/src/modules/app-content/announcement/announcement.module.ts`
- `apps/admin-api/src/modules/app-content/config/config.controller.ts`
- `apps/admin-api/src/modules/app-content/config/config.module.ts`
- `apps/admin-api/src/modules/app-content/page/page.controller.ts`
- `apps/admin-api/src/modules/app-content/page/page.module.ts`
- `apps/admin-api/src/modules/app-content/update/update.controller.ts`
- `apps/admin-api/src/modules/app-content/update/update.module.ts`
- `apps/admin-api/src/modules/app-user/app-user-growth.service.ts`
- `apps/admin-api/src/modules/app-user/app-user-query.service.ts`
- `apps/admin-api/src/modules/app-user/app-user.controller.ts`
- `apps/admin-api/src/modules/app-user/app-user.module.ts`
- `apps/admin-api/src/modules/app-user/app-user.service.support.ts`
- `apps/admin-api/src/modules/auth/admin-user-status.guard.ts`
- `apps/admin-api/src/modules/auth/auth.constant.ts`
- `apps/admin-api/src/modules/auth/auth.module.ts`
- `apps/admin-api/src/modules/auth/auth.service.ts`
- `apps/admin-api/src/modules/auth/token-storage.service.ts`
- `apps/admin-api/src/modules/check-in/check-in.controller.ts`
- `apps/admin-api/src/modules/check-in/check-in.module.ts`
- `apps/admin-api/src/modules/comment/comment.controller.spec.ts`
- `apps/admin-api/src/modules/comment/comment.module.ts`
- `apps/admin-api/src/modules/content/author/author.module.ts`
- `apps/admin-api/src/modules/content/category/category.controller.ts`
- `apps/admin-api/src/modules/content/category/category.module.ts`
- `apps/admin-api/src/modules/content/comic/chapter-content/chapter-content.controller.ts`
- `apps/admin-api/src/modules/content/comic/chapter-content/chapter-content.module.ts`
- `apps/admin-api/src/modules/content/comic/chapter/comic-chapter.controller.ts`
- `apps/admin-api/src/modules/content/comic/chapter/comic-chapter.module.ts`
- `apps/admin-api/src/modules/content/comic/core/comic.controller.ts`
- `apps/admin-api/src/modules/content/comic/core/comic.module.ts`
- `apps/admin-api/src/modules/content/comic/third-party/third-party.constant.ts`
- `apps/admin-api/src/modules/content/comic/third-party/third-party.controller.ts`
- `apps/admin-api/src/modules/content/comic/third-party/third-party.module.ts`
- `apps/admin-api/src/modules/content/content.module.ts`
- `apps/admin-api/src/modules/content/emoji/emoji-asset.controller.ts`
- `apps/admin-api/src/modules/content/emoji/emoji-pack.controller.ts`
- `apps/admin-api/src/modules/content/emoji/emoji.module.ts`
- `apps/admin-api/src/modules/content/novel/novel-chapter.controller.ts`
- `apps/admin-api/src/modules/content/novel/novel-content.controller.ts`
- `apps/admin-api/src/modules/content/novel/novel.controller.ts`
- `apps/admin-api/src/modules/content/novel/novel.module.ts`
- `apps/admin-api/src/modules/content/tag/tag.controller.ts`
- `apps/admin-api/src/modules/content/tag/tag.module.ts`
- `apps/admin-api/src/modules/forum/forum.module.ts`
- `apps/admin-api/src/modules/forum/hashtag/forum-hashtag.module.ts`
- `apps/admin-api/src/modules/forum/moderator-application/moderator-application.controller.ts`
- `apps/admin-api/src/modules/forum/moderator-application/moderator-application.module.ts`
- `apps/admin-api/src/modules/forum/moderator/moderator.controller.ts`
- `apps/admin-api/src/modules/forum/moderator/moderator.module.ts`
- `apps/admin-api/src/modules/forum/search/search.controller.ts`
- `apps/admin-api/src/modules/forum/search/search.module.ts`
- `apps/admin-api/src/modules/forum/section-group/forum-section-group.controller.ts`
- `apps/admin-api/src/modules/forum/section-group/forum-section-group.module.ts`
- `apps/admin-api/src/modules/forum/section/forum-section.module.ts`
- `apps/admin-api/src/modules/forum/sensitive-word/sensitive-word.controller.ts`
- `apps/admin-api/src/modules/forum/sensitive-word/sensitive-word.module.ts`
- `apps/admin-api/src/modules/forum/topic/topic.module.ts`
- `apps/admin-api/src/modules/growth/badge/badge.controller.ts`
- `apps/admin-api/src/modules/growth/badge/badge.module.ts`
- `apps/admin-api/src/modules/growth/experience/experience.module.ts`
- `apps/admin-api/src/modules/growth/growth.controller.ts`
- `apps/admin-api/src/modules/growth/growth.module.ts`
- `apps/admin-api/src/modules/growth/level-rule/level-rule.controller.ts`
- `apps/admin-api/src/modules/growth/level-rule/level-rule.module.ts`
- `apps/admin-api/src/modules/growth/reward-rule/reward-rule.module.ts`
- `apps/admin-api/src/modules/message/message.module.ts`
- `apps/admin-api/src/modules/report/report.module.ts`
- `apps/admin-api/src/modules/system/audit/audit.controller.ts`
- `apps/admin-api/src/modules/system/audit/audit.helpers.ts`
- `apps/admin-api/src/modules/system/audit/audit.module.ts`
- `apps/admin-api/src/modules/system/config/system-config.controller.ts`
- `apps/admin-api/src/modules/system/config/system-config.module.ts`
- `apps/admin-api/src/modules/system/dictionary/dictionary.controller.ts`
- `apps/admin-api/src/modules/system/dictionary/dictionary.module.ts`
- `apps/admin-api/src/modules/system/ip2region/ip2region.controller.ts`
- `apps/admin-api/src/modules/system/ip2region/ip2region.module.ts`
- `apps/admin-api/src/modules/system/upload/upload.module.ts`
- `apps/admin-api/src/modules/task/task.module.ts`
- `apps/admin-api/tsconfig.app.json`

## 必改项清单

1. 移除 `.env.development` 中真实/可用凭据，并轮换可能泄露的密码。
2. 移除 `APP_DEFAULT_PASSWORD` 的代码默认弱口令。
3. 修复 `@libs/platform/platform.module` 非白名单导入。
4. 删除或迁移 `content/novel/index.ts` 转发入口。
5. 将散落的顶层类型与复杂签名迁移到 owner `*.type.ts`。
6. 将 controller 单字段 query 改为 DTO。
7. 消除 `ForumTopicController` 中的 `any`。
8. 修正服务层吞异常和 HTTP 异常表达业务失败的问题。

## 优化建议清单

1. 对 admin-api 全量补齐方法级紧邻行注释，优先处理 controller 与 service。
2. 三方漫画平台配置迁移到环境配置或受控配置模块。
3. 将 `Ip2regionService` 的上传协议解析与热切换业务逻辑拆开。
4. 测试中的 `as never` 改成最小 mock 类型，降低测试对类型契约的绕过。

## 合规率总结

- 本模块按校验点统计合规率：35 / 52 = 67.31%
- 按已读文件统计：90 个文件未发现明确违规，32 个文件存在至少 1 项违规
- 结论：`apps/admin-api` 不建议直接通过规范审查；需先处理 HIGH 与 MEDIUM 项，再进入下一轮复核。
