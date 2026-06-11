import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  ObjectProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto/page.dto'
import { WorkflowErrorFactsDto } from '@libs/platform/modules/workflow/dto/workflow.dto'
import { WorkflowErrorCodeEnum } from '@libs/platform/modules/workflow/workflow-error-facts'
import { PickType } from '@nestjs/swagger'
import {
  ComicArchiveIgnoreReasonEnum,
  ComicArchiveImportItemStatusEnum,
  ComicArchivePreviewModeEnum,
  ComicArchiveTaskStatusEnum,
} from '../comic-archive-import.constant'

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
  @NumberProperty({
    description: '内容索引',
    example: 0,
    required: true,
    min: 0,
  })
  index!: number

  @StringProperty({
    description: '内容路径',
    example: '/uploads/comic/1/chapter/1/1.jpg',
    required: true,
  })
  content!: string
}

export class DeleteComicContentDto extends ChapterIdDto {
  @ArrayProperty({
    description: '内容索引列表',
    itemType: 'number',
    example: [0, 1],
    required: true,
  })
  index!: number[]
}

export class MoveComicContentDto extends ChapterIdDto {
  @NumberProperty({ description: '源索引', example: 0, required: true, min: 0 })
  fromIndex!: number

  @NumberProperty({
    description: '目标索引',
    example: 1,
    required: true,
    min: 0,
  })
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

  @StringProperty({
    description: '预解析会话工作流任务ID',
    example: '8f12f79c-7d89-4daa-a6ea-c2af4d56e650',
    required: true,
  })
  jobId!: string
}

export class CreateComicArchiveSessionDto {
  @NumberProperty({ description: '作品ID', example: 1, required: true })
  workId!: number

  @NumberProperty({
    description: '单章节压缩包对应的章节ID',
    example: 101,
    required: false,
  })
  chapterId?: number
}

export class ComicArchiveWorkflowJobIdDto {
  @StringProperty({
    description: '导入工作流任务ID',
    example: '8f12f79c-7d89-4daa-a6ea-c2af4d56e650',
    required: true,
  })
  jobId!: string
}

export class ConfirmComicArchiveDto extends ComicArchiveWorkflowJobIdDto {
  @ArrayProperty({
    description: '用户确认要导入的章节ID列表',
    itemType: 'number',
    example: [101, 102],
    required: true,
  })
  confirmedChapterIds!: number[]
}

export class ComicArchiveSummaryDto {
  @NumberProperty({
    description: '可导入章节数',
    example: 2,
    required: true,
    validation: false,
  })
  matchedChapterCount!: number

  @NumberProperty({
    description: '忽略项数量',
    example: 3,
    required: true,
    validation: false,
  })
  ignoredItemCount!: number

  @NumberProperty({
    description: '有效图片总数',
    example: 45,
    required: true,
    validation: false,
  })
  imageCount!: number
}

export class ComicArchiveIgnoredItemDto {
  @StringProperty({
    description: '忽略项表达码',
    example: 'ARCHIVE_IMPORT_CHAPTER_NOT_FOUND',
    required: true,
    validation: false,
  })
  code!: string

  @ObjectProperty({
    description: '忽略项表达事实',
    example: { path: 'chapter-12' },
    required: true,
    validation: false,
  })
  context!: Record<string, unknown>

  @StringProperty({
    description: '被忽略的路径',
    example: 'chapter-12',
    required: true,
    validation: false,
  })
  path!: string

  @EnumProperty({
    description:
      '忽略原因码（1001=章节目录名非法；1002=章节不存在；1003=嵌套目录忽略；1004=缺少章节ID；1005=图片文件非法）',
    example: ComicArchiveIgnoreReasonEnum.INVALID_CHAPTER_ID_DIR,
    enum: ComicArchiveIgnoreReasonEnum,
    required: true,
    validation: false,
  })
  reason!: ComicArchiveIgnoreReasonEnum
}

export class ComicArchiveMatchedItemDto {
  @StringProperty({
    description: '匹配来源路径',
    example: '101',
    required: true,
    validation: false,
  })
  path!: string

  @NumberProperty({
    description: '章节ID',
    example: 101,
    required: true,
    validation: false,
  })
  chapterId!: number

  @StringProperty({
    description: '章节标题',
    example: '第101话',
    required: true,
    validation: false,
  })
  chapterTitle!: string

  @NumberProperty({
    description: '压缩包内图片数量',
    example: 23,
    required: true,
    validation: false,
  })
  imageCount!: number

