# libs/content 代码规范审查报告

## 审查概览

- 审查模块：`libs/content`
- 审查文件数：59
- 读取范围：`libs/content/src/**`、`libs/content/tsconfig.lib.json`
- 适用规范总条数：86
- 合规条数：68
- 违规条数：18
- 风险分布：CRITICAL 1 / HIGH 3 / MEDIUM 9 / LOW 5

## 规范条款逐条校验汇总

| 规范条款                                                     | 校验结果 | 证据                                                                                   |
| ------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------- |
| 内容访问权限必须在返回受限内容前执行校验                     | 违规     | `work-chapter.service.ts:291-420`                                                      |
| 上传/解压路径必须防止资源耗尽和路径逃逸                      | 违规     | `comic-archive-import.service.ts:611-632`                                              |
| 业务规则声明与实现必须一致                                   | 违规     | `work.service.ts:226-276`、`work.dto.ts:284-300`                                       |
| service 层预期业务失败使用 `BusinessException`               | 违规     | `content-permission.service.ts:316`、`:363`，`comic-archive-import.service.ts:108-182` |
| 方法签名不得使用复杂内联对象/工具类型                        | 违规     | `author.service.ts:65`、`content-permission.service.ts:437-438`                        |
| DTO 对外契约必须可验证完整约束                               | 违规     | `CreateWorkDto` 三个关系数组缺少非空约束                                               |
| 读取路径应避免 N+1 查询                                      | 违规     | `work-chapter.service.ts:198-204`                                                      |
| 测试不应通过 `as never` / private API 断言绕过类型           | 违规     | `work-counter.service.spec.ts:6-70`                                                    |
| 枚举成员、导出常量应有说明                                   | 合规     | `author.constant.ts`、`work.constant.ts`、`comic-archive-import.constant.ts`           |
| 目录职责：content 域组织 author/category/tag/work/permission | 合规     | 子模块职责边界清晰                                                                     |

## 按文件/模块拆分的详细违规清单

### work/chapter/work-chapter.service.ts

[CRITICAL] 章节详情只解析权限但未执行访问校验，可能泄露付费/会员章节内容

- 位置：`libs/content/src/work/chapter/work-chapter.service.ts:291`、`:326`、`:338`、`:404`、`:420`
- 对应规范：安全风险与权限合规，受限内容返回前必须执行权限校验；错误处理规范要求权限失败走稳定业务语义
- 违规原因：`getChapterDetail` 调用的是 `resolveChapterPermission`，只得到规则快照，并没有调用 `checkChapterAccess` 或 `checkAccessPermission`。随后匿名用户分支和登录用户分支都会把 `content: parsedContent` 放入响应。DTO 也在 `work-chapter.dto.ts:307` 把 `content` 纳入章节详情体。
- 整改建议：在非 `bypassVisibilityCheck` 路径中，返回内容前调用 `contentPermissionService.checkChapterAccess`；未通过时不得返回 `content`。也可以将详情元信息和正文内容拆成两个接口，正文统一走 `ComicContentService` / `NovelContentService` 的权限校验路径。

[MEDIUM] 章节分页逐条解析权限形成 N+1 查询

- 位置：`libs/content/src/work/chapter/work-chapter.service.ts:198-204`
- 对应规范：性能规范，分页读取应避免按行串行/并发触发重复查询
- 违规原因：`getChapterPage` 对 `page.list` 中每章调用 `resolveChapterPermission`，而该方法会重新查询章节并可能查询作品权限。分页较大时会放大数据库请求数。
- 整改建议：基于分页结果已有字段调用 `resolveChapterPermissionFromData`，并批量预取继承作品权限，或新增批量权限解析方法。

### work/chapter/dto/work-chapter.dto.ts

[HIGH] 章节详情 DTO 包含正文内容字段，放大权限绕过影响面

- 位置：`libs/content/src/work/chapter/dto/work-chapter.dto.ts:291-307`、`:351`
- 对应规范：DTO 契约与安全合规，公开响应 DTO 不应默认包含敏感或受权限控制字段
- 违规原因：`WorkChapterDetailBodyBaseDto` 把 `content` 纳入详情响应基础字段，导致详情接口天然倾向于返回正文。
- 整改建议：从普通详情 DTO 中移除 `content`，为已通过权限校验的正文接口单独定义 `ComicChapterContentDto` / `NovelChapterContentDto` 响应。

### work/content/comic-archive-import.service.ts

[HIGH] zip 解压缺少解压后总量、文件数量和单文件大小限制

