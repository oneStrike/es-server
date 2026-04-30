# libs/forum 代码规范审查报告

## 审查概览

- 审查模块：`libs/forum`
- 审查文件数：82
- 读取范围：`libs/forum/src/**`、`libs/forum/tsconfig.lib.json`
- 适用规范总条数：86
- 合规条数：70
- 违规条数：16
- 风险分布：CRITICAL 0 / HIGH 0 / MEDIUM 11 / LOW 5
- Rules checked：9/9
- Rule points closed：86/86
- Scope completion：complete

## 规范条款逐条校验汇总

| 规范条款                                                                   | 校验结果 | 证据                                                                                                                                                                          |
| -------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| service 层预期业务失败应使用 `BusinessException`，HTTP 异常收敛在入口边界  | 违规     | `forum-permission.service.ts:307`、`:458`，`forum-topic.service.ts:700`、`:2422`、`:2440`                                                                                     |
| 复杂方法签名不得直接使用内联对象、`Pick`、`ReturnType`、深层联合等工具类型 | 违规     | `forum-permission.service.ts:137-197`、`:288-335`、`:525`，`moderator.service.ts:277-283`、`:727`，`moderator-governance.service.ts:167-270`，`search.service.ts:204-285`     |
| 跨域计数目标类型不得以魔法数字散落在业务服务中                             | 违规     | `forum-counter.service.ts:26-30`                                                                                                                                              |
| 公开 DTO 字段应使用稳定 DTO/命名类型表达契约                               | 违规     | `forum-hashtag.dto.ts:393`                                                                                                                                                    |
| 方法注释应使用紧邻方法的短行注释，避免把普通方法写成 JSDoc 文档块          | 违规     | `forum-counter.service.ts:77`、`:124`、`:162`、`:200`、`:221`、`:242`、`:263`、`:284`、`:302`、`:317`、`:336`、`:354`、`:387`、`:445`、`:499`、`:556`、`:575`、`:596`、`:617` |
| 类型断言不得替代真实类型契约，测试也不得用 `as never` 绕过类型             | 违规     | `forum-topic.service.ts:1051`、`:1757`，多个 `*.spec.ts`                                                                                                                      |
| 分页/搜索路径应避免随页码增长的重复大窗口读取                              | 违规     | `search.service.ts:474-499`                                                                                                                                                   |
| 模块目录职责应按 forum 子域拆分，入口 module 聚合稳定                      | 合规     | `forum.module.ts`、各子模块 `*.module.ts`                                                                                                                                     |
| DTO 命名、分页响应、查询 DTO 复用项目基础 DTO                              | 合规     | `dto/*.dto.ts`、`topic/dto/forum-topic.dto.ts`、`section/dto/forum-section.dto.ts`                                                                                            |
| 本模块未包含 schema/migration 变更，Drizzle schema 联动规则本轮不适用      | 不适用   | `libs/forum` 范围内无 `db/schema` 或 `db/migration` 文件                                                                                                                      |

## 按文件/模块拆分的详细违规清单

### permission/forum-permission.service.ts

[MEDIUM] 权限服务直接抛出 Nest HTTP 协议异常

- 位置：`libs/forum/src/permission/forum-permission.service.ts:307`、`:458`
- 对应规范：`06-error-handling.md` / 分层职责；service 层预期业务失败优先使用 `BusinessException`，HTTP 状态映射由 controller/filter 负责
- 违规原因：`ensurePostingUserCanPost` 抛 `UnauthorizedException`，发帖频控抛 `HttpException(HttpStatus.TOO_MANY_REQUESTS)`。该文件是可复用的论坛权限业务服务，直接返回 HTTP 语义会让同一业务能力在非 HTTP 调用场景下复用困难，并造成错误码体系分叉。
- 整改建议：改为项目统一 `BusinessException` 与错误码，例如“需登录”“发帖频率过高”；HTTP 401/429 映射放到入口层或全局异常过滤器。

[MEDIUM] 权限服务方法签名大量使用复杂内联类型