  @BooleanProperty({
    description: '章节当前是否已有内容',
    example: true,
    required: true,
    validation: false,
  })
  hasExistingContent!: boolean

  @NumberProperty({
    description: '章节当前已有图片数量',
    example: 18,
    required: true,
    validation: false,
  })
  existingImageCount!: number

  @StringProperty({
    description: '导入模式',
    example: 'replace',
    required: true,
    validation: false,
  })
  importMode!: string

  @StringProperty({
    description: '匹配结果表达码',
    example: 'ARCHIVE_IMPORT_MATCHED',
    required: true,
    validation: false,
  })
  statusCode!: string

  @ObjectProperty({
    description: '匹配结果表达事实',
    example: { chapterId: 101, imageCount: 18, path: '101' },
    required: true,
    validation: false,
  })
  statusContext!: Record<string, unknown>

  @NestedProperty({
    description: '覆盖风险事实；admin 负责表达',
    nullable: true,
    required: true,
    type: WorkflowErrorFactsDto,
    validation: false,
  })
  warning!: WorkflowErrorFactsDto | null
}

export class ComicArchiveResultItemDto {
  @NumberProperty({
    description: '章节ID',
    example: 101,
    required: true,
    nullable: true,
    validation: false,
  })
  chapterId!: number | null

  @StringProperty({
    description: '章节标题',
    example: '第101话',
    required: true,
    validation: false,
  })
  chapterTitle!: string

  @NumberProperty({
    description: '已导入图片数量',
    example: 23,
    required: true,
    validation: false,
  })
  importedImageCount!: number

  @EnumProperty({
    description: '执行状态（0=待处理；1=成功；2=失败）',
    example: ComicArchiveImportItemStatusEnum.SUCCESS,
    enum: ComicArchiveImportItemStatusEnum,
    required: true,
    validation: false,
  })
  status!: ComicArchiveImportItemStatusEnum

  @NestedProperty({
    description: '失败事实；admin 负责表达',
    nullable: true,
    type: WorkflowErrorFactsDto,
    validation: false,
  })
  error!: WorkflowErrorFactsDto | null
}

export class ComicArchiveTaskResponseDto extends ComicArchiveWorkflowJobIdDto {
  @NumberProperty({
    description: '作品ID',
    example: 1,
    required: true,
    nullable: true,
    validation: false,
  })
  workId!: number | null

  @EnumProperty({
    description: '预解析模式（1=单章节压缩包；2=多章节压缩包）',
    example: ComicArchivePreviewModeEnum.MULTI_CHAPTER,
    enum: ComicArchivePreviewModeEnum,
    required: true,
    validation: false,
  })
  mode!: ComicArchivePreviewModeEnum

  @StringProperty({
    description: '原始压缩包名称',
    example: '第1话.zip',
    nullable: true,
    validation: false,
  })
  archiveName!: string | null

  @EnumProperty({
    description:
      '任务状态（0=草稿；1=待处理；2=处理中；3=成功；4=部分失败；5=失败；6=已过期；7=已取消）',
    example: ComicArchiveTaskStatusEnum.DRAFT,
    enum: ComicArchiveTaskStatusEnum,
    required: true,
    validation: false,
  })
  status!: ComicArchiveTaskStatusEnum

  @BooleanProperty({
    description: '是否需要用户确认',
    example: true,
    required: true,
    validation: false,
  })
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

  @StringProperty({
    description: '当前进度展示代码；后台根据代码和上下文生成文案',
    example: WorkflowErrorCodeEnum.ARCHIVE_IMPORT_PROGRESS_UPDATED,
    nullable: true,
    validation: false,
  })
  progressCode!: string | null

  @ObjectProperty({
    description: '当前进度展示上下文',
    example: { chapterIndex: 1, chapterTotal: 3 },
    validation: false,
    nullable: true,
  })
  progressContext!: Record<string, unknown> | null

  @ObjectProperty({
    description: '结构化进度详情快照；用于展示当前运行中的子进度',
    example: { kind: 'content-import.image', imageIndex: 1, imageTotal: 20 },
    validation: false,
    nullable: true,
  })
  progressDetail!: Record<string, unknown> | null

  @NestedProperty({
    description: '最后一次错误事实；admin 负责表达',
    nullable: true,
    type: WorkflowErrorFactsDto,
    validation: false,
  })
  lastError!: WorkflowErrorFactsDto | null

  @DateProperty({
    description: '开始处理时间',
    example: '2026-03-23T12:00:00.000Z',
    nullable: true,
    validation: false,
  })
  startedAt!: Date | null

