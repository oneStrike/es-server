# Forum Topic / Comment HTML 正文协议硬切实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 forum topic / comment 正文对外合同一次性硬切为 `text/html`，移除 `bodyTokens`，保留内部 canonical `body` 与内部 `content` 派生列，并同步完成 topic/comment 周边消费链改造与历史数据 migration 刷写。

**架构：** 对外协议统一为单一 `html` 字段，纯文本编辑器也必须输出最小 HTML。后端新增受限 HTML codec，把白名单 HTML 解析为现有 canonical `body`，再沿用现有 `body -> hashtag materialize -> compile -> persist` 主链；读取侧对外只返回 `html`，内部继续保留 `body` 和 `content`，删除 `bodyTokens`。历史数据通过新 migration 从已存在的 `body` 反向生成 `html`，并同轮移除 `bodyTokens` 列与相关 DTO 暴露。

**技术栈：** NestJS、TypeScript、Jest、Drizzle、PostgreSQL migration SQL、Swagger DTO decorators

---

## 规格来源

- 访谈规格：`.omx/specs/deep-interview-forum-body-html-hard-cut-plan.md`
- 相关规范：
  - `.trae/rules/01-import-boundaries.md`
  - `.trae/rules/02-controller.md`
  - `.trae/rules/03-dto.md`
  - `.trae/rules/04-typescript-types.md`
  - `.trae/rules/05-comments.md`
  - `.trae/rules/06-error-handling.md`
  - `.trae/rules/07-drizzle.md`
  - `.trae/rules/08-testing.md`

## 文件结构

- 创建：`docs/breaking-changes/forum-body-html-hard-cutover.md`
  责任：记录 HTML-only 硬切合同、持久化策略、迁移策略和规范例外。
- 创建：`libs/interaction/src/body/body-html.type.ts`
  责任：承载 HTML codec 的内部类型，避免在 service 文件内声明顶层复杂类型。
- 创建：`libs/interaction/src/body/body-html-codec.service.ts`
  责任：受限 HTML 白名单解析与 canonical HTML 渲染。
- 创建：`libs/interaction/src/body/body-html-codec.service.spec.ts`
  责任：锁定 HTML 解析、渲染、非法标签/属性报错行为。
- 修改：`libs/platform/src/utils/richText.ts`
  责任：导出可复用的 HTML 实体解码与纯文本规范化工具，供 HTML codec 和 migration 语义对齐。
- 修改：`libs/interaction/src/body/body.module.ts`
  责任：注册并导出 `BodyHtmlCodecService`。
- 修改：`libs/interaction/src/body/dto/body.dto.ts`
  责任：删除 `bodyMode/plainText/body` 写入协议 DTO，收敛为 `html` 输入 DTO。
- 修改：`libs/forum/src/topic/dto/forum-topic.dto.ts`
  责任：topic 写入改为 HTML-only；读取 DTO 去掉 `body/content/bodyTokens` 的原始正文暴露，新增 `html`。
- 修改：`libs/forum/src/topic/dto/forum-topic.dto.spec.ts`
  责任：锁定 topic DTO 的 HTML-only 合同与 `bodyTokens` 下线。
- 修改：`libs/forum/src/topic/forum-topic.type.ts`
  责任：把内部写入类型从 `bodyMode + plainText/body` 收敛为 `html`，补充 html 持久化结果类型。
- 修改：`libs/forum/src/topic/forum-topic.service.ts`
  责任：topic 写路径改为 `html -> body`，持久化 `html/body/content`，读取侧对外改为 `html`。
- 修改：`libs/forum/src/topic/forum-topic.service.spec.ts`
  责任：锁定 topic HTML-only 写链路、详情回显、`bodyTokens` 不再落库。
- 修改：`apps/app-api/src/modules/forum/forum-topic.controller.ts`
  责任：沿用原路由，消费新的 HTML-only DTO，不新增 v2 路由。
- 修改：`libs/interaction/src/comment/dto/comment.dto.ts`
  责任：comment 写入/读取 DTO 收敛为 HTML-only，删除 `body/bodyTokens/content` 的对外正文暴露。
- 修改：`libs/interaction/src/comment/dto/comment.dto.spec.ts`
  责任：锁定 comment HTML-only 合同与 `bodyTokens` 下线。
- 修改：`libs/interaction/src/comment/comment.type.ts`
  责任：补充 comment HTML 写入链的内部类型，避免 service 签名内联复杂对象。
- 修改：`libs/interaction/src/comment/comment.service.ts`
  责任：comment 写路径改为 `html -> body`，持久化 `html/body/content`，读取侧对外改为 `html`。
- 修改：`libs/interaction/src/comment/comment.service.spec.ts`
  责任：锁定 comment HTML-only 写链路与读模型回显。
- 修改：`apps/app-api/src/modules/comment/comment.controller.ts`
  责任：沿用原路由，消费新的 HTML-only DTO。
- 修改：`libs/forum/src/hashtag/dto/forum-hashtag.dto.ts`
  责任：forum hashtag 关联评论/主题 DTO 改为 `html` 暴露，去掉 `body/bodyTokens/content` 原始正文字段。
- 修改：`libs/forum/src/hashtag/forum-hashtag.service.ts`
  责任：forum hashtag 关联主题/评论读取时改为取 `html`，保留 `contentSnippet` 这类派生摘要投影。
- 修改：`libs/forum/src/hashtag/forum-hashtag.service.spec.ts`
  责任：锁定 hashtag 关联读取 DTO 的 `html` 回显与 snippet 保留。
