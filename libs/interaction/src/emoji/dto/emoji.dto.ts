import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  JsonProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'
import {
  EMOJI_SCENE_VALUES,
  EmojiAssetKindEnum,
  EmojiSceneEnum,
} from '../emoji.constant'

/**
 * 表情包基础 DTO。
 * - 映射自 emojiPack 表，用于管理端接口的共享字段定义。
 * - sceneType 使用 EmojiSceneEnum[] 而非裸 number[]，保证类型安全。
 */
export class BaseEmojiPackDto extends BaseDto {
  @StringProperty({
    description: '表情包编码',
    example: 'default',
    maxLength: 64,
  })
  code!: string

  @StringProperty({
    description: '表情包名称',
    example: '默认表情',
    maxLength: 100,
  })
  name!: string

  @StringProperty({
    description: '描述',
    example: '平台默认表情包',
    required: false,
    maxLength: 500,
  })
  description?: string | null

  @StringProperty({
    description: '图标地址',
    example: 'https://cdn.example.com/emoji/default.png',
    required: false,
    maxLength: 500,
  })
  iconUrl?: string | null

  @NumberProperty({
    description: '排序值',
    example: 10,
    default: 0,
    min: 0,
  })
  sortOrder!: number

  @BooleanProperty({
    description: '启用状态',
    example: true,
    default: true,
  })
  isEnabled!: boolean

  @BooleanProperty({
    description: '是否在选择器可见',
    example: true,
    default: true,
  })
  visibleInPicker!: boolean

  @ArrayProperty({
    description: '场景类型（1=聊天,2=评论,3=论坛主题）',
    itemType: 'number',
    itemEnum: EmojiSceneEnum,
    example: [...EMOJI_SCENE_VALUES],
    default: [...EMOJI_SCENE_VALUES],
  })
  sceneType!: EmojiSceneEnum[]

  @NumberProperty({
    description: '创建人ID',
    example: 1,
    required: false,
    validation: false,
  })
  createdById?: number | null

  @NumberProperty({
    description: '更新人ID',
    example: 1,
    required: false,
    validation: false,
  })
  updatedById?: number | null

  @DateProperty({
    description: '删除时间',
    example: '2026-03-27T00:00:00.000Z',
    required: false,
    validation: false,
  })
  deletedAt?: Date | null
}

/**
 * 表情资源基础 DTO。
 * - 映射自 emojiAsset 表，用于管理端接口的共享字段定义。
 * - kind 决定字段填充规则：CUSTOM 需 shortcode+imageUrl，UNICODE 需 unicodeSequence。
 */
export class BaseEmojiAssetDto extends BaseDto {
  @NumberProperty({
    description: '表情包ID',
    example: 101,
  })
  packId!: number

  @EnumProperty({
    description: '资源类型（1=unicode,2=custom）',
    enum: EmojiAssetKindEnum,
    example: EmojiAssetKindEnum.CUSTOM,
  })
  kind!: EmojiAssetKindEnum

  @StringProperty({
    description: '短码（custom 必填）',
    example: 'smile',
    required: false,
    maxLength: 32,
  })
  shortcode?: string | null

  @StringProperty({
    description: 'Unicode 序列（unicode 必填）',
    example: '😀',
    required: false,
    maxLength: 191,
  })
  unicodeSequence?: string | null

  @StringProperty({
    description: '资源地址（custom 必填）',
    example: 'https://cdn.example.com/emoji/smile.gif',
    required: false,
    maxLength: 500,
  })
  imageUrl?: string | null

  @StringProperty({
    description: '静态资源地址',
    example: 'https://cdn.example.com/emoji/smile.png',
    required: false,
    maxLength: 500,
  })
  staticUrl?: string | null

  @BooleanProperty({
    description: '是否动图',
    example: false,
    default: false,
  })
  isAnimated!: boolean

  @StringProperty({
    description: '分类',
    example: 'people',
    required: false,
    maxLength: 32,
  })
  category?: string | null

  @JsonProperty({
    description: '关键词（多语言）',
    // prettier-ignore
    example: { "zh-CN": ["微笑"], "en-US": ["smile"] },
    required: false,
  })
  keywords?: Record<string, string[]> | null

  @NumberProperty({
    description: '排序值',
    example: 10,
    default: 0,
    min: 0,
  })
  sortOrder!: number

  @BooleanProperty({
    description: '启用状态',
    example: true,
    default: true,
  })
  isEnabled!: boolean

  @NumberProperty({
    description: '创建人ID',
    example: 1,
    required: false,
    validation: false,
  })
  createdById?: number | null

  @NumberProperty({
    description: '更新人ID',
    example: 1,
    required: false,
    validation: false,
  })
  updatedById?: number | null

  @DateProperty({
    description: '删除时间',
    example: '2026-03-27T00:00:00.000Z',
    required: false,
    validation: false,
  })
  deletedAt?: Date | null
}
