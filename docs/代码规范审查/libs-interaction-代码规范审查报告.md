# libs/interaction 代码规范审查报告

## 审查概览

- 审查模块：`libs/interaction`
- 审查文件数：102
- 读取范围：`libs/interaction/src/**`、`libs/interaction/tsconfig.lib.json`
- 适用规范总条数：86
- 合规条数：62
- 违规条数：24
- 风险分布：CRITICAL 0 / HIGH 0 / MEDIUM 15 / LOW 9
- Rules checked：9/9
- Rule points closed：86/86
- Scope completion：complete

## 规范条款逐条校验汇总

| 规范条款                                                                                        | 校验结果 | 证据                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| service / resolver 可预期业务失败应使用 `BusinessException`                                     | 违规     | `body-html-codec.service.ts:50-548`、`body-link.helper.ts:25-39`、`body-text.helper.ts:288-317`、`body-validator.service.ts:26-259`、`comment.service.ts:188`、`:416`、`favorite.service.ts:69`、`like.service.ts:70`、`follow.service.ts:64`、`report.service.ts:125`、`purchase.service.ts:74`、`download.service.ts:55`、`reading-state.service.ts:68` |
| 纯 TS 类型/接口必须放入 `*.type.ts`，不得散落在 `*.service.ts`、`*.helper.ts`、`*.interface.ts` | 违规     | `body-text.helper.ts:11`、`report.service.ts:23`、`:41`、`interfaces/*.interface.ts` 多处                                                                                                                                                                                                                                                                 |
| 复杂方法签名不得直接使用内联对象、`Pick`、`ReturnType`、`Record`、深层泛型                      | 违规     | `body-compiler.service.ts:46`、`comment.service.ts:216`、`:233`、`:566`、`:591`、`:623`、`:835`、`:977`，`favorite.service.ts:120`，`follow.service.ts:127`、`:206`，`purchase.service.ts:85`                                                                                                                                                             |
| 不得用 `as never`、`as unknown as` 或宽泛 `any` 绕过类型契约                                    | 违规     | `body-html-codec.service.ts:335-356`、`body-validator.service.ts:59`、`:253`、`:274`、`comment.service.ts:1224`、`:1439`                                                                                                                                                                                                                                  |
| 普通业务服务应使用项目 Logger，不直接 `console.warn`                                            | 违规     | `favorite.service.ts:56`、`follow.service.ts:55`、`browse-log.service.ts:41`、`comment.service.ts:173`、`report.service.ts:112`、`purchase.service.ts:61`、`download.service.ts:44`、`reading-state.service.ts:59`、`like.service.ts:59`                                                                                                                  |
| 方法注释用短行注释，不使用 JSDoc；注释不得与错误语义不一致                                      | 违规     | `comment.service.ts:73-1772`、`like.service.ts:50-177`、`interfaces/*` 的 `@throws BadRequestException`                                                                                                                                                                                                                                                   |
| 写路径应显式处理数据库返回空结果，避免空值继续驱动副作用                                        | 违规     | `favorite.service.ts:145-165`                                                                                                                                                                                                                                                                                                                             |
| 测试不得用 `as never` / private API 断言绕过契约                                                | 违规     | `comment.service.spec.ts:36-214`、`favorite.service.spec.ts:30-50`、`body-compiler.service.spec.ts:50`                                                                                                                                                                                                                                                    |
| 导入边界必须使用白名单入口和 owner 文件直连                                                     | 合规     | 未发现 `@db/*` / `@libs/platform/*` 白名单外导入；业务域基本直连 owner 文件                                                                                                                                                                                                                                                                               |
| 本模块未包含 schema/migration 文件，Drizzle schema 联动规则本轮不适用                           | 不适用   | `libs/interaction` 范围内无 `db/schema` 或 `db/migration` 文件                                                                                                                                                                                                                                                                                            |

## 按文件/模块拆分的详细违规清单

### body/body-html-codec.service.ts

[MEDIUM] 正文 HTML 解析服务直接抛出 HTTP 400 异常