- 修改：`libs/forum/src/search/search.service.ts`
  责任：保留 `topicContentSnippet/commentContentSnippet` 依赖 `content` 的内部策略，并确保不再从 forum detail DTO 暴露 `content`。
- 修改：`libs/forum/src/search/search.service.spec.ts`
  责任：锁定搜索结果仍使用 `content` 派生摘要，而非 `bodyTokens`。
- 修改：`libs/forum/src/profile/profile.service.ts`
  责任：继续使用 `content` 生成列表摘要，明确其为内部派生列。
- 修改：`libs/forum/src/topic/resolver/forum-topic-comment.resolver.ts`
  责任：继续使用内部 `content` 做摘录事件，不再依赖 forum comment 外部 DTO 暴露的 `content`。
- 修改：`libs/forum/src/topic/resolver/forum-topic-comment.resolver.spec.ts`
  责任：锁定论坛评论事件摘录仍取内部 `content`。
- 修改：`libs/interaction/src/comment/resolver/comment-like.resolver.ts`
  责任：继续用内部 `content` 生成点赞通知摘录。
- 修改：`db/schema/forum/forum-topic.ts`
  责任：新增 `html` 列、删除 `bodyTokens` 列注释、保留 `body/bodyVersion/content`。
- 修改：`db/schema/app/user-comment.ts`
  责任：新增 `html` 列、删除 `bodyTokens` 列注释、保留 `body/bodyVersion/content`。
- 创建：`db/migration/20260429150000_forum_body_html_hard_cutover/migration.sql`
  责任：新增 `html` 列、用 SQL 从 `body` 反向渲染 HTML、同步重写 `content`、删除 `body_tokens`。
- 修改：`db/comments/generated.sql`
  责任：刷新 schema 注释，保证 `Warnings: 0`。
- 修改：`libs/interaction/src/body/body-migration.contract.spec.ts`
  责任：锁定新 migration 存在、`html` 列落库、`body_tokens` 删除与“无脚本 backfill”约束。

## 规范对齐与显式例外

- **导入边界规范：** 新增 HTML codec、类型和 DTO 必须直连 owner 文件；不新增 barrel；不新增第三方 HTML parser 依赖。
- **Controller 规范：** 默认 breaking change 要求 versioning / compat / 下线计划；本计划唯一例外是**用户显式覆盖该要求**，允许原路由一次性硬切。该例外必须写进 breaking-change 文档。
- **DTO 规范：** 所有写入/读取合同继续定义在 `libs/*`；`apps/*` 只消费；`content` 如继续存在于 DTO 中，只能是 purpose-specific snippet/excerpt 字段，不能继续作为原始正文字段。
- **TypeScript 类型规范：** HTML codec token、解析上下文、写入结果等复杂类型统一进入 `*.type.ts`；不得在 service/controller 中新增顶层类型。
- **注释规范：** 新增方法、导出类型、schema 字段、常量字段必须有中文注释，解释原因与边界，不复述代码。
- **错误处理规范：** 非法 HTML 标签、非法属性、缺失 `data-user-id` 这类输入格式错误统一抛 `BadRequestException`；topic/comment 业务失败仍用 `BusinessException`。
- **Drizzle 规范：** schema、DTO、service、migration、`db/comments/generated.sql` 必须同轮一致；migration 只新建，不修改历史文件；历史数据只通过 migration 刷写。
- **测试规范：** 每个行为改动先补失败测试，再实现；验证至少覆盖 DTO 合同、codec、topic/comment 写链路、migration contract、搜索/snippet 保留语义。

### 任务 1：HTML-only DTO 合同硬切

**文件：**
- 修改：`libs/interaction/src/body/dto/body.dto.ts`
- 修改：`libs/forum/src/topic/dto/forum-topic.dto.ts`
- 修改：`libs/forum/src/topic/dto/forum-topic.dto.spec.ts`
- 修改：`libs/interaction/src/comment/dto/comment.dto.ts`
- 修改：`libs/interaction/src/comment/dto/comment.dto.spec.ts`
- 修改：`libs/forum/src/hashtag/dto/forum-hashtag.dto.ts`

- [ ] **步骤 1：先为 topic/comment/hashtag DTO 合同写失败测试**

```ts
it('documents create topic html as the only write contract', () => {
  const originalNodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'
  jest.resetModules()

  const { CreateUserForumTopicDto } = require('./forum-topic.dto')
  const htmlMetadata = Reflect.getMetadata(
    DECORATORS.API_MODEL_PROPERTIES,
    CreateUserForumTopicDto.prototype,
    'html',
  ) as { description?: string; required?: boolean }
  const bodyModeMetadata = Reflect.getMetadata(
    DECORATORS.API_MODEL_PROPERTIES,
    CreateUserForumTopicDto.prototype,
    'bodyMode',
  )

  process.env.NODE_ENV = originalNodeEnv

  expect(htmlMetadata?.description).toBe(
    '主题正文 HTML；唯一写入合同，纯文本编辑器也需输出最小 HTML',
  )
  expect(htmlMetadata?.required).toBe(true)
  expect(bodyModeMetadata).toBeUndefined()
})

it('does not expose topic bodyTokens in public topic dto', () => {
  const originalNodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'
  jest.resetModules()

  const { PublicForumTopicDetailDto } = require('./forum-topic.dto')
  const metadata = Reflect.getMetadata(
    DECORATORS.API_MODEL_PROPERTIES,
    PublicForumTopicDetailDto.prototype,
    'bodyTokens',
  )

  process.env.NODE_ENV = originalNodeEnv

  expect(metadata).toBeUndefined()
})
```

