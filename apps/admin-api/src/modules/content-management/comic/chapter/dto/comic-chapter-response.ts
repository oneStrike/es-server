import { ApiProperty } from '@nestjs/swagger'
import { BaseComicChapterDto } from './comic-chapter.dto'

/**
 * 关联的漫画信息
 */
export class RelatedComicDto {
  @ApiProperty({ description: '漫画ID', example: 1 })
  id: number

  @ApiProperty({ description: '漫画名字', example: '示例漫画' })
  name: string
}

/**
 * 漫画详情接口响应dto
 */

export class ComicChapterDetailDto extends BaseComicChapterDto {
  @ApiProperty({
    description: '关联的漫画信息',
    type: RelatedComicDto,
  })
  relatedComic: RelatedComicDto
}
