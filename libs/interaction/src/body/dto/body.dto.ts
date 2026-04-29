import type { JsonValue } from '@libs/platform/utils'
import {
  JsonProperty,
  StringProperty,
} from '@libs/platform/decorators'

/**
 * canonical body 文档 DTO。
 * - 递归结构校验交给 body validator service，不在 DTO 层做深度递归约束。
 */
export class BodyDocDto {
  @JsonProperty({
    description: '结构化正文文档',
    required: true,
    validation: false,
    example: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '欢迎来到论坛 ' },
            {
              type: 'forumHashtag',
              hashtagId: 77,
              slug: 'typescript',
              displayName: 'TypeScript',
            },
            { type: 'text', text: '，并 ' },
            {
              type: 'mentionUser',
              userId: 9,
              nickname: '测试用户',
            },
            {
              type: 'emojiUnicode',
              unicodeSequence: '😀',
            },
          ],
        },
      ],
    },
  })
  body!: JsonValue
}

/**
 * 正文 HTML 输入 DTO。
 * - 对外唯一写入合同，纯文本编辑器也必须输出最小 HTML。
 */
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