- [ ] **步骤 2：运行 DTO 相关测试，确认旧合同导致失败**

运行：`pnpm test -- --runInBand --runTestsByPath libs/forum/src/topic/dto/forum-topic.dto.spec.ts libs/interaction/src/comment/dto/comment.dto.spec.ts`

预期：FAIL，断言显示 `html` 字段不存在，或 `bodyMode/bodyTokens/content` 仍然保留在旧 DTO 合同中。

- [ ] **步骤 3：实现 HTML-only DTO 合同**

```ts
// libs/interaction/src/body/dto/body.dto.ts
export class HtmlBodyInputDto {
  @StringProperty({
    description: '正文 HTML；唯一写入合同，纯文本编辑器也需输出最小 HTML',
    required: true,
    minLength: 1,
    example:
      '<p>欢迎 <span data-node="mention" data-user-id="9" data-nickname="测试用户">@测试用户</span></p>',
  })
  html!: string
}

// libs/forum/src/topic/dto/forum-topic.dto.ts
class TopicHtmlWritableFieldsDto extends HtmlBodyInputDto {}

export class CreateUserForumTopicDto extends IntersectionType(
  PickType(BaseForumTopicDto, ['sectionId'] as const),
  PartialType(PickType(BaseForumTopicDto, ['title'] as const)),
  TopicHtmlWritableFieldsDto,
  PartialType(PickType(BaseForumTopicDto, ['images', 'videos'] as const)),
) {}

// PublicForumTopicDetailDto / AdminForumTopicDetailDto 只保留 html，不再 Pick body/content/bodyTokens
```

- [ ] **步骤 4：同步修改 comment 与 hashtag 关联 DTO**

```ts
// libs/interaction/src/comment/dto/comment.dto.ts
class CommentHtmlFieldDto {
  @StringProperty({
    description: '评论正文 HTML；唯一写入合同，纯文本编辑器也需输出最小 HTML',
    required: true,
    minLength: 1,
    example: '<p>评论正文</p>',
  })
  html!: string
}

export class CreateCommentBodyDto extends IntersectionType(
  CommentTargetDto,
  CommentHtmlFieldDto,
) {}

export class ReplyCommentBodyDto extends IntersectionType(
  ReplyTargetDto,
  CommentHtmlFieldDto,
) {}

// BaseCommentDto / BaseForumHashtagCommentItemDto 的正文输出统一收敛到 html
```

- [ ] **步骤 5：重新运行 DTO 测试确认通过**

运行：`pnpm test -- --runInBand --runTestsByPath libs/forum/src/topic/dto/forum-topic.dto.spec.ts libs/interaction/src/comment/dto/comment.dto.spec.ts`

预期：PASS，`html` 成为唯一正文写入字段，`bodyMode/plainText/mentions/bodyTokens` 的对外合同检查全部消失。

- [ ] **步骤 6：Commit**

```bash
git add libs/interaction/src/body/dto/body.dto.ts libs/forum/src/topic/dto/forum-topic.dto.ts libs/forum/src/topic/dto/forum-topic.dto.spec.ts libs/interaction/src/comment/dto/comment.dto.ts libs/interaction/src/comment/dto/comment.dto.spec.ts libs/forum/src/hashtag/dto/forum-hashtag.dto.ts
git commit -m "feat(forum): hard-cut dto body contracts to html-only" -m "Constraint: External body contract is html-only and must not preserve bodyMode/plainText compatibility" -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: Do not reintroduce body/bodyTokens/content as external raw body fields" -m "Tested: pnpm test -- --runInBand --runTestsByPath libs/forum/src/topic/dto/forum-topic.dto.spec.ts libs/interaction/src/comment/dto/comment.dto.spec.ts"
```

### 任务 2：新增受限 HTML codec 并复用现有文本清洗能力

**文件：**
- 创建：`libs/interaction/src/body/body-html.type.ts`
- 创建：`libs/interaction/src/body/body-html-codec.service.ts`
- 创建：`libs/interaction/src/body/body-html-codec.service.spec.ts`
- 修改：`libs/platform/src/utils/richText.ts`
- 修改：`libs/interaction/src/body/body.module.ts`

- [ ] **步骤 1：先为 HTML 解析/渲染行为写失败测试**

```ts
it('parses whitelisted html into canonical topic body nodes', () => {
  const service = new BodyHtmlCodecService()

  expect(
    service.parseHtmlOrThrow(
      '<p>欢迎 <span data-node="mention" data-user-id="9" data-nickname="测试用户">@测试用户</span><br /><img data-node="emoji" data-shortcode="smile" alt=":smile:" /></p>',
      BodySceneEnum.TOPIC,
    ),
  ).toEqual({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '欢迎 ' },
          { type: 'mentionUser', userId: 9, nickname: '测试用户' },
          { type: 'hardBreak' },
          { type: 'emojiCustom', shortcode: 'smile' },
        ],
      },
    ],
  })
})

it('renders canonical body into normalized html', () => {
  const service = new BodyHtmlCodecService()

  expect(
    service.renderHtml(
      {
        type: 'doc',
        content: [
          {
            type: 'blockquote',
            content: [{ type: 'text', text: '先写能跑的' }],
          },
        ],
      },
      BodySceneEnum.TOPIC,
    ),
  ).toBe('<blockquote>先写能跑的</blockquote>')
})

it('rejects unsupported html tags', () => {
  const service = new BodyHtmlCodecService()

  expect(() =>
    service.parseHtmlOrThrow('<table><tr><td>bad</td></tr></table>', BodySceneEnum.TOPIC),
  ).toThrow(BadRequestException)
})
```