- 位置：`libs/content/src/work/content/comic-archive-import.service.ts:611-632`
- 对应规范：安全与性能，上传解压路径必须防止 zip bomb 和资源耗尽
- 违规原因：代码只校验上传流是否 `truncated`，但 `extractArchive` 会遍历 `zip.files` 并直接 `pipeline(entry.stream(), createWriteStream(targetPath))`，没有限制解压后总字节数、文件数量、目录深度或单文件大小。
- 整改建议：在解压循环中累计 entry 数量和解压字节数，设置硬上限；拒绝异常压缩率、过深目录和过多小文件；导入前后记录任务失败原因并清理临时目录。

[MEDIUM] service 层直接抛出 HTTP 协议异常

- 位置：`libs/content/src/work/content/comic-archive-import.service.ts:108`、`:113`、`:126`、`:182`、`:635`、`:652`、`:661`、`:1089`、`:1100`、`:1114`
- 对应规范：错误处理规范，service 预期业务失败优先使用 `BusinessException`
- 违规原因：上传文件为空、扩展名非法、压缩包路径非法、任务状态非法等均在 service 内直接抛 `BadRequestException`、`PayloadTooLargeException`、`InternalServerErrorException`。
- 整改建议：把业务失败改为 `BusinessException`，由 controller/filter 负责映射 HTTP 状态；如果上传协议错误必须保留 HTTP 异常，应收敛在 controller 或 upload 边界。

[LOW] 上传配置使用非空断言，缺少配置缺失时的稳定错误

- 位置：`libs/content/src/work/content/comic-archive-import.service.ts:76`
- 对应规范：边界处理，外部配置读取应显式处理缺失和非法值
- 违规原因：`this.configService.get<UploadConfigInterface>('upload')!` 在配置缺失时会把错误延后到后续属性访问，排障语义不清晰。
- 整改建议：读取后显式校验 `tmpDir`、`allowExtensions.image` 等字段，缺失时抛稳定业务/配置异常并记录日志。

### work/core/work.service.ts

[HIGH] “作品必须关联作者/分类/标签”的业务规则未被强制执行

- 位置：`libs/content/src/work/core/work.service.ts:226-276`、`:311`、`:336-358`
- 对应规范：Spec Compliance，注释声明的业务规则必须被实现覆盖；数据完整性规则必须在写路径校验
- 违规原因：`validateWorkRelations` 只校验传入 ID 是否存在且数量匹配；当 `authorIds`、`categoryIds`、`tagIds` 为空数组时不会抛错。`createWork` 也只在数组非空时插入关系，因此可创建没有作者、分类或标签的作品，和注释中的“作品必须关联有效的作者、分类和标签”冲突。
- 整改建议：在 DTO 增加数组最小长度校验，并在 `validateWorkRelations` 开头显式拒绝任一空数组；更新路径若允许清空关系，需要单独定义业务规则。

[MEDIUM] 更新作品时可清空全部作者/分类/标签关系

- 位置：`libs/content/src/work/core/work.service.ts:410-418`、`:465-539`
- 对应规范：数据完整性与业务规则，更新路径不得绕过创建路径的关系约束
- 违规原因：`authorIds !== undefined`、`categoryIds !== undefined`、`tagIds !== undefined` 时会先删除原有关联；如果传入空数组，会把该类关系清空，且前置 `validateWorkRelations` 对空数组不拦截。
- 整改建议：若作品关系必须非空，更新路径也应拒绝空数组；如果允许局部不变，应区分 `undefined` 与空数组的语义并写入注释/DTO。

### work/core/dto/work.dto.ts

[MEDIUM] 创建作品关系数组缺少最小长度约束

- 位置：`libs/content/src/work/core/dto/work.dto.ts:284`、`:292`、`:300`
- 对应规范：DTO 规范，必填数组字段应表达最小业务约束
- 违规原因：`authorIds`、`categoryIds`、`tagIds` 只声明 `required: true`，没有体现“至少一个”的约束。
- 整改建议：为数组装饰器增加最小长度校验，或封装项目统一 `NumberArrayProperty` 并支持 `minSize: 1`。

### permission/content-permission.service.ts

[MEDIUM] 权限服务直接抛 HTTP 协议异常

