import type { FastifyRequest } from 'fastify'
import {
  ComicChapterContentDto,
  NovelChapterContentDto,
  PageWorkChapterDto,
  QueryWorkChapterCommentPageDto,
  QueryWorkChapterDto,
  WorkChapterDetailWithUserStatusDto,
} from '@libs/content/work/chapter/dto/work-chapter.dto'
import { WorkChapterService } from '@libs/content/work/chapter/work-chapter.service'
import { ComicContentService } from '@libs/content/work/content/comic-content.service'
import { NovelContentService } from '@libs/content/work/content/novel-content.service'
import { CommentService } from '@libs/interaction/comment/comment.service'
import { TargetCommentItemDto } from '@libs/interaction/comment/dto/comment.dto'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator'
import { CurrentUser } from '@libs/platform/decorators/current-user.decorator'
import { OptionalAuth } from '@libs/platform/decorators/public.decorator'
import { IdDto } from '@libs/platform/dto/base.dto'
import {
  extractRequestContext,
  serializeDeviceInfo,
} from '@libs/platform/utils'
import { Controller, Get, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('作品')
@Controller('app/work/chapter')
export class WorkChapterController {
  constructor(
    private readonly workChapterService: WorkChapterService,
    private readonly comicContentService: ComicContentService,
    private readonly novelContentService: NovelContentService,
    private readonly commentService: CommentService,
  ) {}

  @Get('page')
  @OptionalAuth()
  @ApiPageDoc({
    summary: '分页查询作品章节',
    model: PageWorkChapterDto,
  })
  async getWorkChapterPage(
    @Query() query: QueryWorkChapterDto,
    @CurrentUser('sub') userId?: number,
  ) {
    return this.workChapterService.getChapterPage(query, { userId })
  }

  @Get('detail')
  @OptionalAuth()
  @ApiDoc({
    summary: '查询作品章节详情',
    model: WorkChapterDetailWithUserStatusDto,
  })
  async getWorkChapterDetail(
    @Query() query: IdDto,
    @CurrentUser('sub') userId: number,
    @Req() req: FastifyRequest,
  ) {
    const requestContext = extractRequestContext(req)

    return this.workChapterService.getChapterDetail(query.id, {
      userId,
      ipAddress: requestContext.ip,
      device: serializeDeviceInfo(requestContext.deviceInfo),
    })
  }

  @Get('comment/page')
  @OptionalAuth()
  @ApiPageDoc({
    summary: '分页查询章节评论',
    model: TargetCommentItemDto,
  })
  async getWorkChapterCommentPage(
    @Query() query: QueryWorkChapterCommentPageDto,
    @CurrentUser('sub') userId?: number,
  ) {
    const target = await this.workChapterService.getChapterCommentTarget(
      query.id,
    )
    return this.commentService.getTargetComments({
      ...target,
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
      previewReplyLimit: 3,
      userId,
    })
  }

  @Get('previous/detail')
  @OptionalAuth()
  @ApiDoc({
    summary: '查询上一章节详情',
    model: WorkChapterDetailWithUserStatusDto,
  })
  async getPreviousWorkChapterDetail(
    @Query() query: IdDto,
    @CurrentUser('sub') userId: number,
    @Req() req: FastifyRequest,
  ) {
    const requestContext = extractRequestContext(req)

    return this.workChapterService.getPreviousChapterDetail(query.id, {
      userId,
      ipAddress: requestContext.ip,
      device: serializeDeviceInfo(requestContext.deviceInfo),
    })
  }

  @Get('next/detail')
  @OptionalAuth()
  @ApiDoc({
    summary: '查询下一章节详情',
    model: WorkChapterDetailWithUserStatusDto,
  })
  async getNextWorkChapterDetail(
    @Query() query: IdDto,
    @CurrentUser('sub') userId: number,
    @Req() req: FastifyRequest,
  ) {
    const requestContext = extractRequestContext(req)

    return this.workChapterService.getNextChapterDetail(query.id, {
      userId,
      ipAddress: requestContext.ip,
      device: serializeDeviceInfo(requestContext.deviceInfo),
    })
  }

  @Get('comic-content/detail')
  @OptionalAuth()
  @ApiDoc({
    summary: '查询漫画章节内容（内容可复用详情接口）',
    model: ComicChapterContentDto,
  })
  async getComicChapterContent(
    @Query() query: IdDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.comicContentService.getChapterContentsWithPermission(
      query.id,
      userId,
    )
  }

  @Get('novel-content/detail')
  @OptionalAuth()
  @ApiDoc({
    summary: '查询小说章节内容（内容可复用详情接口）',
    model: NovelChapterContentDto,
  })
  async getNovelChapterContent(
    @Query() query: IdDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.novelContentService.getChapterContentWithPermission(
      query.id,
      userId,
    )
  }
}