- 位置：`libs/interaction/src/body/body-html-codec.service.ts:50`、`:124`、`:198`、`:208`、`:270`、`:279`、`:315`、`:329`、`:345`、`:353`、`:371`、`:385`、`:396`、`:408`、`:419`、`:431`、`:435`、`:438`、`:459`、`:468`、`:483`、`:498`、`:526`、`:542`、`:548`
- 对应规范：`06-error-handling.md` / service 可预期业务失败使用 `BusinessException`
- 违规原因：HTML 白名单校验、标签闭合、节点结构非法等用户输入错误均在 service 中直接抛 `BadRequestException`。该 codec 被评论等业务服务复用，错误语义应由业务层或入口层统一映射。
- 整改建议：将解析失败收敛为统一业务异常或专用正文解析错误类型，再由 controller/filter 映射协议层 400。

[MEDIUM] HTML body 构造中使用 `as never` 压过节点类型

- 位置：`libs/interaction/src/body/body-html-codec.service.ts:335`、`:338`、`:356`
- 对应规范：`04-typescript-types.md` / 禁止使用断言绕过类型契约
- 违规原因：列表块、栈条目和 listItem 入栈使用 `as never`，说明 canonical body 的联合类型没有被正确收窄。
- 整改建议：拆分 `BodyListBlock`、`BodyListItemNode`、`BodyBlockStackEntry` 等命名类型，并用类型守卫分支构造节点。

### body/body-validator.service.ts

[MEDIUM] body 校验服务使用 HTTP 异常、`as never` 和 `any`

- 位置：`libs/interaction/src/body/body-validator.service.ts:26-259`、`:59`、`:253`、`:274`
- 对应规范：`06-error-handling.md`、`04-typescript-types.md`
- 违规原因：canonical body 结构非法时直接抛 `BadRequestException`；`allowedBlockTypes.includes(rawBlock.type as never)`、`BODY_TEXT_MARK_TYPES.includes(mark.type as never)` 使用断言；`isRecord(value): value is Record<string, any>` 使用 `any`。
- 整改建议：定义正文校验错误类型或 `BusinessException`；把候选节点先收窄为字符串闭集，再判断 includes；将 `any` 改为 `unknown` 并逐项守卫。

### body/body-text.helper.ts

[MEDIUM] helper 文件内定义类型且直接抛 HTTP 异常

- 位置：`libs/interaction/src/body/body-text.helper.ts:11`、`:288`、`:297`、`:302`、`:317`
- 对应规范：`04-typescript-types.md` / `06-error-handling.md`
- 违规原因：`BodySegment` 是纯类型，却放在 helper 文件；提及文本位置非法、区间重叠等正文业务校验直接抛 `BadRequestException`。
- 整改建议：把 `BodySegment` 移到 `body.type.ts`；正文校验失败统一走业务异常或正文解析错误。

### body/body-link.helper.ts

[MEDIUM] link href 校验失败直接抛 HTTP 异常

- 位置：`libs/interaction/src/body/body-link.helper.ts:25`、`:28`、`:31`、`:39`
- 对应规范：`06-error-handling.md` / helper/service 可预期失败不应直接绑定 HTTP 协议
- 违规原因：空 href、控制字符、协议相对地址、协议不在白名单都直接抛 `BadRequestException`。
- 整改建议：改为正文解析错误或 `BusinessException`，由调用方决定映射到 HTTP 400。

### comment/comment.service.ts

[MEDIUM] 评论服务直接抛 HTTP 异常并混用 `console.warn`

- 位置：`libs/interaction/src/comment/comment.service.ts:173`、`:188`、`:416`
- 对应规范：`06-error-handling.md`、日志与诊断规范
- 违规原因：解析器重复注册使用 `console.warn`，不支持评论目标和正文为空直接抛 `BadRequestException`。
- 整改建议：使用 `Logger` 输出结构化 warn；目标类型不支持和正文为空改为 `BusinessException` 或正文解析错误。

[MEDIUM] 评论服务签名和持久化映射类型过重