- [ ] **步骤 2：运行 codec 测试，确认服务尚未实现**

运行：`pnpm test -- --runInBand --runTestsByPath libs/interaction/src/body/body-html-codec.service.spec.ts`

预期：FAIL，报错 `Cannot find module './body-html-codec.service'` 或对应导出缺失。

- [ ] **步骤 3：实现 HTML codec 的类型、解析与渲染主骨架**

```ts
// libs/interaction/src/body/body-html.type.ts
export interface BodyHtmlTagToken {
  kind: 'openTag' | 'closeTag' | 'selfClosingTag' | 'text'
  name?: string
  raw: string
  text?: string
  attributes?: Record<string, string>
}

export interface BodyHtmlParseContext {
  scene: BodySceneEnum
  currentBlock: BodyBlockNode | null
  stack: Array<'paragraph' | 'heading' | 'blockquote' | 'bulletList' | 'orderedList' | 'listItem'>
}

// libs/interaction/src/body/body-html-codec.service.ts
@Injectable()
export class BodyHtmlCodecService {
  parseHtmlOrThrow(html: string, scene: BodySceneEnum): BodyDoc {
    const tokens = this.tokenizeHtmlOrThrow(html)
    const body = this.buildBodyFromTokensOrThrow(tokens, scene)
    return this.bodyValidatorService.validateBodyOrThrow(body, scene)
  }

  renderHtml(body: BodyDoc, scene: BodySceneEnum): string {
    this.bodyValidatorService.validateBodyOrThrow(body, scene)
    return body.content.map(block => this.renderBlock(block)).join('')
  }
}
```

- [ ] **步骤 4：导出文本清洗工具并注册模块 provider**

```ts
// libs/platform/src/utils/richText.ts
export function decodeHtmlEntities(text: string) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
}

export function normalizeRichTextPlainText(text: string) {
  return decodeHtmlEntities(text)
    .replace(/\s+/g, ' ')
    .trim()
}

// libs/interaction/src/body/body.module.ts
@Module({
  imports: [EmojiModule],
  providers: [BodyCompilerService, BodyValidatorService, BodyHtmlCodecService],
  exports: [BodyCompilerService, BodyValidatorService, BodyHtmlCodecService],
})
export class BodyModule {}
```

- [ ] **步骤 5：重新运行 codec 测试确认通过**

运行：`pnpm test -- --runInBand --runTestsByPath libs/interaction/src/body/body-html-codec.service.spec.ts`

预期：PASS，白名单 HTML 可以稳定解析并规范化渲染，非法标签会报 `BadRequestException`。

- [ ] **步骤 6：Commit**

```bash
git add libs/interaction/src/body/body-html.type.ts libs/interaction/src/body/body-html-codec.service.ts libs/interaction/src/body/body-html-codec.service.spec.ts libs/platform/src/utils/richText.ts libs/interaction/src/body/body.module.ts
git commit -m "feat(forum): add restricted html codec for canonical body" -m "Constraint: No new third-party html parser dependency is allowed in this cutover" -m "Confidence: medium" -m "Scope-risk: broad" -m "Directive: Keep the HTML whitelist bounded to the supported body schema and reject anything else" -m "Tested: pnpm test -- --runInBand --runTestsByPath libs/interaction/src/body/body-html-codec.service.spec.ts"
```

### 任务 3：硬切 topic 写链路与详情回显

**文件：**
- 修改：`libs/forum/src/topic/forum-topic.type.ts`
- 修改：`libs/forum/src/topic/forum-topic.service.ts`
- 修改：`libs/forum/src/topic/forum-topic.service.spec.ts`
- 修改：`apps/app-api/src/modules/forum/forum-topic.controller.ts`

- [ ] **步骤 1：先为 topic HTML-only 写链路写失败测试**

```ts
it('materializes topic html into canonical body and persists html/content without bodyTokens', async () => {
  const { service, forumHashtagBodyService, bodyHtmlCodecService } =
    createTopicHtmlBodyHarness()

  bodyHtmlCodecService.parseHtmlOrThrow.mockReturnValue({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '欢迎来到论坛' }],
      },
    ],
  })
  bodyHtmlCodecService.renderHtml.mockReturnValue('<p>欢迎来到论坛</p>')

  await (service as unknown as ForumTopicServicePrivateApi).materializeTopicBodyInTx(
    {} as never,
    { html: '<p>欢迎来到论坛</p>' },
    9,
  )

  expect(forumHashtagBodyService.materializeBodyInTx).toHaveBeenCalled()
  expect(bodyHtmlCodecService.parseHtmlOrThrow).toHaveBeenCalledWith(
    '<p>欢迎来到论坛</p>',
    BodySceneEnum.TOPIC,
  )
})
```

- [ ] **步骤 2：运行 topic service 测试，确认旧 `bodyMode/plainText` 分支仍在导致失败**

运行：`pnpm test -- --runInBand --runTestsByPath libs/forum/src/topic/forum-topic.service.spec.ts`

预期：FAIL，现有断言仍要求 `bodyMode=plain`、`mentions` 或 `bodyTokens`。

- [ ] **步骤 3：把 topic 内部写入类型与 service 改成 HTML-only**

