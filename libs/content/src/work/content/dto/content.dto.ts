import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { IdDto, PageDto } from '@libs/platform/dto'
import { PickType } from '@nestjs/swagger'

export class UploadContentDto {
  @NumberProperty({ description: '章节ID', example: 1, required: true })
  chapterId!: number

  @NumberProperty({ description: '作品ID', example: 1, required: true })
  workId!: number
}

class ChapterIdDto {
  @NumberProperty({ description: '章节ID', example: 1, required: true })
  chapterId!: number
}

export class UpdateComicContentDto extends ChapterIdDto {
  @NumberProperty({ description: '内容索引', example: 0, required: true, min: 0 })
  index!: number

  @StringProperty({ description: '内容路径', example: '/uploads/comic/1/chapter/1/1.jpg', required: true })
  content!: string
}

export class DeleteComicContentDto extends ChapterIdDto {
  @ArrayProperty({ description: '内容索引列表', itemType: 'number', example: [0, 1], required: true })
  index!: number[]
}

export class MoveComicContentDto extends ChapterIdDto {
  @NumberProperty({ description: '源索引', example: 0, required: true, min: 0 })
  fromIndex!: number

  @NumberProperty({ description: '目标索引', example: 1, required: true, min: 0 })
  toIndex!: number
}

export class PreviewComicArchiveDto {
  @NumberProperty({ description: '作品ID', example: 1, required: true })
  workId!: number

  @NumberProperty({
    description: '单章节压缩包对应的章节ID',
    example: 101,
    required: false,
  })
  chapterId?: number
}

export class ComicArchiveTaskIdDto {
  @StringProperty({ description: '导入任务ID', example: '8f12f79c-7d89-4daa-a6ea-c2af4d56e650', required: true })
  taskId!: string
}

export class ConfirmComicArchiveDto extends ComicArchiveTaskIdDto {
  @ArrayProperty({
    description: '用户确认要导入的章节ID列表',
    itemType: 'number',
    example: [101, 102],
    required: true,
  })
  confirmedChapterIds!: number[]
}

export class ComicArchiveSummaryDto {
  @NumberProperty({ description: '可导入章节数', example: 2, required: true, validation: false })
  matchedChapterCount!: number

  @NumberProperty({ description: '忽略项数量', example: 3, required: true, validation: false })
  ignoredItemCount!: number

  @NumberProperty({ description: '有效图片总数', example: 45, required: true, validation: false })
  imageCount!: number
}

export class ComicArchiveIgnoredItemDto {
  @StringProperty({ description: '被忽略的路径', example: 'chapter-12', required: true, validation: false })
  path!: string

  @NumberProperty({ description: '忽略原因码', example: 1001, required: true, validation: false })
  reason!: number

  @StringProperty({
    description: '友好提示信息',
    example: '目录 chapter-12 不是有效的章节 ID，已忽略。多章节压缩包只支持使用章节 ID 作为一级目录名。',
    required: true,
    validation: false,
  })
  message!: string
}

export class ComicArchiveMatchedItemDto {
  @StringProperty({ description: '匹配来源路径', example: '101', required: true, validation: false })
  path!: string

  @NumberProperty({ description: '章节ID', example: 101, required: true, validation: false })
  chapterId!: number

  @StringProperty({ description: '章节标题', example: '第101话', required: true, validation: false })
  chapterTitle!: string

  @NumberProperty({ description: '压缩包内图片数量', example: 23, required: true, validation: false })
  imageCount!: number

  @BooleanProperty({ description: '章节当前是否已有内容', example: true, required: true, validation: false })
  hasExistingContent!: boolean

  @NumberProperty({ description: '章节当前已有图片数量', example: 18, required: true, validation: false })
  existingImageCount!: number

  @StringProperty({ description: '导入模式', example: 'replace', required: true, validation: false })
  importMode!: string