- 位置：`libs/interaction/src/comment/comment.service.ts:216`、`:233`、`:566`、`:591`、`:623`、`:835`、`:977`
- 对应规范：`04-typescript-types.md` / 复杂对象参数、`ReturnType` 应抽命名类型
- 违规原因：审核状态、事件 envelope、可见条件、回复预览、奖励事件等参数直接写内联对象或 `ReturnType`，服务主文件持续膨胀。
- 整改建议：补充 `CommentGovernanceStatusInput`、`CommentCreatedEventEnvelopeInput`、`VisibleRootCommentConditionInput`、`ReplyPreviewBundleInput`、`CommentRewardEventInput` 等命名类型到 `comment.type.ts`。

[MEDIUM] 评论正文 JSON 写库使用双重断言

- 位置：`libs/interaction/src/comment/comment.service.ts:1224`、`:1439`
- 对应规范：`04-typescript-types.md` / 禁止用 `as unknown as` 绕过类型
- 违规原因：`compiledBody.body as unknown as JsonValue` 表示 body compiler 输出与数据库 JSON 字段之间缺少明确类型契约。
- 整改建议：让 `CompiledBodyResult.body` 直接实现 `JsonValue` 或新增可序列化正文类型，并在 compiler 边界完成校验。

### favorite/favorite.service.ts

[MEDIUM] 收藏插入结果可能为空但后续继续触发副作用并读取 `record.id`

- 位置：`libs/interaction/src/favorite/favorite.service.ts:145-165`
- 对应规范：语法逻辑与边界处理；数据库写入结果必须显式处理空返回
- 违规原因：`const favoriteRecord = rows[0] ?? null` 后没有检查 null，仍然更新用户计数、目标计数、执行 hook、发放成长奖励，最后 `return { id: record.id }` 可能运行时崩溃。
- 整改建议：和 `follow.service.ts` 对齐，`rows[0]` 为空时立即抛稳定异常并中断事务；或使用 `drizzle.assertAffectedRows`/返回行断言。

[MEDIUM] 收藏服务直接抛 HTTP 异常且返回类型使用 `Pick`

- 位置：`libs/interaction/src/favorite/favorite.service.ts:69`、`:120`
- 对应规范：`06-error-handling.md`、`04-typescript-types.md`
- 违规原因：不支持的收藏类型抛 `BadRequestException`；`Promise<Pick<UserFavoriteSelect, 'id'>>` 直接出现在方法签名。
- 整改建议：改为 `BusinessException`；在 `favorite.type.ts` 定义 `FavoriteCreatedResult`。

### like/like.service.ts

[MEDIUM] 点赞服务直接抛 HTTP 异常并使用 JSDoc 方法注释

- 位置：`libs/interaction/src/like/like.service.ts:59`、`:70`、`:50-177`
- 对应规范：`06-error-handling.md`、`05-comments.md`
- 违规原因：目标类型不支持抛 `BadRequestException`；普通方法使用多段 JSDoc，且 `@throws BadRequestException` 与规范期望的业务异常不一致。
- 整改建议：改为 `BusinessException`；方法注释改为短行注释，删除 `@throws BadRequestException`。

### follow/follow.service.ts

[MEDIUM] 关注服务直接抛 HTTP 异常，复杂返回类型未命名

- 位置：`libs/interaction/src/follow/follow.service.ts:64`、`:127`、`:206-210`
- 对应规范：`06-error-handling.md`、`04-typescript-types.md`
- 违规原因：不支持关注类型抛 `BadRequestException`；`Promise<Pick<UserFollowSelect, 'id'>>` 和 `Promise<{ isFollowing; ... }>` 直接写在 service 签名。
- 整改建议：改为 `BusinessException`；新增 `FollowCreatedResult`、`FollowStatusResult` 类型。

### report/report.service.ts

[MEDIUM] 举报服务文件内定义类型/接口，且 service 层抛 HTTP 异常