```ts
// libs/forum/src/topic/forum-topic.type.ts
export interface TopicBodyWriteFields {
  html: string
}

export interface MaterializedTopicBodyWriteResult extends TopicBodyWriteResult {
  html: string
  hashtagFacts: MaterializedForumHashtagFact[]
}

// libs/forum/src/topic/forum-topic.service.ts
const parsedBody = this.bodyHtmlCodecService.parseHtmlOrThrow(
  input.html,
  BodySceneEnum.TOPIC,
)
const materialized = await this.forumHashtagBodyService.materializeBodyInTx({
  tx,
  body: parsedBody,
  actorUserId,
  createSourceType: ForumHashtagCreateSourceTypeEnum.TOPIC_BODY,
})
const compiled = await this.bodyCompilerService.compile(
  materialized.body,
  BodySceneEnum.TOPIC,
)
const canonicalHtml = this.bodyHtmlCodecService.renderHtml(
  materialized.body,
  BodySceneEnum.TOPIC,
)
return { ...compiled, html: canonicalHtml, hashtagFacts: materialized.hashtagFacts }
```

- [ ] **步骤 4：topic 落库与读取映射同时去掉 `bodyTokens` 外部暴露**

```ts
const createPayload = {
  title,
  html: compiledBody.html,
  content: compiledBody.plainText,
  body: compiledBody.body as unknown as JsonValue,
  bodyVersion: BODY_VERSION_V1,
  images,
  videos,
}

return {
  id: topic.id,
  title: topic.title,
  html: topic.html,
  images: topic.images,
  videos: topic.videos,
  contentSnippet: topic.contentSnippet,
}
```

- [ ] **步骤 5：重新运行 topic service 测试确认通过**

运行：`pnpm test -- --runInBand --runTestsByPath libs/forum/src/topic/forum-topic.service.spec.ts`

预期：PASS，topic 写入只接受 `html`，详情映射回显 `html`，不再写 `bodyTokens`。

- [ ] **步骤 6：Commit**

```bash
git add libs/forum/src/topic/forum-topic.type.ts libs/forum/src/topic/forum-topic.service.ts libs/forum/src/topic/forum-topic.service.spec.ts apps/app-api/src/modules/forum/forum-topic.controller.ts
git commit -m "feat(forum): hard-cut topic body pipeline to html-only writes" -m "Constraint: Topic write routes must keep original paths while dropping all plain/rich compatibility branches" -m "Confidence: medium" -m "Scope-risk: broad" -m "Directive: Topic readers may expose html and snippets, but must not leak raw body/content/bodyTokens as external body fields" -m "Tested: pnpm test -- --runInBand --runTestsByPath libs/forum/src/topic/forum-topic.service.spec.ts"
```

### 任务 4：硬切 comment 写链路与论坛 comment 读模型

**文件：**
- 修改：`libs/interaction/src/comment/comment.type.ts`
- 修改：`libs/interaction/src/comment/comment.service.ts`
- 修改：`libs/interaction/src/comment/comment.service.spec.ts`
- 修改：`apps/app-api/src/modules/comment/comment.controller.ts`
- 修改：`libs/forum/src/hashtag/forum-hashtag.service.ts`
- 修改：`libs/forum/src/hashtag/forum-hashtag.service.spec.ts`

- [ ] **步骤 1：先为 comment HTML-only 写链路写失败测试**

```ts
it('materializes comment html into canonical body and persists html/content without bodyTokens', async () => {
  const harness = createMaterializeCommentBodyHarness()

  harness.bodyHtmlCodecService.parseHtmlOrThrow.mockReturnValue({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '评论正文' }],
      },
    ],
  })
  harness.bodyHtmlCodecService.renderHtml.mockReturnValue('<p>评论正文</p>')

  await harness.service['materializeCommentBodyInTx'](
    {} as never,
    '<p>评论正文</p>',
    9,
    CommentTargetTypeEnum.FORUM_TOPIC,
  )

  expect(harness.forumHashtagBodyService.materializeBodyInTx).toHaveBeenCalled()
  expect(harness.bodyHtmlCodecService.parseHtmlOrThrow).toHaveBeenCalledWith(
    '<p>评论正文</p>',
    BodySceneEnum.COMMENT,
  )
})
```

- [ ] **步骤 2：运行 comment 相关测试，确认旧 `content + mentions` 合同仍在导致失败**

运行：`pnpm test -- --runInBand --runTestsByPath libs/interaction/src/comment/comment.service.spec.ts libs/forum/src/hashtag/forum-hashtag.service.spec.ts`

预期：FAIL，旧测试仍断言 `mentions` 必填或返回体包含 `body/bodyTokens/content`。

- [ ] **步骤 3：把 comment service 改成 HTML-only 主链**

```ts
// libs/interaction/src/comment/comment.service.ts
const parsedBody = this.bodyHtmlCodecService.parseHtmlOrThrow(
  html,
  BodySceneEnum.COMMENT,
)
const materialized = await this.forumHashtagBodyService.materializeBodyInTx({
  tx,
  body: parsedBody,
  actorUserId,
  createSourceType: ForumHashtagCreateSourceTypeEnum.COMMENT_BODY,
})
const compiled = await this.bodyCompilerService.compile(
  materialized.body,
  BodySceneEnum.COMMENT,
)
const canonicalHtml = this.bodyHtmlCodecService.renderHtml(
  materialized.body,
  BodySceneEnum.COMMENT,
)
```

- [ ] **步骤 4：comment 与 hashtag 关联读取统一改为 `html` 暴露**