- 位置：`libs/content/src/permission/content-permission.service.ts:316`、`:363`
- 对应规范：错误处理规范，service 预期业务失败不直接抛 Nest HTTP 异常
- 违规原因：未知权限类型抛 `InternalServerErrorException`，匿名用户访问受限章节抛 `UnauthorizedException`。该 service 是可复用业务权限层，协议语义应由入口边界映射。
- 整改建议：统一改为 `BusinessException`，通过错误码区分“需登录”“权限配置非法”等场景。

[MEDIUM] 方法签名使用复杂内联工具类型

- 位置：`libs/content/src/permission/content-permission.service.ts:437-438`
- 对应规范：类型规范 2.2，复杂方法签名应抽成命名类型
- 违规原因：`resolvedPermission?: Awaited<ReturnType<ContentPermissionService['resolveChapterPermission']>>` 直接出现在方法签名中，可读性和复用性较差。
- 整改建议：在 `content-permission.type.ts` 中定义 `ResolvedChapterPermissionInput` 或直接复用 `ResolvedChapterPermission`。

[MEDIUM] `checkChapterAccess` 泛型返回未保留 select 字段类型

- 位置：`libs/content/src/permission/content-permission.service.ts:333-382`
- 对应规范：类型规范，泛型应真实约束返回契约，避免用断言补洞
- 违规原因：方法声明了 `T extends Record<string, boolean>`，但返回固定为 `ChapterAccessResult<Record<string, unknown>>`，随后通过 `Object.fromEntries` 和 `chapter as Record<string, unknown>` 构造结果，调用方只能继续断言。
- 整改建议：把 select 结果抽成明确 DTO/类型，或让返回类型按 `T` 映射字段。

### work/content/comic-content.service.ts 与 novel-content.service.ts

[MEDIUM] 内容服务依赖 `checkChapterAccess` 返回值后继续使用类型断言

- 位置：`libs/content/src/work/content/comic-content.service.ts:53`、`:65`、`:280`；`libs/content/src/work/content/novel-content.service.ts:40`、`:49`
- 对应规范：类型规范，避免用断言掩盖跨服务契约不清晰
- 违规原因：`result.chapter` 被断言为临时对象类型，`workType` 也被断言为 `ContentTypeEnum`，说明权限服务返回契约没有提供足够类型信息。
- 整改建议：改造 `checkChapterAccess` 返回的章节字段类型，或为漫画/小说内容读取定义专用命名返回类型。

### work/core/resolver/work-reading-state.resolver.ts

[HIGH] 用对象展开注册小说阅读状态 resolver 会丢失原型方法

- 位置：`libs/content/src/work/core/resolver/work-reading-state.resolver.ts:40-45`
- 对应规范：语法逻辑与潜在 bug，注册到服务的 resolver 必须真实实现接口方法
- 违规原因：`{ ...this, workType: ContentTypeEnum.NOVEL } as WorkReadingStateResolver` 只复制实例自有属性，不会复制类原型上的 `resolveChapterSnapshot`、`resolveChapterSnapshots`、`resolveWorkSnapshots`、`resolveWorkInfoByChapter` 等方法。注册后的小说 resolver 可能缺方法，运行时调用会失败。
- 整改建议：提供两个真实 provider，或注册一个显式对象并把所有方法绑定到当前实例，例如 `resolveChapterSnapshot: this.resolveChapterSnapshot.bind(this)`。

### author/author.service.ts

[MEDIUM] 查询参数直接 `JSON.parse`，非法输入可能变成 500

- 位置：`libs/content/src/author/author.service.ts:313`
- 对应规范：边界处理，用户输入解析失败应转为稳定业务错误
- 违规原因：`const values = JSON.parse(type) as number[]` 没有 try/catch，也未验证解析结果一定是 number 数组。非法 JSON 会直接抛 `SyntaxError`。
- 整改建议：复用 `jsonParse` 工具并显式验证数组元素；非法时抛 `BusinessException` 或 DTO 校验错误。

[LOW] 方法签名使用内联函数类型

- 位置：`libs/content/src/author/author.service.ts:62-65`
- 对应规范：类型规范 2.2，复杂函数签名类型应抽取命名类型
- 违规原因：`handler: (batchIds: number[]) => Promise<void>` 直接写在方法签名中。
- 整改建议：在 `author.type.ts` 中定义 `AuthorBatchHandler` 后复用。

### category/category.service.ts

[LOW] 内容类型解析使用断言且默认值类型不一致

- 位置：`libs/content/src/category/category.service.ts:80-82`
- 对应规范：类型规范与边界处理，JSON 解析结果应运行时校验后再使用
- 违规原因：`jsonParse(contentType || []) as number[]` 在 `contentType` 为空时传入数组默认值，在有值时传入字符串，之后直接断言为 `number[]`。
- 整改建议：统一传入字符串默认值 `'[]'`，解析后用 `Array.isArray` 和元素类型校验收窄。

