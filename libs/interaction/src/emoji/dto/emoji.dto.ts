import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  JsonProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'

import { BaseDto, IdDto, PageDto } from '@libs/platform/dto'

import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
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
    contract: false,
  })
  deletedAt?: Date | null
}

class CreateEmojiPackWritableFieldsDto extends PickType(BaseEmojiPackDto, [
  'code',
  'name',
  'description',
  'iconUrl',
  'sceneType',
] as const) {}

class CreateEmojiPackOptionalFieldsDto {
  @NumberProperty({
    description: '排序值',
    example: 10,
    required: false,
    min: 0,
  })
  sortOrder?: number

  @BooleanProperty({
    description: '启用状态',
    example: true,
    default: true,
    required: false,
  })
  isEnabled?: boolean

  @BooleanProperty({
    description: '是否在选择器可见',
    example: true,
    default: true,
    required: false,
  })
  visibleInPicker?: boolean
}

export class CreateEmojiPackDto extends IntersectionType(
  CreateEmojiPackWritableFieldsDto,
  CreateEmojiPackOptionalFieldsDto,
) {}

export class UpdateEmojiPackDto extends IntersectionType(
  PartialType(CreateEmojiPackDto),
  IdDto,
) {}

export class UpdateEmojiPackSceneTypeDto extends IntersectionType(
  IdDto,
  PickType(BaseEmojiPackDto, ['sceneType'] as const),
) {}

export class QueryEmojiPackDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseEmojiPackDto, [
      'code',
      'name',
      'isEnabled',
      'visibleInPicker',
    ] as const),
  ),
) {}

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
    contract: false,
  })
  deletedAt?: Date | null
}

class CreateEmojiAssetWritableFieldsDto extends PickType(BaseEmojiAssetDto, [
  'packId',
  'kind',
  'shortcode',
  'unicodeSequence',
  'imageUrl',
  'staticUrl',
  'category',
  'keywords',
] as const) {}

class CreateEmojiAssetOptionalFieldsDto {
  @BooleanProperty({
    description: '是否动图',
    example: false,
    default: false,
    required: false,
  })
  isAnimated?: boolean

  @NumberProperty({
    description: '排序值',
    example: 10,
    required: false,
    min: 0,
  })
  sortOrder?: number

  @BooleanProperty({
    description: '启用状态',
    example: true,
    default: true,
    required: false,
  })
  isEnabled?: boolean
}

export class CreateEmojiAssetDto extends IntersectionType(
  CreateEmojiAssetWritableFieldsDto,
  CreateEmojiAssetOptionalFieldsDto,
) {}

export class UpdateEmojiAssetDto extends IntersectionType(
  PartialType(CreateEmojiAssetDto),
  IdDto,
) {}

export class QueryEmojiAssetDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseEmojiAssetDto, [
      'packId',
      'kind',
      'isEnabled',
      'shortcode',
      'category',
    ] as const),
  ),
) {}

export class QueryEmojiCatalogDto {
  @EnumProperty({
    description: '场景（1=聊天；2=评论；3=论坛主题）',
    enum: EmojiSceneEnum,
    example: EmojiSceneEnum.CHAT,
    required: false,
    default: EmojiSceneEnum.CHAT,
  })
  scene?: EmojiSceneEnum
}

export class QueryEmojiSearchDto extends QueryEmojiCatalogDto {
  @StringProperty({
    description: '搜索关键词',
    example: 'smile',
    minLength: 1,
    maxLength: 50,
  })
  q!: string

  @NumberProperty({
    description: '返回条数，默认30，最大100',
    example: 30,
    required: false,
    default: 30,
    min: 1,
    max: 100,
  })
  limit?: number
}

export class QueryEmojiRecentDto extends QueryEmojiCatalogDto {
  @NumberProperty({
    description: '返回条数，默认20，最大50',
    example: 20,
    required: false,
    default: 20,
    min: 1,
    max: 50,
  })
  limit?: number
}

class EmojiPackSnapshotDto extends PickType(BaseEmojiPackDto, [
  'id',
  'code',
  'name',
  'iconUrl',
] as const) {}

/**
 * 表情资源 DTO。
 */
export class EmojiAssetDto extends PickType(BaseEmojiAssetDto, [
  'id',
  'kind',
  'shortcode',
  'unicodeSequence',
  'imageUrl',
  'staticUrl',
  'isAnimated',
  'category',
  'keywords',
  'packId',
] as const) {
  @StringProperty({
    description: '所属表情包编码',
    example: 'default',
    validation: false,
  })
  packCode!: EmojiPackSnapshotDto['code']

  @StringProperty({
    description: '所属表情包名称',
    example: '默认表情',
    validation: false,
  })
  packName!: EmojiPackSnapshotDto['name']

  @StringProperty({
    description: '所属表情包图标地址',
    example: 'https://cdn.example.com/emoji/default.png',
    required: false,
    validation: false,
  })
  packIconUrl?: EmojiPackSnapshotDto['iconUrl']
}

/**
 * 表情目录分组 DTO。
 */
export class EmojiCatalogPackDto extends PickType(BaseEmojiPackDto, [
  'sortOrder',
] as const) {
  @NumberProperty({
    description: '表情包ID',
    example: 101,
    validation: false,
  })
  packId!: EmojiPackSnapshotDto['id']

  @StringProperty({
    description: '表情包编码',
    example: 'default',
    validation: false,
  })
  packCode!: EmojiPackSnapshotDto['code']

  @StringProperty({
    description: '表情包名称',
    example: '默认表情',
    validation: false,
  })
  packName!: EmojiPackSnapshotDto['name']

  @StringProperty({
    description: '表情包图标地址',
    example: 'https://cdn.example.com/emoji/default.png',
    required: false,
    validation: false,
  })
  packIconUrl?: EmojiPackSnapshotDto['iconUrl']

  @ArrayProperty({
    description: '表情资源列表',
    itemClass: EmojiAssetDto,
    example: [],
    validation: false,
  })
  assets!: EmojiAssetDto[]
}

/**
 * 最近使用表情 DTO。
 */
export class EmojiRecentItemDto extends EmojiAssetDto {
  @DateProperty({
    description: '最近使用时间',
    example: '2026-03-27T10:00:00.000Z',
    validation: false,
  })
  lastUsedAt!: Date

  @NumberProperty({
    description: '使用次数',
    example: 12,
    validation: false,
  })
  useCount!: number
}