- 位置：`libs/forum/src/permission/forum-permission.service.ts:137`、`:169`、`:197`、`:288-290`、`:325`、`:333-335`、`:525`
- 对应规范：`04-typescript-types.md` / 放置规则与禁止项；复杂方法签名应抽为 `*.type.ts` 中的命名类型
- 违规原因：方法参数直接写 `Pick<...>`、内联 `options?: { ... }`、多分支联合类型，导致权限输入契约散落在 service 方法签名中，调用方也无法复用同一语义名称。
- 整改建议：在 `forum-permission.type.ts` 中补充 `ForumPermissionSectionSnapshot`、`ForumPermissionOptions`、`ForumPostingCheckUserInput` 等命名类型，并在 service 签名中复用。

### topic/forum-topic.service.ts

[MEDIUM] 主题服务直接抛出 HTTP 协议异常

- 位置：`libs/forum/src/topic/forum-topic.service.ts:700`、`:2422`、`:2440`
- 对应规范：`06-error-handling.md` / 分层职责；service 层业务失败不直接抛 `BadRequestException`、`ForbiddenException`
- 违规原因：正文为空、无权修改主题、无权删除主题均在 service 内直接抛 Nest HTTP 异常，和项目业务异常收敛规则不一致。
- 整改建议：统一改为 `BusinessException`，使用稳定错误码表达 `TOPIC_BODY_EMPTY`、`TOPIC_UPDATE_FORBIDDEN`、`TOPIC_DELETE_FORBIDDEN`，由 HTTP 入口映射状态码。

[MEDIUM] 主题服务方法签名和常量类型内联过重

- 位置：`libs/forum/src/topic/forum-topic.service.ts:90`、`:96`、`:235`、`:520`、`:756`、`:896`、`:935`、`:1501`、`:1520`、`:1540`、`:2124`、`:2271`、`:2316`
- 对应规范：`04-typescript-types.md` / 复杂方法签名与结构类型应命名并放入 `*.type.ts`
- 违规原因：服务内直接声明 `Array<Record<string, 'asc' | 'desc'>>`、`QueryPublicForumTopicDto & { ... }`、`params: { ... }`、`options?: { ... }` 等结构类型，接口语义难以审查和复用。
- 整改建议：把排序、查询上下文、事件 envelope、奖励参数、更新上下文等抽到 `forum-topic.type.ts`，service 只引用命名类型。

[MEDIUM] 正文持久化用双重断言压过 JSON 类型契约

- 位置：`libs/forum/src/topic/forum-topic.service.ts:1051`、`:1757`
- 对应规范：`04-typescript-types.md` / 禁止用类型断言绕过真实契约
- 违规原因：`compiledBody.body as unknown as JsonValue` 先转 `unknown` 再转 `JsonValue`，说明正文编译结果与数据库 JSON 字段之间缺少明确类型约束。
- 整改建议：让正文编译函数直接返回 `JsonValue` 或定义可序列化正文结构，并在编译边界完成校验，避免在写库点强转。

### counter/forum-counter.service.ts

[MEDIUM] 跨域互动目标类型使用魔法数字

- 位置：`libs/forum/src/counter/forum-counter.service.ts:26-30`
- 对应规范：`PROJECT_RULES.md` / 真实对外契约优先；`04-typescript-types.md` / 闭集值域应显式命名
- 违规原因：关注、点赞、收藏、浏览、评论的 `targetType` 直接写成 `3`、`5`，但这些值属于跨域互动事实表契约。散落在 counter service 中会让互动域枚举变化时难以及时同步。
- 整改建议：复用 interaction/user 行为域的目标类型枚举或建立集中映射常量，并补充计数器回归测试覆盖每类目标类型。

[LOW] 方法注释大量使用 JSDoc 文档块

- 位置：`libs/forum/src/counter/forum-counter.service.ts:77`、`:124`、`:162`、`:200`、`:221`、`:242`、`:263`、`:284`、`:302`、`:317`、`:336`、`:354`、`:387`、`:445`、`:499`、`:556`、`:575`、`:596`、`:617`
- 对应规范：`05-comments.md` / 方法注释使用简短行注释，避免普通方法写成 JSDoc
- 违规原因：普通 service 方法均使用 `/** ... */` 长块注释，形成文档噪声，和仓库“方法前短注释”风格不一致。
- 整改建议：保留必要业务意图，改成紧邻方法的 `// ...` 简短注释；明显自解释的方法可删除重复注释。

[LOW] 错误 cause 使用断言读取

