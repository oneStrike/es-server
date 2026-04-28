import type { JsonValue } from '@libs/platform/utils'
import {
  EnumProperty,
  JsonProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BodyInputModeEnum } from '../body.constant'

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
 * topic 正文输入模式 DTO。
 * - `plain` 表示提交纯文本；`rich` 表示提交结构化正文。
 */
export class BodyInputModeDto {
  @EnumProperty({
    description: '正文输入模式（plain=纯文本；rich=富文本）',
    required: true,
    enum: BodyInputModeEnum,
    example: BodyInputModeEnum.PLAIN,
  })
  bodyMode!: BodyInputModeEnum
}

/**
 * topic 纯文本正文 DTO。
 * - 仅在 `bodyMode=plain` 时使用。
 */
export class PlainTextBodyInputDto {
  @StringProperty({
    description: '纯文本正文；仅 bodyMode=plain 时使用',
    required: false,
    minLength: 1,
    example: '欢迎来到论坛 @测试用户 :smile:',
  })
  plainText?: string
}

/**
 * 可选 body DTO。
 * - 仅在 `bodyMode=rich` 时使用。
 */
export class OptionalBodyDocDto {
  @JsonProperty({
    description: '结构化正文文档；仅 bodyMode=rich 时使用',
    required: false,
    validation: false,
    example: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '富文本主题正文' }],
        },
      ],
    },
  })
  body?: JsonValue
}
