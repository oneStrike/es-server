import {
  BaseEmojiAssetDto,
  BaseEmojiPackDto,
  EmojiSceneEnum,
} from '@libs/interaction/emoji'
import {
  ArrayProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { PickType } from '@nestjs/swagger'

class EmojiPackSnapshotDto extends PickType(BaseEmojiPackDto, [
  'id',
  'code',
  'name',
  'iconUrl',
] as const) {}

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

export class QueryEmojiCatalogDto {
  @EnumProperty({
    description: '场景（1=chat,2=comment,3=forum）',
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

export class ReportEmojiRecentUseDto extends QueryEmojiCatalogDto {
  @NumberProperty({
    description: '表情资源ID',
    example: 1001,
    min: 1,
  })
  emojiAssetId!: BaseEmojiAssetDto['id']
}