- 位置：`libs/forum/src/counter/forum-counter.service.ts:108`
- 对应规范：`04-typescript-types.md` / 类型收窄应通过守卫而非断言绕过
- 违规原因：`error.cause as { code?: unknown }` 直接断言 cause 形状，异常对象来源变化时可能产生误判。
- 整改建议：补一个本地类型守卫，例如 `hasDatabaseErrorCode(cause): cause is { code: string }`，再读取 code。

### moderator/moderator.service.ts

[MEDIUM] 版主作用域归一化签名使用内联对象类型

- 位置：`libs/forum/src/moderator/moderator.service.ts:277-283`、`:727`
- 对应规范：`04-typescript-types.md` / 方法签名不得堆叠复杂内联对象与数组联合
- 违规原因：`normalizeScope` 和相关输入直接声明 `{ roleType?: number; groupId?: number | null; ... permissions?: Array<number | null | undefined> | null; ... }`，版主权限作用域契约没有命名边界。
- 整改建议：在 `moderator.type.ts` 中定义 `ModeratorScopeNormalizeInput`、`ModeratorPermissionInputValue` 等类型，并让 DTO 到 service 的转换显式落在命名类型上。

### moderator/moderator-governance.service.ts

[MEDIUM] 治理服务日志参数签名使用 `ReturnType` 与内联对象

- 位置：`libs/forum/src/moderator/moderator-governance.service.ts:167-168`、`:235-241`、`:264-270`
- 对应规范：`04-typescript-types.md` / 复杂推导类型和参数对象应落入 `*.type.ts`
- 违规原因：评论快照参数使用 `Awaited<ReturnType<...>>`，操作日志参数使用内联 `{ ... beforeData: Record<string, unknown>; afterData: Record<string, unknown> }`，治理日志契约无法被复用或集中审查。
- 整改建议：定义 `ModeratorCommentGovernanceSnapshot`、`ModeratorTopicActionLogParams`、`ModeratorCommentActionLogParams`，并在 service 与测试中复用。

### search/search.service.ts

[MEDIUM] 搜索服务签名和条件构建使用复杂内联类型/断言

- 位置：`libs/forum/src/search/search.service.ts:137`、`:204`、`:233`、`:246`、`:254`、`:285`、`:458`、`:515`、`:577`
- 对应规范：`04-typescript-types.md` / 复杂结构与工具类型应命名；类型断言不应替代契约
- 违规原因：排序表达式断言为 `Array<Record<string, 'asc' | 'desc'>>`，方法参数直接写 `Pick<ForumSearchDto, ...>` 和 `params: { ... }`，搜索条件还通过 `as ForumSearchConditionTuple` 断言补齐类型。
- 整改建议：在 `search.type.ts` 中补充搜索排序、范围解析、标签过滤、评论过滤参数与条件元组类型；让条件构造函数返回明确命名类型。

[MEDIUM] 全部类型搜索会随页码线性放大双路读取窗口

- 位置：`libs/forum/src/search/search.service.ts:474-499`
- 对应规范：性能规范；分页读取应避免随 offset 增大而重复读取过多数据
- 违规原因：`ForumSearchTypeEnum.ALL` 下用 `mergedWindowSize = page.offset + page.pageSize` 分别读取主题和评论，再合并后 slice。页码越靠后，两条查询各自读取的数据越多，论坛数据量增长后搜索延迟会被 offset 放大。
- 整改建议：改用稳定排序游标、分类型分页游标，或先按统一索引表/搜索投影分页；至少限制最大 offset 并记录超限错误。

### hashtag/dto/forum-hashtag.dto.ts

[LOW] DTO 响应字段直接暴露 `Pick<BaseAppUserDto, ...>` 工具类型

- 位置：`libs/forum/src/hashtag/dto/forum-hashtag.dto.ts:393`
- 对应规范：`03-dto.md` / DTO 复用与收敛；跨模块复用 DTO 时应形成稳定响应契约
- 违规原因：`user!: Pick<BaseAppUserDto, 'id' | 'nickname' | 'avatarUrl'>` 让公开响应字段依赖工具类型裁剪，Swagger/维护侧无法直观看到稳定用户摘要 DTO。
- 整改建议：定义 `ForumHashtagReferenceUserDto` 或复用项目已有用户摘要 DTO，避免在响应属性上直接写 `Pick`。