- 位置：`libs/interaction/src/report/report.service.ts:23-45`、`:125`
- 对应规范：`04-typescript-types.md`、`06-error-handling.md`
- 违规原因：`CreateUserReportPayload`、`CreateUserReportOptions` 定义在 service 文件内；不支持举报目标类型抛 `BadRequestException`。
- 整改建议：移动到 `report.type.ts`；错误语义改为 `BusinessException`。

### purchase/purchase.service.ts

[MEDIUM] 购买服务直接抛 HTTP 异常并用内联 execute 结果类型/断言

- 位置：`libs/interaction/src/purchase/purchase.service.ts:74`、`:85-89`、`:331-339`、`:432-455`
- 对应规范：`06-error-handling.md`、`04-typescript-types.md`
- 违规原因：不支持购买类型抛 `BadRequestException`；`extractRows<T>(result: { rows?: T[] | null } | object | null | undefined)` 和 `(result as { rows?: T[] | null })` 分散在 service 内。
- 整改建议：使用命名 `DrizzleExecuteRowsResult<T>` 类型或公共 helper；购买类型不支持改为 `BusinessException`。

### download/download.service.ts

[MEDIUM] 下载服务直接抛 HTTP 异常并用内联 execute 结果类型

- 位置：`libs/interaction/src/download/download.service.ts:55`、`:59-65`
- 对应规范：`06-error-handling.md`、`04-typescript-types.md`
- 违规原因：不支持下载业务类型抛 `BadRequestException`；`extractRows` 使用内联泛型结果结构和断言。
- 整改建议：改为 `BusinessException`；抽出共享 execute rows 类型/守卫。

### reading-state/reading-state.service.ts

[MEDIUM] 阅读状态服务直接抛 HTTP 异常并吞掉同步失败

- 位置：`libs/interaction/src/reading-state/reading-state.service.ts:68`、`:128-136`、`:160-168`
- 对应规范：`06-error-handling.md` / 可预期业务失败用 `BusinessException`；禁止为了省事吞掉异常而不保留错误语义
- 违规原因：不支持阅读状态业务类型抛 `BadRequestException`；安全同步方法 catch 后只写 warn，没有把失败语义作为可观测结果返回或补偿记录。
- 整改建议：不支持类型改为 `BusinessException`；安全同步方法如确需降级，应返回 `{ success:false, reason }` 或接入统一补偿/指标记录。

### interfaces/\*.interface.ts

[MEDIUM] 多个纯接口文件使用 `.interface.ts` 命名，未按 `*.type.ts` 收敛

- 位置：`libs/interaction/src/browse-log/interfaces/browse-log-target-resolver.interface.ts:8`，`favorite/interfaces/favorite-target-resolver.interface.ts:8`、`:13`，`comment/interfaces/comment-target-resolver.interface.ts:8`、`:21`、`:36`，`purchase/interfaces/purchase-target-resolver.interface.ts:7`，`report/interfaces/report-target-resolver.interface.ts:9`、`:25`，`like/interfaces/like-target-resolver.interface.ts:9`、`:27`，`download/interfaces/download-target-resolver.interface.ts:8`，`reading-state/interfaces/reading-state-resolver.interface.ts:7`、`:19`、`:31`，`follow/interfaces/follow-target-resolver.interface.ts:4`
- 对应规范：`04-typescript-types.md` / 纯 TS type/interface 统一放在 `*.type.ts`
- 违规原因：resolver contract 纯接口散落在 `interfaces/*.interface.ts`，并且部分 JSDoc 写 `@throws BadRequestException`，与错误处理规范不一致。
- 整改建议：迁移为各子域 `*.type.ts`，例如 `favorite-target-resolver.type.ts`，并同步更新导入路径和注释。

### emoji/emoji.type.ts

[LOW] 类型注释重复堆叠

- 位置：`libs/interaction/src/emoji/emoji.type.ts:9-155`
- 对应规范：`05-comments.md` / 同一符号只保留一组有效注释
- 违规原因：多个类型前先有一段 JSDoc，再追加“稳定领域类型 `X`...”的第二段 JSDoc，形成重复模板注释。
- 整改建议：每个导出类型保留一段解释业务语义的 JSDoc，删除模板化重复句。