```ts
// libs/interaction/src/comment/comment.service.ts
return {
  id: reply.id,
  html: reply.html,
  likeCount: reply.likeCount,
  liked,
}

// libs/forum/src/hashtag/forum-hashtag.service.ts
return rows.map(item => ({
  commentId: item.commentId,
  topicId: item.topicId,
  topicTitle: item.topicTitle,
  userId: item.userId,
  html: item.html,
  likeCount: item.likeCount,
  createdAt: item.createdAt,
  user: item.user,
}))
```

- [ ] **步骤 5：重新运行 comment 与 hashtag 相关测试确认通过**

运行：`pnpm test -- --runInBand --runTestsByPath libs/interaction/src/comment/comment.service.spec.ts libs/forum/src/hashtag/forum-hashtag.service.spec.ts`

预期：PASS，comment 写链路只吃 `html`，forum hashtag 关联评论读取只回 `html`。

- [ ] **步骤 6：Commit**

```bash
git add libs/interaction/src/comment/comment.type.ts libs/interaction/src/comment/comment.service.ts libs/interaction/src/comment/comment.service.spec.ts apps/app-api/src/modules/comment/comment.controller.ts libs/forum/src/hashtag/forum-hashtag.service.ts libs/forum/src/hashtag/forum-hashtag.service.spec.ts
git commit -m "feat(forum): hard-cut comment and hashtag readers to html-only bodies" -m "Constraint: Comment input can no longer depend on mention sidecar metadata and must derive all structure from html" -m "Confidence: medium" -m "Scope-risk: broad" -m "Directive: Keep list/search-specific snippet fields separate from raw html body fields" -m "Tested: pnpm test -- --runInBand --runTestsByPath libs/interaction/src/comment/comment.service.spec.ts libs/forum/src/hashtag/forum-hashtag.service.spec.ts"
```

### 任务 5：schema、migration 与 `bodyTokens` 下线

**文件：**
- 修改：`db/schema/forum/forum-topic.ts`
- 修改：`db/schema/app/user-comment.ts`
- 创建：`db/migration/20260429150000_forum_body_html_hard_cutover/migration.sql`
- 修改：`db/comments/generated.sql`
- 修改：`libs/interaction/src/body/body-migration.contract.spec.ts`

- [ ] **步骤 1：先为 migration contract 写失败测试**

```ts
it('keeps the html hard-cut migration and removes bodyTokens from forum body tables', () => {
  const repoRoot = path.resolve(__dirname, '../../../../')
  const migrationPath = path.join(
    repoRoot,
    'db/migration/20260429150000_forum_body_html_hard_cutover/migration.sql',
  )
  const migrationSql = readFileSync(migrationPath, 'utf8')

  expect(existsSync(migrationPath)).toBe(true)
  expect(migrationSql).toContain('ADD COLUMN "html" text')
  expect(migrationSql).toContain('DROP COLUMN "body_tokens"')
  expect(migrationSql).toContain('UPDATE "forum_topic" AS topic')
  expect(migrationSql).toContain('UPDATE "user_comment" AS comment_row')
})
```

- [ ] **步骤 2：运行 migration contract 测试，确认新 migration 尚不存在**

运行：`pnpm test -- --runInBand --runTestsByPath libs/interaction/src/body/body-migration.contract.spec.ts`

预期：FAIL，`forum_body_html_hard_cutover` migration 文件不存在，且 schema 仍保留 `bodyTokens`。

- [ ] **步骤 3：修改 schema，新增 `html` 并删除 `bodyTokens`**

```ts
// db/schema/forum/forum-topic.ts
html: text().notNull(),
content: text().notNull(),
body: jsonb().notNull(),
bodyVersion: smallint().default(1).notNull(),

// 删除
bodyTokens: jsonb(),

// db/schema/app/user-comment.ts 同步处理
```

- [ ] **步骤 4：生成并手写补充 migration，完成历史数据 SQL 刷写**

```sql
ALTER TABLE "forum_topic" ADD COLUMN "html" text;
ALTER TABLE "user_comment" ADD COLUMN "html" text;

CREATE OR REPLACE FUNCTION __body_render_html_from_inline_nodes(raw_nodes jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  rendered text := '';
BEGIN
  -- 渲染 text / hardBreak / mentionUser / forumHashtag / emojiUnicode / emojiCustom
  RETURN rendered;
END;
$fn$;

CREATE OR REPLACE FUNCTION __body_render_html_from_list_items(raw_items jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  rendered text := '';
BEGIN
  -- 渲染 listItem，并复用 __body_render_html_from_inline_nodes 处理每个条目的 inline content
  RETURN rendered;
END;
$fn$;

CREATE OR REPLACE FUNCTION __body_render_html_from_doc(raw_body jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  rendered text := '';
BEGIN
  IF raw_body IS NULL OR jsonb_typeof(raw_body) <> 'object' THEN
    RETURN '<p></p>';
  END IF;

  WITH RECURSIVE block_nodes AS (
    SELECT value AS node, ord
    FROM jsonb_array_elements(coalesce(raw_body->'content', '[]'::jsonb)) WITH ORDINALITY AS t(value, ord)
  )
  SELECT string_agg(
    CASE node->>'type'
      WHEN 'paragraph' THEN format('<p>%s</p>', __body_render_html_from_inline_nodes(node->'content'))
      WHEN 'heading' THEN format('<h%s>%s</h%s>', node->>'level', __body_render_html_from_inline_nodes(node->'content'), node->>'level')
      WHEN 'blockquote' THEN format('<blockquote>%s</blockquote>', __body_render_html_from_inline_nodes(node->'content'))
      WHEN 'bulletList' THEN format('<ul>%s</ul>', __body_render_html_from_list_items(node->'content'))
      WHEN 'orderedList' THEN format('<ol>%s</ol>', __body_render_html_from_list_items(node->'content'))
      ELSE ''
    END,
    ''
    ORDER BY ord
  )
  INTO rendered
  FROM block_nodes;

  RETURN coalesce(rendered, '<p></p>');
END;
$fn$;

UPDATE "forum_topic" AS topic
SET
  "html" = __body_render_html_from_doc(topic."body"),
  "content" = __body_extract_plain_text_from_legacy_content(__body_render_html_from_doc(topic."body"))
WHERE topic."html" IS NULL;

UPDATE "user_comment" AS comment_row
SET
  "html" = __body_render_html_from_doc(comment_row."body"),
  "content" = __body_extract_plain_text_from_legacy_content(__body_render_html_from_doc(comment_row."body"))
WHERE comment_row."html" IS NULL;

ALTER TABLE "forum_topic" ALTER COLUMN "html" SET NOT NULL;
ALTER TABLE "user_comment" ALTER COLUMN "html" SET NOT NULL;
ALTER TABLE "forum_topic" DROP COLUMN "body_tokens";
ALTER TABLE "user_comment" DROP COLUMN "body_tokens";
```