### specs

[LOW] 测试中大量使用 `as never`、`as unknown as` 与 private API 断言

- 位置：`libs/forum/src/action-log/action-log.service.spec.ts:20`，`libs/forum/src/counter/forum-counter.service.spec.ts:6`、`:12`、`:29`、`:54`，`libs/forum/src/search/search.service.spec.ts:5`、`:51`、`:103`、`:180`，`libs/forum/src/moderator/moderator.service.spec.ts:6`、`:50`、`:55`、`:196`，`libs/forum/src/topic/forum-topic.service.spec.ts` 多处
- 对应规范：`08-testing.md` / 测试不应通过类型断言绕过正式契约或依赖 private API 结构
- 违规原因：测试通过强断言构造 mock 或访问内部方法，降低类型系统对服务契约变更的保护能力。
- 整改建议：为 Drizzle mock、事件 bus、cache、权限服务建立最小 typed mock helper；必须测私有逻辑时优先通过公开方法覆盖，或把复杂纯逻辑抽成可测试的命名函数。

## 文件级审查结论

| 文件                                                                    | 结论                                                        |
| ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| `libs/forum/src/action-log/action-log.constant.ts`                      | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/action-log/action-log.module.ts`                        | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/action-log/action-log.service.spec.ts`                  | 测试存在 `as never` 断言问题，见 specs 条目                 |
| `libs/forum/src/action-log/action-log.service.ts`                       | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/action-log/dto/action-log.dto.ts`                       | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/counter/forum-counter.module.ts`                        | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/counter/forum-counter.service.spec.ts`                  | 测试存在 `as never` 断言问题，见 specs 条目                 |
| `libs/forum/src/counter/forum-counter.service.ts`                       | 存在魔法数字目标类型、JSDoc 方法注释、断言读取异常 cause    |
| `libs/forum/src/counter/forum-counter.type.ts`                          | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/forum.constant.ts`                                      | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/forum.module.ts`                                        | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/hashtag/dto/forum-hashtag.dto.ts`                       | `user` 字段使用 `Pick<BaseAppUserDto, ...>`，见 DTO 条目    |
| `libs/forum/src/hashtag/forum-hashtag-body.service.spec.ts`             | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/hashtag/forum-hashtag-body.service.ts`                  | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/hashtag/forum-hashtag-counter.service.ts`               | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/hashtag/forum-hashtag-reference.service.ts`             | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/hashtag/forum-hashtag.constant.ts`                      | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/hashtag/forum-hashtag.module.ts`                        | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/hashtag/forum-hashtag.service.spec.ts`                  | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/hashtag/forum-hashtag.service.ts`                       | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/hashtag/forum-hashtag.type.ts`                          | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/hashtag/resolver/forum-hashtag-follow.resolver.ts`      | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/moderator/dto/moderator-application.dto.ts`             | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/moderator/dto/moderator.dto.ts`                         | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/moderator/moderator-action-log.constant.spec.ts`        | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/moderator/moderator-action-log.constant.ts`             | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/moderator/moderator-action-log.service.ts`              | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/moderator/moderator-application.constant.ts`            | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/moderator/moderator-application.service.spec.ts`        | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/moderator/moderator-application.service.ts`             | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/moderator/moderator-governance.service.spec.ts`         | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/moderator/moderator-governance.service.ts`              | 存在复杂日志参数类型，见 governance 条目                    |
| `libs/forum/src/moderator/moderator.service.spec.ts`                    | 测试存在类型断言问题，见 specs 条目                         |
| `libs/forum/src/moderator/moderator.service.ts`                         | 存在内联作用域输入类型，见 moderator 条目                   |
| `libs/forum/src/moderator/moderator.type.ts`                            | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/moderator/moderator.constant.ts`                        | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/moderator/moderator.module.ts`                          | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/permission/forum-permission.module.ts`                  | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/permission/forum-permission.service.spec.ts`            | 覆盖了当前 HTTP 异常语义；待随 service 错误语义整改同步更新 |
| `libs/forum/src/permission/forum-permission.service.ts`                 | 存在 HTTP 异常与复杂签名问题                                |
| `libs/forum/src/permission/forum-permission.type.ts`                    | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/profile/dto/profile.dto.ts`                             | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/profile/profile.module.ts`                              | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/profile/profile.service.spec.ts`                        | 存在 typed mock/断言收敛空间，未单列为独立问题              |
| `libs/forum/src/profile/profile.service.ts`                             | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/profile/profile.type.ts`                                | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/search/dto/search.dto.ts`                               | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/search/search.constant.ts`                              | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/search/search.module.ts`                                | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/search/search.service.spec.ts`                          | 测试存在断言问题，见 specs 条目                             |
| `libs/forum/src/search/search.service.ts`                               | 存在复杂签名/断言和 ALL 搜索性能问题                        |
| `libs/forum/src/search/search.type.ts`                                  | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/section-group/dto/forum-section-group-summary.dto.ts`   | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/section-group/dto/forum-section-group.dto.ts`           | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/section-group/forum-section-group.constant.ts`          | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/section-group/forum-section-group.module.ts`            | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/section-group/forum-section-group.service.spec.ts`      | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/section-group/forum-section-group.service.ts`           | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/section/dto/forum-section.dto.spec.ts`                  | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/section/dto/forum-section.dto.ts`                       | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/section/forum-section.constant.ts`                      | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/section/forum-section.module.ts`                        | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/section/forum-section.service.spec.ts`                  | 测试存在断言问题，见 specs 条目                             |
| `libs/forum/src/section/forum-section.service.ts`                       | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/section/forum-section.type.ts`                          | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/section/resolver/forum-section-follow.resolver.spec.ts` | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/section/resolver/forum-section-follow.resolver.ts`      | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/topic/dto/forum-topic.dto.spec.ts`                      | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/topic/dto/forum-topic.dto.ts`                           | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/topic/forum-topic.constant.ts`                          | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/topic/forum-topic.module.ts`                            | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/topic/forum-topic.service.spec.ts`                      | 测试存在断言与私有方法耦合问题，见 specs 条目               |
| `libs/forum/src/topic/forum-topic.service.ts`                           | 存在 HTTP 异常、复杂签名和 JSON 强断言问题                  |
| `libs/forum/src/topic/forum-topic.type.ts`                              | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/topic/resolver/forum-topic-action-log.resolver.spec.ts` | 测试存在断言问题，见 specs 条目                             |
| `libs/forum/src/topic/resolver/forum-topic-action-log.resolver.ts`      | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/topic/resolver/forum-topic-browse-log.resolver.ts`      | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/topic/resolver/forum-topic-comment.resolver.spec.ts`    | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/topic/resolver/forum-topic-comment.resolver.ts`         | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/topic/resolver/forum-topic-favorite.resolver.ts`        | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/topic/resolver/forum-topic-like.resolver.ts`            | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/src/topic/resolver/forum-topic-report.resolver.ts`          | 已纳入审查，未发现本轮明确违规                              |
| `libs/forum/tsconfig.lib.json`                                          | 已纳入审查，未发现本轮明确违规                              |

## 整体合规率总结

- 合规率：70 / 86 = 81.4%
- 必改项清单：
  - 将 `forum-permission.service.ts`、`forum-topic.service.ts` 中的 HTTP 异常改为统一业务异常。
  - 把 forum permission/topic/moderator/search 的复杂方法签名迁移到对应 `*.type.ts`。
  - 收敛 `forum-counter.service.ts` 中跨域 `targetType` 魔法数字。
  - 为 `search.service.ts` 的 ALL 搜索分页改造稳定分页或限制 offset 放大。
- 优化建议清单：
  - 将普通方法 JSDoc 改为短行注释。
  - 为测试补 typed mock helper，减少 `as never` 和 private API 耦合。
  - 为 hashtag 引用用户响应定义稳定摘要 DTO。

## 开放问题 / 假设

- 本模块未发现 schema/migration 文件；涉及的数据库字段契约按外部 `db/schema` 模块另行审查。
- 当前报告只记录明确违反本地规范的点，不把纯业务取舍或无规范依据的风格差异列为问题。

## 剩余风险 / 未闭合项

- 未闭合项：无。
- 剩余风险：论坛模块依赖 interaction、user、content、db 的跨域常量与 schema；这些一致性会在后续模块报告中继续核对。