### registerResolver 日志

[LOW] 业务服务直接使用 `console.warn`

- 位置：`libs/interaction/src/favorite/favorite.service.ts:56`、`follow.service.ts:55`、`browse-log.service.ts:41`、`comment.service.ts:173`、`report.service.ts:112`、`purchase.service.ts:61`、`download.service.ts:44`、`reading-state.service.ts:59`、`like.service.ts:59`
- 对应规范：`06-error-handling.md` / 日志与诊断应结构化记录
- 违规原因：resolver 重复注册警告直接输出到 console，无法纳入 Nest Logger 的结构化上下文和日志级别控制。
- 整改建议：统一注入或使用 `Logger`，记录 resolver 类型、旧 resolver、新 resolver 等结构化字段。

### specs

[LOW] 测试大量使用断言和 private API

- 位置：`libs/interaction/src/comment/comment.service.spec.ts:36-214`，`libs/interaction/src/favorite/favorite.service.spec.ts:30-50`，`libs/interaction/src/body/body-compiler.service.spec.ts:50`
- 对应规范：`08-testing.md` / 测试不应通过 `as never`、private API 断言绕过类型
- 违规原因：mock 通过 `{} as never`、`resolver as never`、`service as unknown as ...` 构造，难以及时发现依赖契约漂移。
- 整改建议：建立 typed mock factory，并通过公开 API 覆盖核心行为。

## 文件级审查结论

