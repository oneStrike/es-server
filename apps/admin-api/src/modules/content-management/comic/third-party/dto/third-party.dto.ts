import { ValidateString } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import { ApiProperty } from '@nestjs/swagger'

export class SearchComicRequestDto {
  @ValidateString({
    required: true,
    maxLength: 100,
    description: '搜索关键词',
    example: '进击的巨人',
  })
  keyword!: string

  @ValidateString({
    required: true,
    maxLength: 10,
    description: '平台代码',
    example: 'copy',
  })
  platform!: string
}

export class PlatformResponseDto {
  @ApiProperty({
    description: '平台名称',
    example: '拷贝',
    type: 'string',
    required: true,
  })
  name: string

  @ApiProperty({
    description: '平台名称code',
    example: 'copy',
    type: 'string',
    required: true,
  })
  code: string
}

export class SearchComicItemDto extends IdDto {
  @ApiProperty({
    description: '漫画名称',
    example: '进击的巨人',
    type: 'string',
  })
  name: string

  @ApiProperty({
    description: '封面图片URL',
    example: 'https://example.com/cover.jpg',
    type: 'string',
  })
  cover: string

  @ApiProperty({
    description: '作者列表',
    type: [String],
    example: ['谏山创'],
  })
  author: string[]

  @ApiProperty({
    description: '来源平台',
    example: '拷贝',
    type: 'string',
  })
  source: string
}
