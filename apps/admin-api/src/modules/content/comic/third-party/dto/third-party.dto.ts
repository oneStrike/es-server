import { ArrayProperty, StringProperty } from '@libs/platform/decorators'
import { IdDto, PageDto } from '@libs/platform/dto'
import { PickType } from '@nestjs/swagger'

export class SearchComicRequestDto extends PageDto {
  @StringProperty({
    required: true,
    maxLength: 100,
    description: '搜索关键词',
    example: '进击的巨人',
  })
  keyword!: string

  @StringProperty({
    required: true,
    maxLength: 10,
    description: '平台代码',
    example: 'copy',
  })
  platform!: string
}

export class DetailComicRequestDto extends PickType(SearchComicRequestDto, [
  'platform',
]) {
  @StringProperty({
    required: true,
    maxLength: 100,
    description: '漫画ID',
    example: '123456',
  })
  comicId!: string
}

export class ChapterContentComicRequestDto extends DetailComicRequestDto {
  @StringProperty({
    required: true,
    maxLength: 100,
    description: '章节ID',
    example: '654321',
  })
  chapterId!: string
}

export const THIRD_PARTY_COMIC_DETAIL_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  description: '第三方平台漫画详情原始数据',
} as const

export const THIRD_PARTY_COMIC_CHAPTER_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  description: '第三方平台漫画章节原始数据',
} as const

export const THIRD_PARTY_COMIC_CHAPTER_CONTENT_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  description: '第三方平台漫画章节内容原始数据',
} as const

export class PlatformResponseDto {
  @StringProperty({
    description: '平台名称',
    example: '拷贝',
    required: true,
    validation: false,
  })
  name: string

  @StringProperty({
    description: '平台名称code',
    example: 'copy',
    required: true,
    validation: false,
  })
  code: string
}

export class SearchComicItemDto extends IdDto {
  @StringProperty({
    description: '漫画名称',
    example: '进击的巨人',
    validation: false,
  })
  name: string

  @StringProperty({
    description: '封面图片URL',
    example: 'https://example.com/cover.jpg',
    validation: false,
  })
  cover: string

  @ArrayProperty({
    description: '作者列表',
    itemType: 'string',
    example: ['谏山创'],
    validation: false,
  })
  author: string[]

  @StringProperty({
    description: '来源平台',
    example: '拷贝',
    validation: false,
  })
  source: string
}