  @DateProperty({
    description: '完成处理时间',
    example: '2026-03-23T12:05:00.000Z',
    nullable: true,
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

  @StringProperty({
    required: false,
    maxLength: 100,
    description: '章节分组',
    example: 'default',
  })
  group?: string
}

export class ChapterContentComicRequestDto extends DetailComicRequestDto {
  @StringProperty({
    required: true,
    maxLength: 100,
    description: '章节ID',
    example: '654321',
  })
  chapterId!: string

  @NumberProperty({
    required: false,
    description:
      '三方章节内容接口版本；CopyManga 第一版使用 chapter，第二版及以上使用 chapterN',
    example: 1,
  })
  chapterApiVersion?: number
}

/** 第三方漫画导入模式。 */
export enum ThirdPartyComicImportModeEnum {
  /** 新建本地作品。 */
  CREATE_NEW = 'createNew',
  /** 挂载到已有本地作品。 */
  ATTACH_TO_EXISTING = 'attachToExisting',
}

/** 第三方漫画章节导入动作。 */
export enum ThirdPartyComicImportChapterActionEnum {
  /** 新建本地章节。 */
  CREATE = 'create',
  /** 更新已有本地章节。 */
  UPDATE = 'update',
}

/** 第三方漫画导入封面处理方式。 */
export enum ThirdPartyComicImportCoverModeEnum {
  /** 使用第三方平台图片。 */
  PROVIDER = 'provider',
  /** 使用本地已上传图片。 */
  LOCAL = 'local',
  /** 跳过封面处理。 */
  SKIP = 'skip',
}

/** 第三方漫画整体导入状态。 */
export enum ThirdPartyComicImportStatusEnum {
  /** 全部导入成功。 */
  SUCCESS = 'success',
  /** 部分章节导入失败。 */
  PARTIAL_FAILED = 'partial_failed',
  /** 整体导入失败。 */
  FAILED = 'failed',
}

/** 第三方漫画导入中的作品处理状态。 */
export enum ThirdPartyComicImportWorkStatusEnum {
  /** 已新建本地作品。 */
  CREATED = 'created',
  /** 已挂载已有本地作品。 */
  ATTACHED = 'attached',
  /** 作品处理失败。 */
  FAILED = 'failed',
}

/** 第三方漫画导入中的封面处理状态。 */
export enum ThirdPartyComicImportCoverStatusEnum {
  /** 已上传第三方封面。 */
  UPLOADED = 'uploaded',
  /** 使用本地封面。 */
  LOCAL = 'local',
  /** 已跳过封面处理。 */
  SKIPPED = 'skipped',
  /** 封面处理失败。 */
  FAILED = 'failed',
}

/** 第三方漫画导入中的章节处理状态。 */
export enum ThirdPartyComicImportChapterStatusEnum {
  /** 已新建章节元数据。 */
  CREATED = 'created',
  /** 已更新章节元数据。 */
  UPDATED = 'updated',
  /** 已导入章节图片内容。 */
  CONTENT_IMPORTED = 'content_imported',
  /** 仅处理章节元数据。 */
  METADATA_ONLY = 'metadata_only',
  /** 已跳过章节处理。 */
  SKIPPED = 'skipped',
  /** 章节处理失败。 */
  FAILED = 'failed',
}

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

export class SearchComicItemDto {
  @StringProperty({
    description: '第三方漫画ID',
    example: 'woduzishenji',
    validation: false,
  })
  id!: string

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

  @StringProperty({
    description: '平台代码',
    example: 'copy',
    validation: false,
  })
  platform!: string
}

export class ThirdPartyComicSourceFlagsDto {
  @BooleanProperty({
    description: '三方是否锁定',
    example: false,
    validation: false,
  })
  isLock!: boolean

  @BooleanProperty({
    description: '三方是否需要登录',
    example: false,
    validation: false,
  })
  isLogin!: boolean

  @BooleanProperty({
    description: '三方是否需要绑定手机',
    example: false,
    validation: false,
  })
  isMobileBind!: boolean

  @BooleanProperty({
    description: '三方是否需要会员',
    example: false,
    validation: false,
  })
  isVip!: boolean
}

export class ThirdPartyComicGroupDto {
  @StringProperty({
    description: '三方分组标识',
    example: 'default',
    validation: false,
  })
  pathWord!: string

  @StringProperty({
    description: '三方分组名称',
    example: '默认',
    validation: false,
  })
  name!: string

  @NumberProperty({
    description: '分组章节数',
    example: 12,
    validation: false,
  })
  count!: number
}

export class ThirdPartyComicDetailDto {
  @StringProperty({
    description: '第三方漫画ID',
    example: 'woduzishenji',
    validation: false,
  })
  id!: string

  @StringProperty({
    description: '第三方漫画 UUID',
    example: '3b65f136-a419-11eb-a88c-024352452ce0',
    required: false,
    validation: false,
  })
  uuid?: string

  @StringProperty({
    description: '漫画名称',
    example: '我独自升级',
    validation: false,
  })
  name!: string

  @StringProperty({
    description: '漫画别名',
    example: 'Solo Leveling',
    required: false,
    validation: false,
  })
  alias?: string

  @StringProperty({
    description: '第三方路径标识',
    example: 'woduzishenji',
    validation: false,
  })
  pathWord!: string

  @StringProperty({
    description: '三方封面 URL',
    example: 'https://example.com/cover.jpg',
    required: false,
    validation: false,
  })
  cover?: string

  @StringProperty({
    description: '三方简介',
    example: '作品简介',
    required: false,
    validation: false,
  })
  brief?: string

  @StringProperty({
    description: '三方地区展示值',
    example: '韩国',
    required: false,
    validation: false,
  })
  region?: string

  @StringProperty({
    description: '三方状态展示值',
    example: '已完结',
    required: false,
    validation: false,
  })
  status?: string

  @ArrayProperty({
    description: '三方作者名称列表',
    itemType: 'string',
    example: ['DUBU'],
    validation: false,
  })
  authors!: string[]

  @ArrayProperty({
    description: '三方分类或题材名称列表',
    itemType: 'string',
    example: ['冒险'],
    validation: false,
  })
  taxonomies!: string[]

  @NumberProperty({
    description: '三方热度',
    example: 1000,
    required: false,
    validation: false,
  })
  popular?: number

  @StringProperty({
    description: '三方最后更新时间',
    example: '2026-05-11',
    required: false,
    validation: false,
  })
  datetimeUpdated?: string

  @ArrayProperty({
    description: '三方章节分组',
    itemClass: ThirdPartyComicGroupDto,
    validation: false,
  })
  groups!: ThirdPartyComicGroupDto[]

  @NestedProperty({
    description: '三方访问标记',
    type: ThirdPartyComicSourceFlagsDto,
    validation: false,
  })
  sourceFlags!: ThirdPartyComicSourceFlagsDto
}

export class ThirdPartyComicImageDto {
  @StringProperty({
    description: '三方图片ID',
    example: 'image-001',
    validation: false,
  })
  providerImageId!: string

  @StringProperty({
    description: '三方图片 URL',
    example: 'https://example.com/1.jpg',
    validation: false,
  })
  url!: string

  @NumberProperty({
    description: '图片排序',
    example: 1,
    validation: false,
  })
  sortOrder!: number
}

export class ThirdPartyComicChapterDto {
  @StringProperty({
    description: '三方章节ID',
    example: 'chapter-001',
    validation: false,
  })
  providerChapterId!: string

  @StringProperty({
    description: '章节标题',
    example: '第1话',
    validation: false,
  })
  title!: string

  @StringProperty({
    description: '三方章节分组',
    example: 'default',
    required: false,
    validation: false,
  })
  group?: string

  @NumberProperty({
    description: '章节排序',
    example: 1,
    validation: false,
  })
  sortOrder!: number

  @NumberProperty({
    description: '三方章节图片数',
    example: 20,
    validation: false,
  })
  imageCount!: number

  @NumberProperty({
    description: '三方章节内容接口版本',
    example: 1,
    required: false,
    validation: false,
  })
  chapterApiVersion?: number

  @StringProperty({
    description: '三方章节创建时间',
    example: '2026-05-11T00:00:00+08:00',
    required: false,
    validation: false,
  })
  datetimeCreated?: string
}

export class ThirdPartyComicChapterContentDto {
  @StringProperty({
    description: '三方章节ID',
    example: 'chapter-001',
    validation: false,
  })
  providerChapterId!: string

  @StringProperty({
    description: '章节标题',
    example: '第1话',
    validation: false,
  })
  title!: string

  @ArrayProperty({
    description: '章节图片列表',
    itemClass: ThirdPartyComicImageDto,
    validation: false,
  })
  images!: ThirdPartyComicImageDto[]
}

export class ThirdPartyComicSourceSnapshotDto {
  @StringProperty({
    description: '三方漫画ID',
    example: 'woduzishenji',
  })
  providerComicId!: string

  @StringProperty({
    description: '三方路径标识',
    example: 'woduzishenji',
  })
  providerPathWord!: string

  @StringProperty({
    description: '三方章节分组路径标识',
    example: 'default',
  })
  providerGroupPathWord!: string

  @StringProperty({
    description: '三方 UUID',
    example: '3b65f136-a419-11eb-a88c-024352452ce0',
    required: false,
    validation: false,
  })
  uuid?: string

  @StringProperty({
    description: '抓取时间',
    example: '2026-05-11T00:00:00.000Z',
  })
  fetchedAt!: string
}

export class ThirdPartyComicImportWorkDraftDto {
  @StringProperty({
    description: '作品名称',
    example: '我独自升级',
    required: true,
  })
  name!: string

  @StringProperty({
    description: '作品别名',
    example: 'Solo Leveling',
    required: false,
  })
  alias?: string

  @StringProperty({
    description: '作品封面',
    example: '/uploads/comic/cover.jpg',
    required: false,
  })
  cover?: string

  @StringProperty({
    description: '作品简介',
    example: '作品简介',
    required: true,
  })
  description!: string

  @ArrayProperty({
    description: '作者ID列表',
    itemType: 'number',
    example: [1],
    required: true,
  })
  authorIds!: number[]

  @ArrayProperty({
    description: '分类ID列表',
    itemType: 'number',
    example: [1],
    required: true,
  })
  categoryIds!: number[]

  @ArrayProperty({
    description: '标签ID列表',
    itemType: 'number',
    example: [1],
    required: true,
  })
  tagIds!: number[]

  @StringProperty({ description: '语言代码', example: 'zh-CN', required: true })
  language!: string

  @StringProperty({ description: '地区代码', example: 'CN', required: true })
  region!: string

  @StringProperty({ description: '年龄分级', example: 'R14', required: false })
  ageRating?: string

  @NumberProperty({ description: '连载状态', example: 1, required: true })
  serialStatus!: number

  @NumberProperty({ description: '阅读规则', example: 0, required: true })
  viewRule!: number

  @NumberProperty({
    description: '章节默认价格',
    example: 0,
    required: false,
    default: 0,
  })
  chapterPrice?: number

  @BooleanProperty({
    description: '是否允许评论',
    example: true,
    required: false,
    default: true,
  })
  canComment?: boolean

  @BooleanProperty({
    description: '是否推荐',
    example: false,
    required: false,
    default: false,
  })
  isRecommended?: boolean

  @BooleanProperty({
    description: '是否热门',
    example: false,
    required: false,
    default: false,
  })
  isHot?: boolean

  @BooleanProperty({
    description: '是否新作',
    example: false,
    required: false,
    default: false,
  })
  isNew?: boolean

  @NumberProperty({
    description: '推荐权重',
    example: 0,
    required: false,
    default: 0,
  })
  recommendWeight?: number

  @StringProperty({
    description: '原始来源',
    example: 'CopyManga:woduzishenji',
    required: false,
  })
  originalSource?: string

  @StringProperty({
    description: '管理员备注',
    example: '三方导入',
    required: false,
  })
  remark?: string
}

export class ThirdPartyComicImportPreviewWorkDraftDto {
  @StringProperty({
    description: '作品名称',
    example: '我独自升级',
    validation: false,
  })
  name!: string

  @StringProperty({
    description: '作品别名',
    example: 'Solo Leveling',
    nullable: true,
    validation: false,
  })
  alias!: string | null

  @StringProperty({
    description: '作品简介',
    example: '作品简介',
    validation: false,
  })
  description!: string

  @StringProperty({
    description: '原始来源',
    example: 'CopyManga:woduzishenji',
    validation: false,
  })
  originalSource!: string

  @StringProperty({
    description: '管理员备注',
    example: '三方导入',
    validation: false,
  })
  remark!: string

  @StringProperty({
    description: '建议地区',
    example: '韩国',
    nullable: true,
    validation: false,
  })
  suggestedRegion!: string | null

  @NumberProperty({
    description: '建议连载状态',
    example: 2,
    nullable: true,
    validation: false,
  })
  suggestedSerialStatus!: number | null
}

export class ThirdPartyComicProviderCoverOptionDto {
  @StringProperty({
    description: '三方图片ID',
    example: 'cover:woduzishenji',
    validation: false,
  })
  providerImageId!: string

  @StringProperty({
    description: '三方图片 URL',
    example: 'https://example.com/cover.jpg',
    validation: false,
  })
  url!: string
}

export class ThirdPartyComicCoverOptionsDto {
  @NestedProperty({
    description: '三方封面候选',
    type: ThirdPartyComicProviderCoverOptionDto,
    validation: false,
    nullable: true,
  })
  provider!: ThirdPartyComicProviderCoverOptionDto | null

  @BooleanProperty({
    description: '是否必须本地上传封面',
    example: false,
    validation: false,
  })
  localRequired!: boolean
}

export class ThirdPartyComicLocalCandidateDto {
  @NumberProperty({ description: '本地ID', example: 1, validation: false })
  id!: number

  @StringProperty({
    description: '本地名称',
    example: 'DUBU',
    validation: false,
  })
  name!: string
}

export class ThirdPartyComicRelationCandidateItemDto {
  @StringProperty({
    description: '三方名称',
    example: 'DUBU',
    validation: false,
  })
  providerName!: string

  @ArrayProperty({
    description: '本地候选',
    itemClass: ThirdPartyComicLocalCandidateDto,
    validation: false,
  })
  localCandidates!: ThirdPartyComicLocalCandidateDto[]
}

export class ThirdPartyComicRelationCandidatesDto {
  @ArrayProperty({
    description: '作者候选',
    itemClass: ThirdPartyComicRelationCandidateItemDto,
    validation: false,
  })
  authors!: ThirdPartyComicRelationCandidateItemDto[]

  @ArrayProperty({
    description: '分类候选',
    itemClass: ThirdPartyComicRelationCandidateItemDto,
    validation: false,
  })
  categories!: ThirdPartyComicRelationCandidateItemDto[]

  @ArrayProperty({
    description: '标签候选',
    itemClass: ThirdPartyComicRelationCandidateItemDto,
    validation: false,
  })
  tags!: ThirdPartyComicRelationCandidateItemDto[]
}

export class ThirdPartyComicImportPreviewDto {
  @StringProperty({
    description: '平台代码',
    example: 'copy',
    validation: false,
  })
  platform!: string

  @StringProperty({
    description: '三方漫画ID',
    example: 'woduzishenji',
    validation: false,
  })
  comicId!: string

  @NestedProperty({
    description: '三方来源快照',
    type: ThirdPartyComicSourceSnapshotDto,
    validation: false,
  })
  sourceSnapshot!: ThirdPartyComicSourceSnapshotDto

  @NestedProperty({
    description: '三方详情',
    type: ThirdPartyComicDetailDto,
    validation: false,
  })
  detail!: ThirdPartyComicDetailDto

  @ArrayProperty({
    description: '章节分组',
    itemClass: ThirdPartyComicGroupDto,
    validation: false,
  })
  groups!: ThirdPartyComicGroupDto[]

  @ArrayProperty({
    description: '章节列表',
    itemClass: ThirdPartyComicChapterDto,
    validation: false,
  })
  chapters!: ThirdPartyComicChapterDto[]

  @NestedProperty({
    description: '本地作品草稿',
    type: ThirdPartyComicImportPreviewWorkDraftDto,
    validation: false,
  })
  workDraft!: ThirdPartyComicImportPreviewWorkDraftDto

  @NestedProperty({
    description: '封面导入选项',
    type: ThirdPartyComicCoverOptionsDto,
    validation: false,
  })
  coverOptions!: ThirdPartyComicCoverOptionsDto

  @NestedProperty({
    description: '本地关系候选',
    type: ThirdPartyComicRelationCandidatesDto,
    validation: false,
  })
  relationCandidates!: ThirdPartyComicRelationCandidatesDto

  @ArrayProperty({
    description: '缺失的本地必填字段',
    itemType: 'string',
    example: ['authorIds'],
    validation: false,
  })
  missingLocalFields!: string[]
}

export class ThirdPartyComicImportCoverDto {
  @EnumProperty({
    description: '封面处理方式（使用第三方平台图片；使用本地已上传图片；跳过封面处理）',
    enum: ThirdPartyComicImportCoverModeEnum,
    example: ThirdPartyComicImportCoverModeEnum.PROVIDER,
    required: true,
  })
  mode!: ThirdPartyComicImportCoverModeEnum

  @StringProperty({
    description: '三方图片ID',
    example: 'cover:woduzishenji',
    required: false,
  })
  providerImageId?: string

  @StringProperty({
    description: '本地上传路径',
    example: '/uploads/comic/cover.jpg',
    required: false,
  })
  localPath?: string
}

export class ThirdPartyComicImportChapterItemDto {
  @StringProperty({
    description: '三方章节ID',
    example: 'chapter-001',
    required: true,
  })
  providerChapterId!: string

  @NumberProperty({
    description: '三方章节内容接口版本',
    example: 1,
    required: false,
  })
  chapterApiVersion?: number

  @EnumProperty({
    description: '章节导入动作（新建章节；更新已有章节）',
    enum: ThirdPartyComicImportChapterActionEnum,
    example: ThirdPartyComicImportChapterActionEnum.CREATE,
    required: true,
  })
  action!: ThirdPartyComicImportChapterActionEnum

  @NumberProperty({ description: '目标章节ID', example: 1, required: false })
  targetChapterId?: number

  @StringProperty({
    description: '三方章节分组',
    example: 'default',
    required: false,
  })
  group?: string

  @StringProperty({ description: '章节标题', example: '第1话', required: true })
  title!: string

  @StringProperty({
    description: '章节副标题',
    example: '序章',
    required: false,
  })
  subtitle?: string

  @NumberProperty({ description: '排序值', example: 1, required: true })
  sortOrder!: number

  @StringProperty({
    description: '三方章节创建时间',
    example: '2026-05-11T00:00:00.000Z',
    required: false,
  })
  datetimeCreated?: string

  @NumberProperty({ description: '查看规则', example: -1, required: false })
  viewRule?: number

  @NumberProperty({ description: '章节价格', example: 0, required: false })
  price?: number

  @BooleanProperty({ description: '是否试读', example: false, required: false })
  isPreview?: boolean

  @BooleanProperty({
    description: '是否允许评论',
    example: true,
    required: false,
  })
  canComment?: boolean

  @BooleanProperty({
    description: '是否允许下载',
    example: true,
    required: false,
  })
  canDownload?: boolean

  @BooleanProperty({
    description: '是否导入章节图片',
    example: true,
    required: true,
  })
  importImages!: boolean

  @NestedProperty({
    description: '章节封面处理方式',
    type: ThirdPartyComicImportCoverDto,
    required: false,
    nullable: true,
  })
  cover?: ThirdPartyComicImportCoverDto

  @BooleanProperty({
    description: '是否覆盖已有章节内容',
    example: false,
    required: false,
  })
  overwriteContent?: boolean
}

export class ThirdPartyComicImportRequestDto {
  @StringProperty({ description: '平台代码', example: 'copy', required: true })
  platform!: string

  @StringProperty({
    description: '三方漫画ID',
    example: 'woduzishenji',
    required: true,
  })
  comicId!: string

  @EnumProperty({
    description: '导入模式（新建本地作品；挂载已有本地作品）',
    enum: ThirdPartyComicImportModeEnum,
    example: ThirdPartyComicImportModeEnum.CREATE_NEW,
    required: true,
  })
  mode!: ThirdPartyComicImportModeEnum

  @NestedProperty({
    description: '作品封面处理方式',
    type: ThirdPartyComicImportCoverDto,
    required: false,
    nullable: true,
  })
  cover?: ThirdPartyComicImportCoverDto

  @NestedProperty({
    description: '新建作品草稿',
    type: ThirdPartyComicImportWorkDraftDto,
    required: false,
    nullable: true,
  })
  workDraft?: ThirdPartyComicImportWorkDraftDto

  @NumberProperty({ description: '目标作品ID', example: 1, required: false })
  targetWorkId?: number

  @ArrayProperty({
    description: '导入章节列表',
    itemClass: ThirdPartyComicImportChapterItemDto,
    required: true,
  })
  chapters!: ThirdPartyComicImportChapterItemDto[]

  @NestedProperty({
    description: '三方来源快照',
    type: ThirdPartyComicSourceSnapshotDto,
    required: true,
  })
  sourceSnapshot!: ThirdPartyComicSourceSnapshotDto
}

export class ThirdPartyComicSyncLatestRequestDto {
  @NumberProperty({ description: '作品ID', example: 1, required: true })
  workId!: number
}

export class ThirdPartyComicImportWorkResultDto {
  @NumberProperty({
    description: '本地作品ID',
    example: 1,
    nullable: true,
    required: true,
    validation: false,
  })
  id!: number | null

  @EnumProperty({
    description: '作品处理状态（已新建作品；已挂载已有作品；作品处理失败）',
    enum: ThirdPartyComicImportWorkStatusEnum,
    example: ThirdPartyComicImportWorkStatusEnum.CREATED,
    validation: false,
  })
  status!: ThirdPartyComicImportWorkStatusEnum

  @StringProperty({
    description: '错误码',
    example: 'WORK_CREATE_FAILED',
    nullable: true,
    required: true,
    validation: false,
  })
  errorCode!: string | null

  @StringProperty({
    description: '结果说明',
    example: '作品创建成功',
    nullable: true,
    required: true,
    validation: false,
  })
  message!: string | null
}

export class ThirdPartyComicImportCoverResultDto {
  @EnumProperty({
    description: '封面处理状态（已上传第三方封面；使用本地封面；跳过封面；封面处理失败）',
    enum: ThirdPartyComicImportCoverStatusEnum,
    example: ThirdPartyComicImportCoverStatusEnum.UPLOADED,
    validation: false,
  })
  status!: ThirdPartyComicImportCoverStatusEnum

  @StringProperty({
    description: '本地文件路径',
    example: '/uploads/comic/cover.jpg',
    nullable: true,
    required: true,
    validation: false,
  })
  filePath!: string | null

  @StringProperty({
    description: '错误码',
    example: 'COVER_UPLOAD_FAILED',
    nullable: true,
    required: true,
    validation: false,
  })
  errorCode!: string | null

  @StringProperty({
    description: '结果说明',
    example: '封面上传成功',
    nullable: true,
    required: true,
    validation: false,
  })
  message!: string | null
}

export class ThirdPartyComicImportChapterResultDto {
  @StringProperty({
    description: '三方章节ID',
    example: 'chapter-001',
    validation: false,
  })
  providerChapterId!: string

  @NumberProperty({
    description: '本地章节ID',
    example: 1,
    nullable: true,
    required: true,
    validation: false,
  })
  localChapterId!: number | null

  @EnumProperty({
    description: '章节导入动作（新建章节；更新已有章节）',
    enum: ThirdPartyComicImportChapterActionEnum,
    example: ThirdPartyComicImportChapterActionEnum.CREATE,
    validation: false,
  })
  action!: ThirdPartyComicImportChapterActionEnum

  @EnumProperty({
    description:
      '章节处理状态（已新建元数据；已更新元数据；已导入图片；仅处理元数据；已跳过；章节处理失败）',
    enum: ThirdPartyComicImportChapterStatusEnum,
    example: ThirdPartyComicImportChapterStatusEnum.CONTENT_IMPORTED,
    validation: false,
  })
  status!: ThirdPartyComicImportChapterStatusEnum

  @NestedProperty({
    description: '章节封面处理结果',
    type: ThirdPartyComicImportCoverResultDto,
    required: true,
    validation: false,
    nullable: true,
  })
  cover!: ThirdPartyComicImportCoverResultDto | null

  @NumberProperty({
    description: '图片总数',
    example: 20,
    required: true,
    validation: false,
  })
  imageTotal!: number

  @NumberProperty({
    description: '成功图片数',
    example: 20,
    required: true,
    validation: false,
  })
  imageSucceeded!: number

  @StringProperty({
    description: '错误码',
    example: 'IMAGE_UPLOAD_FAILED',
    nullable: true,
    required: true,
    validation: false,
  })
  errorCode!: string | null

  @StringProperty({
    description: '结果说明',
    example: '章节导入成功',
    nullable: true,
    required: true,
    validation: false,
  })
  message!: string | null
}

export class ThirdPartyComicImportResultDto {
  @EnumProperty({
    description: '导入模式（新建本地作品；挂载已有本地作品）',
    enum: ThirdPartyComicImportModeEnum,
    example: ThirdPartyComicImportModeEnum.CREATE_NEW,
    validation: false,
  })
  mode!: ThirdPartyComicImportModeEnum

  @EnumProperty({
    description: '导入状态（全部成功；部分章节失败；整体失败）',
    enum: ThirdPartyComicImportStatusEnum,
    example: ThirdPartyComicImportStatusEnum.SUCCESS,
    validation: false,
  })
  status!: ThirdPartyComicImportStatusEnum

  @NestedProperty({
    description: '作品处理结果',
    type: ThirdPartyComicImportWorkResultDto,
    required: true,
    validation: false,
    nullable: true,
  })
  work!: ThirdPartyComicImportWorkResultDto | null

  @NestedProperty({
    description: '作品封面处理结果',
    type: ThirdPartyComicImportCoverResultDto,
    required: true,
    validation: false,
    nullable: true,
  })
  cover!: ThirdPartyComicImportCoverResultDto | null

  @ArrayProperty({
    description: '章节处理结果',
    itemClass: ThirdPartyComicImportChapterResultDto,
    validation: false,
  })
  chapters!: ThirdPartyComicImportChapterResultDto[]
}