### tag/tag.service.ts

[LOW] 方法名 `deleteTagBatch` 与单 ID 删除语义不一致

- 位置：`libs/content/src/tag/tag.service.ts:147`
- 对应规范：代码命名，方法名应准确表达行为
- 违规原因：`deleteTagBatch(dto: IdDto)` 只接收单个 ID 并执行单条删除，但名称包含 `Batch`，会误导调用方和后续维护者。
- 整改建议：改名为 `deleteTag`，或如果确实要批量删除，调整 DTO 和实现为批量语义。

### work/counter/work-counter.service.ts

[MEDIUM] 计数服务本地硬编码多组跨域目标类型值

- 位置：`libs/content/src/work/counter/work-counter.service.ts:30-38`
- 对应规范：工程风格与可维护性，跨域枚举值不应以裸数字重复维护
- 违规原因：作品、章节、购买、下载、点赞、评论等目标类型值以裸数字保存在计数 owner service，后续 interaction 枚举变动时缺少编译期保护。
- 整改建议：若要避免反向依赖 interaction 实现，可在 content 域定义带注释的映射常量文件并用测试锁定；更优是依赖稳定公共 constant。

[LOW] `runCountUpdate` 参数使用内联函数类型

- 位置：`libs/content/src/work/counter/work-counter.service.ts:91`
- 对应规范：类型规范 2.2，函数签名类型应抽取命名类型
- 违规原因：`operation: (client: Db) => Promise<void>` 直接写入方法签名。
- 整改建议：在 `work-counter.type.ts` 中定义 `WorkCountUpdateOperation`。

### work/counter/work-counter.service.spec.ts

[LOW] 测试文件声明 private API 类型并使用多处断言

- 位置：`libs/content/src/work/counter/work-counter.service.spec.ts:6`、`:13`、`:29`、`:52`、`:70`
- 对应规范：测试规范与类型规范，测试应优先通过公开行为或最小 mock 类型验证
- 违规原因：测试用 `WorkCounterServicePrivateApi`、`{} as never`、`service as unknown as ...` 直接访问 private 方法，绕过类边界和依赖类型。
- 整改建议：通过公开计数更新方法构造场景，或把需要验证的错误翻译逻辑抽成可测试的纯函数。

### permission/content-permission.select.ts

[LOW] 权限 select 常量未被任何文件引用

- 位置：`libs/content/src/permission/content-permission.select.ts:5`、`:28`
- 对应规范：工程风格，未使用的公共常量会形成漂移文档
- 违规原因：`WORK_PERMISSION_SELECT`、`CHAPTER_PERMISSION_SELECT` 只在本文件定义，当前 `libs/content` 内无引用。
- 整改建议：删除未使用常量，或让权限 service 复用它们以避免查询字段漂移。

## 文件逐份审查结论