说明：先运行 `pnpm db:generate` 生成新 migration；如果命令出现交互提示，立即停止并由仓库维护者手动完成交互。随后只允许编辑**新生成的 migration 文件**，补齐 backfill SQL，不得修改任何旧 migration。

- [ ] **步骤 5：刷新数据库注释并重新跑 migration contract**

运行：`pnpm db:comments:check`

预期：若注释仍未同步，先运行 `pnpm db:comments:apply`，再确认 `Warnings: 0`。

运行：`pnpm test -- --runInBand --runTestsByPath libs/interaction/src/body/body-migration.contract.spec.ts`

预期：PASS，schema 与 migration 同步存在，`body_tokens` 已从 forum topic / user_comment 硬切移除。

- [ ] **步骤 6：Commit**

```bash
git add db/schema/forum/forum-topic.ts db/schema/app/user-comment.ts db/migration/20260429150000_forum_body_html_hard_cutover/migration.sql db/comments/generated.sql libs/interaction/src/body/body-migration.contract.spec.ts
git commit -m "feat(db): hard-cut forum body storage to html body content" -m "Constraint: Historical topic/comment body data may only be rewritten inside SQL migrations" -m "Confidence: medium" -m "Scope-risk: broad" -m "Directive: Do not reintroduce body_tokens to forum_topic or user_comment after this cutover" -m "Tested: pnpm test -- --runInBand --runTestsByPath libs/interaction/src/body/body-migration.contract.spec.ts; pnpm db:comments:check"
```

### 任务 6：周边消费链与摘要链路对齐

**文件：**
- 修改：`libs/forum/src/search/search.service.ts`
- 修改：`libs/forum/src/search/search.service.spec.ts`
- 修改：`libs/forum/src/profile/profile.service.ts`
- 修改：`libs/forum/src/topic/resolver/forum-topic-comment.resolver.ts`
- 修改：`libs/forum/src/topic/resolver/forum-topic-comment.resolver.spec.ts`
- 修改：`libs/interaction/src/comment/resolver/comment-like.resolver.ts`

- [ ] **步骤 1：先为搜索与摘录链路写失败测试**

```ts
it('keeps topic search snippets sourced from derived content while body html is no longer exposed', async () => {
  const result = await service['mapTopicResults'](
    [{ id: 1, title: '标题', content: '这是纯文本摘要来源', sectionId: 2, userId: 3, createdAt: new Date(), commentCount: 0, viewCount: 0, likeCount: 0, favoriteCount: 0 }],
    '摘要',
  )

  expect(result[0]?.topicContentSnippet).toContain('纯文本摘要来源')
  expect(result[0]).not.toHaveProperty('bodyTokens')
})
```

- [ ] **步骤 2：运行周边消费者测试，确认旧正文字段仍被暴露**

运行：`pnpm test -- --runInBand --runTestsByPath libs/forum/src/search/search.service.spec.ts libs/forum/src/topic/resolver/forum-topic-comment.resolver.spec.ts`

预期：FAIL，旧映射仍直接依赖 `body/bodyTokens/content` 外部字段，或未明确 `content` 仅供内部摘录使用。

- [ ] **步骤 3：明确 `content` 只作为内部派生列继续消费**

```ts
// libs/forum/src/search/search.service.ts
return {
  resultType: ForumSearchTypeEnum.TOPIC,
  topicId: topic.id,
  topicTitle: topic.title,
  topicContentSnippet: this.buildSnippet(topic.content, keyword),
}

// libs/forum/src/topic/resolver/forum-topic-comment.resolver.ts
commentExcerpt: comment.content,

// libs/interaction/src/comment/resolver/comment-like.resolver.ts
commentExcerpt: comment.content,
```

- [ ] **步骤 4：补注释，明确 snippet/excerpt 与 html 正文的分工**

```ts
// 构建搜索结果摘要时继续复用 content 派生列，避免在列表/搜索链路内重复解析 HTML。
private buildTopicContentSnippetSql() {
  return sql<string>`left(trim(${this.forumTopic.content}), 60)`
}
```

- [ ] **步骤 5：重新运行周边消费者测试确认通过**

运行：`pnpm test -- --runInBand --runTestsByPath libs/forum/src/search/search.service.spec.ts libs/forum/src/topic/resolver/forum-topic-comment.resolver.spec.ts libs/forum/src/hashtag/forum-hashtag.service.spec.ts`