| 范围          | 文件                                                                                                                                          | 结论                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| body          | `body-html-codec.service.ts`、`body-validator.service.ts`、`body-text.helper.ts`、`body-link.helper.ts`                                       | 存在 HTTP 异常、断言和类型放置问题                       |
| body          | `body-compiler.service.ts`                                                                                                                    | 存在 `Awaited<ReturnType<...>>` 复杂签名                 |
| body          | `body.type.ts`、`body-html.type.ts`、`body.constant.ts`、`body.module.ts`、`dto/body.dto.ts`、相关 spec                                       | 已纳入审查；spec 存在断言问题                            |
| browse-log    | `browse-log.service.ts`                                                                                                                       | 存在 `console.warn` 与 JSDoc 风格问题                    |
| browse-log    | 其余 `browse-log` 文件                                                                                                                        | 已纳入审查，未发现本轮明确违规                           |
| comment       | `comment.service.ts`                                                                                                                          | 存在 HTTP 异常、复杂签名、JSON 强断言、console 日志问题  |
| comment       | `interfaces/comment-target-resolver.interface.ts`                                                                                             | 命名不符合 `*.type.ts`，且注释绑定 `BadRequestException` |
| comment       | `resolver/comment-like.resolver.ts`、`resolver/comment-report.resolver.ts`                                                                    | resolver 层直接抛 `BadRequestException`                  |
| comment       | `comment.dto.ts`、`comment.constant.ts`、`comment-growth.service.ts`、`comment-permission.service.ts`、`comment.module.ts`、`comment.type.ts` | 已纳入审查，未发现本轮明确违规                           |
| download      | `download.service.ts`、`interfaces/download-target-resolver.interface.ts`                                                                     | 存在 HTTP 异常、复杂类型与接口命名问题                   |
| download      | `download.dto.ts`、`download.constant.ts`、`download.module.ts`                                                                               | 已纳入审查，未发现本轮明确违规                           |
| emoji         | `emoji.type.ts`                                                                                                                               | 存在重复模板化类型注释                                   |
| emoji         | `emoji-*.service.ts`、`emoji-recent-usage.helper.ts`、`emoji.constant.ts`、`dto/emoji.dto.ts`、相关 spec                                      | 已纳入审查，未发现本轮明确违规                           |
| favorite      | `favorite.service.ts`、`interfaces/favorite-target-resolver.interface.ts`、`favorite.service.spec.ts`                                         | 存在空返回边界、HTTP 异常、接口命名、测试断言问题        |
| favorite      | `favorite-growth.service.ts`、`favorite.constant.ts`、`favorite.module.ts`、`dto/favorite.dto.ts`                                             | 已纳入审查，未发现本轮明确违规                           |
| follow        | `follow.service.ts`、`interfaces/follow-target-resolver.interface.ts`                                                                         | 存在 HTTP 异常、复杂返回类型、接口命名问题               |
| follow        | resolver、growth、module、constant、dto、spec                                                                                                 | 已纳入审查，未发现本轮明确违规                           |
| like          | `like.service.ts`、`interfaces/like-target-resolver.interface.ts`                                                                             | 存在 HTTP 异常、JSDoc、接口命名问题                      |
| like          | `like-growth.service.ts`、`like.constant.ts`、`like.module.ts`、`dto/like.dto.ts`、spec                                                       | 已纳入审查，未发现本轮明确违规                           |
| mention       | `mention.service.ts`、`mention.type.ts`、`mention.constant.ts`、`mention.module.ts`、`dto/mention.dto.ts`、spec                               | 已纳入审查，未发现本轮明确违规                           |
| purchase      | `purchase.service.ts`、`interfaces/purchase-target-resolver.interface.ts`                                                                     | 存在 HTTP 异常、execute rows 类型断言、接口命名问题      |
| purchase      | `purchase.dto.ts`、`purchase-pricing.dto.ts`、`purchase.constant.ts`、`purchase.module.ts`                                                    | 已纳入审查，未发现本轮明确违规                           |
| reading-state | `reading-state.service.ts`、`interfaces/reading-state-resolver.interface.ts`                                                                  | 存在 HTTP 异常、降级吞错和接口命名问题                   |
| reading-state | `reading-state.type.ts`、`dto/reading-state.dto.ts`、`reading-state.module.ts`                                                                | 已纳入审查，未发现本轮明确违规                           |
| report        | `report.service.ts`、`interfaces/report-target-resolver.interface.ts`                                                                         | 存在 service 内类型、HTTP 异常、接口命名问题             |
| report        | `report-growth.service.ts`、`report.constant.ts`、`report.module.ts`、`dto/report.dto.ts`                                                     | 已纳入审查，未发现本轮明确违规                           |
| user-assets   | `user-assets.service.ts`、`user-assets.type.ts`、`user-assets.module.ts`、`dto/user-assets.dto.ts`                                            | 已纳入审查，未发现本轮明确违规                           |
| root          | `interaction.module.ts`、`tsconfig.lib.json`                                                                                                  | 已纳入审查，未发现本轮明确违规                           |

## 整体合规率总结

- 合规率：62 / 86 = 72.1%
- 必改项清单：
  - 将正文解析、评论、互动 resolver 注册、购买/下载/阅读状态中的 `BadRequestException` 收敛为业务异常或专用解析错误。
  - 将 `interfaces/*.interface.ts` 与 service/helper 内部类型迁移到 `*.type.ts`。
  - 修复 `favorite.service.ts` 插入返回空时继续副作用并读取 `record.id` 的边界问题。
  - 清理 `as never`、`as unknown as JsonValue`、`Record<string, any>`。
  - 用 Nest `Logger` 替换 `console.warn`。
- 优化建议清单：
  - 为正文 AST/HTML token/list 节点补精确联合类型，减少断言。
  - 把评论大 service 的事件、可见性、分页、回复预览参数抽为命名类型。
  - 为各互动服务建立 typed mock，降低测试私有 API 耦合。

## 开放问题 / 假设

- HTML 白名单解析本轮未发现明显 XSS 放行点，但类型断言会降低后续改动时的安全边界可读性。
- 本模块没有 schema/migration；互动事实表唯一键、计数器和索引会在 `db` 模块报告继续核对。

## 剩余风险 / 未闭合项

- 未闭合项：无。
- 剩余风险：interaction 是高复用模块，正文解析错误语义一旦调整，需要同步 apps/controller 的响应兼容策略和现有前端错误展示。