  @StringProperty({ description: '匹配结果说明', example: '目录 101 已匹配到章节 101，可在确认后导入。', required: true, validation: false })
  message!: string

  @StringProperty({
    description: '覆盖提示信息',
    example: '章节 101 当前已有 18 张图片。确认导入后会用压缩包内容整体覆盖，旧资源首版不会自动删除。',
    required: true,
    validation: false,
  })
  warningMessage!: string
}

export class ComicArchiveResultItemDto {
  @NumberProperty({ description: '章节ID', example: 101, required: true, validation: false })
  chapterId!: number

  @StringProperty({ description: '章节标题', example: '第101话', required: true, validation: false })
  chapterTitle!: string

  @NumberProperty({ description: '已导入图片数量', example: 23, required: true, validation: false })
  importedImageCount!: number

  @StringProperty({ description: '执行状态', example: 'success', required: true, validation: false })
  status!: string

  @StringProperty({ description: '执行结果说明', example: '章节 101 导入成功', required: true, validation: false })
  message!: string
}

export class ComicArchiveTaskResponseDto extends ComicArchiveTaskIdDto {
  @NumberProperty({ description: '作品ID', example: 1, required: true, validation: false })
  workId!: number

  @StringProperty({ description: '预解析模式', example: 'multi_chapter', required: true, validation: false })
  mode!: string

  @StringProperty({ description: '任务状态', example: 'draft', required: true, validation: false })
  status!: string

  @BooleanProperty({ description: '是否需要用户确认', example: true, required: true, validation: false })
  requireConfirm!: boolean

  @ArrayProperty({
    description: '匹配成功的章节列表',
    itemClass: ComicArchiveMatchedItemDto,
    example: [],
    required: true,
    validation: false,
  })
  matchedItems!: ComicArchiveMatchedItemDto[]

  @ArrayProperty({
    description: '被忽略的路径列表',
    itemClass: ComicArchiveIgnoredItemDto,
    example: [],
    required: true,
    validation: false,
  })
  ignoredItems!: ComicArchiveIgnoredItemDto[]

  @ArrayProperty({
    description: '正式导入结果列表',
    itemClass: ComicArchiveResultItemDto,
    example: [],
    required: true,
    validation: false,
  })
  resultItems!: ComicArchiveResultItemDto[]

  @StringProperty({ description: '最后一次错误信息', example: '', required: false, validation: false })
  lastError?: string | null

  @DateProperty({
    description: '开始处理时间',
    example: '2026-03-23T12:00:00.000Z',
    required: false,
    validation: false,
  })
  startedAt!: Date | null

  @DateProperty({
    description: '完成处理时间',
    example: '2026-03-23T12:05:00.000Z',
    required: false,
    validation: false,
  })
  finishedAt!: Date | null

  @DateProperty({
    description: '任务过期时间',
    example: '2026-03-24T12:00:00.000Z',
    required: true,
    validation: false,
  })
  expiresAt!: Date

  @NestedProperty({
    description: '预解析汇总信息',
    type: ComicArchiveSummaryDto,
    required: true,
    validation: false,
    nullable: false,
  })
  summary!: ComicArchiveSummaryDto
}

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
] as const) {
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
  name!: string

  @StringProperty({
    description: '平台名称code',
    example: 'copy',
    required: true,
    validation: false,
  })
  code!: string
}

export class SearchComicItemDto extends IdDto {
  @StringProperty({
    description: '漫画名称',
    example: '进击的巨人',
    validation: false,
  })
  name!: string

  @StringProperty({
    description: '封面图片URL',
    example: 'https://example.com/cover.jpg',
    validation: false,
  })
  cover!: string

  @ArrayProperty({
    description: '作者列表',
    itemType: 'string',
    example: ['谏山创'],
    validation: false,
  })
  author!: string[]

  @StringProperty({
    description: '来源平台',
    example: '拷贝',
    validation: false,
  })
  source!: string
}