预期：PASS，搜索/摘录仍使用 `content`，但对外 raw body 字段不再回流。

- [ ] **步骤 6：Commit**

```bash
git add libs/forum/src/search/search.service.ts libs/forum/src/search/search.service.spec.ts libs/forum/src/profile/profile.service.ts libs/forum/src/topic/resolver/forum-topic-comment.resolver.ts libs/forum/src/topic/resolver/forum-topic-comment.resolver.spec.ts libs/interaction/src/comment/resolver/comment-like.resolver.ts
git commit -m "refactor(forum): keep snippets on content while dropping body token exposure" -m "Constraint: Search and notification excerpts must remain cheap and must not parse html at read time" -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: content is an internal derived column only; do not promote it back into external raw body contracts" -m "Tested: pnpm test -- --runInBand --runTestsByPath libs/forum/src/search/search.service.spec.ts libs/forum/src/topic/resolver/forum-topic-comment.resolver.spec.ts libs/forum/src/hashtag/forum-hashtag.service.spec.ts"
```

### 任务 7：breaking-change 文档、规范例外与总体验证

**文件：**
- 创建：`docs/breaking-changes/forum-body-html-hard-cutover.md`
- 修改：`docs/breaking-changes/forum-body-model-breaking-update.md`
- 修改：`docs/superpowers/plans/2026-04-29-forum-body-html-hard-cutover.md`

- [ ] **步骤 1：先写失败的文档/契约自检**

```ts
it('documents html-only hard cut and explicit controller-rule exception', () => {
  const content = readFileSync(
    path.join(repoRoot, 'docs/breaking-changes/forum-body-html-hard-cutover.md'),
    'utf8',
  )

  expect(content).toContain('对外读写合同统一为 text/html')
  expect(content).toContain('内部继续保留 canonical body')
  expect(content).toContain('用户显式覆盖 Controller breaking-change versioning/compat 要求')
  expect(content).toContain('bodyTokens 已删除')
})
```

- [ ] **步骤 2：补 breaking-change 文档**

```md
## Norm Exception

- `.trae/rules/02-controller.md` 默认要求 breaking change 提供 versioning / compat / 下线计划。
- 本次 cutover 由用户显式覆盖该要求：
  - 沿用原路由
  - 同版本一次性硬切
  - 不保留运行时代码兼容层
  - 历史数据仅通过 migration 刷写
```

- [ ] **步骤 3：运行完整最小验证集**

运行：`pnpm test -- --runInBand --runTestsByPath libs/forum/src/topic/dto/forum-topic.dto.spec.ts libs/interaction/src/comment/dto/comment.dto.spec.ts libs/interaction/src/body/body-html-codec.service.spec.ts libs/forum/src/topic/forum-topic.service.spec.ts libs/interaction/src/comment/comment.service.spec.ts libs/interaction/src/body/body-migration.contract.spec.ts libs/forum/src/search/search.service.spec.ts libs/forum/src/topic/resolver/forum-topic-comment.resolver.spec.ts libs/forum/src/hashtag/forum-hashtag.service.spec.ts`

预期：PASS，topic/comment HTML-only 合同、codec、migration contract、搜索/snippet 行为全部通过。

- [ ] **步骤 4：运行类型检查**

运行：`pnpm type-check`

预期：PASS，无 DTO、type、service、schema 之间的签名漂移。

- [ ] **步骤 5：检查最终 diff 边界**

运行：`git diff -- docs/breaking-changes/forum-body-html-hard-cutover.md libs/interaction/src/body libs/forum/src/topic libs/interaction/src/comment libs/forum/src/hashtag libs/forum/src/search libs/forum/src/profile db/schema/forum/forum-topic.ts db/schema/app/user-comment.ts db/migration/20260429150000_forum_body_html_hard_cutover/migration.sql db/comments/generated.sql`

预期：只包含 HTML-only 合同、codec、topic/comment 主链、周边消费者、schema/migration、文档相关变更；不包含 chat/message 等无关正文域。

- [ ] **步骤 6：Commit**

```bash
git add docs/breaking-changes/forum-body-html-hard-cutover.md docs/breaking-changes/forum-body-model-breaking-update.md libs/interaction/src/body libs/forum/src/topic libs/interaction/src/comment libs/forum/src/hashtag libs/forum/src/search libs/forum/src/profile db/schema/forum/forum-topic.ts db/schema/app/user-comment.ts db/migration/20260429150000_forum_body_html_hard_cutover/migration.sql db/comments/generated.sql
git commit -m "feat(forum): complete html-only body hard cut plan implementation" -m "Constraint: This cutover intentionally keeps original routes and records the user-approved exception to controller versioning guidance" -m "Confidence: medium" -m "Scope-risk: broad" -m "Directive: Future body protocol changes must start from html/body/content baseline and use migrations for historical rewrites" -m "Tested: pnpm test -- --runInBand --runTestsByPath libs/forum/src/topic/dto/forum-topic.dto.spec.ts libs/interaction/src/comment/dto/comment.dto.spec.ts libs/interaction/src/body/body-html-codec.service.spec.ts libs/forum/src/topic/forum-topic.service.spec.ts libs/interaction/src/comment/comment.service.spec.ts libs/interaction/src/body/body-migration.contract.spec.ts libs/forum/src/search/search.service.spec.ts libs/forum/src/topic/resolver/forum-topic-comment.resolver.spec.ts libs/forum/src/hashtag/forum-hashtag.service.spec.ts; pnpm type-check"
```