| 文件                                                                               | 结论                                            |
| ---------------------------------------------------------------------------------- | ----------------------------------------------- |
| `libs/content/src/author/author.constant.ts`                                       | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/author/author.module.ts`                                         | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/author/author.service.ts`                                        | 已读，发现 JSON 解析与内联函数类型问题          |
| `libs/content/src/author/dto/author.dto.ts`                                        | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/category/category.module.ts`                                     | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/category/category.service.ts`                                    | 已读，发现 JSON 解析断言问题                    |
| `libs/content/src/category/dto/category.dto.ts`                                    | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/content.module.ts`                                               | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/permission/content-permission.constant.ts`                       | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/permission/content-permission.module.ts`                         | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/permission/content-permission.select.ts`                         | 已读，发现未使用常量问题                        |
| `libs/content/src/permission/content-permission.service.ts`                        | 已读，发现协议异常、复杂签名和类型契约问题      |
| `libs/content/src/permission/content-permission.type.ts`                           | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/tag/dto/tag.dto.ts`                                              | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/tag/tag.module.ts`                                               | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/tag/tag.service.ts`                                              | 已读，发现方法命名问题                          |
| `libs/content/src/work-counter/work-counter.module.ts`                             | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/chapter/dto/work-chapter.dto.ts`                            | 已读，发现受限内容字段出现在详情 DTO 问题       |
| `libs/content/src/work/chapter/work-chapter.service.ts`                            | 已读，发现章节内容权限绕过与 N+1 权限查询问题   |
| `libs/content/src/work/chapter/work-chapter.type.ts`                               | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/chapter/resolver/work-comic-chapter-browse-log.resolver.ts` | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/chapter/resolver/work-comic-chapter-comment.resolver.ts`    | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/chapter/resolver/work-comic-chapter-download.resolver.ts`   | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/chapter/resolver/work-comic-chapter-like.resolver.ts`       | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/chapter/resolver/work-comic-chapter-purchase.resolver.ts`   | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/chapter/resolver/work-comic-chapter-report.resolver.ts`     | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/chapter/resolver/work-novel-chapter-browse-log.resolver.ts` | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/chapter/resolver/work-novel-chapter-comment.resolver.ts`    | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/chapter/resolver/work-novel-chapter-download.resolver.ts`   | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/chapter/resolver/work-novel-chapter-like.resolver.ts`       | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/chapter/resolver/work-novel-chapter-purchase.resolver.ts`   | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/chapter/resolver/work-novel-chapter-report.resolver.ts`     | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/content/comic-archive-import.constant.ts`                   | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/content/comic-archive-import.service.ts`                    | 已读，发现 zip 解压安全、协议异常和配置断言问题 |
| `libs/content/src/work/content/comic-archive-import.type.ts`                       | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/content/comic-archive-import.worker.ts`                     | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/content/comic-content.service.ts`                           | 已读，发现跨服务返回类型断言问题                |
| `libs/content/src/work/content/dto/content.dto.ts`                                 | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/content/novel-content.service.ts`                           | 已读，发现跨服务返回类型断言问题                |
| `libs/content/src/work/core/dto/work.dto.ts`                                       | 已读，发现关系数组缺少最小长度约束              |
| `libs/content/src/work/core/resolver/work-comic-browse-log.resolver.ts`            | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/core/resolver/work-comic-comment.resolver.ts`               | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/core/resolver/work-comic-favorite.resolver.ts`              | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/core/resolver/work-comic-like.resolver.ts`                  | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/core/resolver/work-comic-report.resolver.ts`                | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/core/resolver/work-novel-browse-log.resolver.ts`            | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/core/resolver/work-novel-comment.resolver.ts`               | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/core/resolver/work-novel-favorite.resolver.ts`              | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/core/resolver/work-novel-like.resolver.ts`                  | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/core/resolver/work-novel-report.resolver.ts`                | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/core/resolver/work-reading-state.resolver.ts`               | 已读，发现小说 resolver 注册丢方法问题          |
| `libs/content/src/work/core/work.constant.ts`                                      | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/core/work.service.ts`                                       | 已读，发现作品关系完整性问题                    |
| `libs/content/src/work/core/work.type.ts`                                          | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/counter/work-counter.service.spec.ts`                       | 已读，发现测试 private API 和断言问题           |
| `libs/content/src/work/counter/work-counter.service.ts`                            | 已读，发现硬编码跨域目标类型与内联函数类型问题  |
| `libs/content/src/work/counter/work-counter.type.ts`                               | 已读，未发现本轮适用规范违规                    |
| `libs/content/src/work/work.module.ts`                                             | 已读，未发现本轮适用规范违规                    |
| `libs/content/tsconfig.lib.json`                                                   | 已读，未发现本轮适用规范违规                    |

## 整体合规率总结

- 合规率：79.07%
- 主要风险集中在章节内容访问控制、压缩包导入安全边界、作品关系完整性和权限/内容服务的类型契约。

## 必改项清单

1. 修复 `WorkChapterService.getChapterDetail`，在返回章节 `content` 前强制执行权限校验。
2. 从普通章节详情 DTO 中移除 `content`，或拆分受权限保护的正文响应。
3. 为漫画压缩包导入增加解压后总量、文件数量、单文件大小和目录深度限制。
4. 修复 `WorkReadingStateResolver` 小说 resolver 注册方式，避免注册缺失方法的对象。
5. 在创建/更新作品时强制作者、分类、标签关系满足非空业务规则。

## 优化建议清单

1. 将 service 内 HTTP 协议异常收敛到 controller/边界层，领域服务统一抛 `BusinessException`。
2. 改造 `ContentPermissionService.checkChapterAccess` 的返回类型，减少内容服务中的断言。
3. 批量解析章节权限，降低章节分页查询的 N+1 压力。
4. 清理未使用的权限 select 常量。
5. 将跨域目标类型裸数字替换为稳定常量或集中映射并增加测试。
