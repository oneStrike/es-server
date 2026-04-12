import type { FastifyRequest } from 'fastify'
import { PageWorkDto, QueryWorkCommentPageDto, QueryWorkDto, QueryWorkTypeDto, WorkDetailDto } from '@libs/content/work/core/dto/work.dto';
import { WorkService } from '@libs/content/work/core/work.service';
import { CommentService } from '@libs/interaction/comment/comment.service';
import { TargetCommentItemDto } from '@libs/interaction/comment/dto/comment.dto';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { CurrentUser } from '@libs/platform/decorators/current-user.decorator';
import { OptionalAuth } from '@libs/platform/decorators/public.decorator';
import { IdDto } from '@libs/platform/dto/base.dto';
import { extractRequestContext, serializeDeviceInfo } from '@libs/platform/utils';
import { Controller, Get, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('作品')
@Controller('app/work')
export class WorkController {
  constructor(
    private readonly workService: WorkService,
    private readonly commentService: CommentService,
  ) {}

  @Get('hot/page')
  @OptionalAuth()
  @ApiPageDoc({
    summary: '分页查询热门作品',
    model: PageWorkDto,
  })
  async getAvailable(@Query() query: QueryWorkTypeDto) {
    return this.workService.getWorkTypePage({ ...query, isHot: true })
  }

  @Get('new/page')
  @OptionalAuth()
  @ApiPageDoc({
    summary: '分页查询最新作品',
    model: PageWorkDto,
  })
  async getNewWorkPage(@Query() query: QueryWorkTypeDto) {
    return this.workService.getWorkTypePage({ ...query, isNew: true })
  }

  @Get('recommended/page')
  @OptionalAuth()
  @ApiPageDoc({
    summary: '分页查询推荐作品',
    model: PageWorkDto,
  })
  async getRecommendedWorkPage(@Query() query: QueryWorkTypeDto) {
    return this.workService.getWorkTypePage({ ...query, isRecommended: true })
  }

  @Get('page')
  @OptionalAuth()
  @ApiPageDoc({
    summary: '分页查询作品列表',
    model: PageWorkDto,
  })
  async getWorkPage(@Query() query: QueryWorkDto) {
    return this.workService.getWorkTypePage({ ...query, isPublished: true })
  }

  @Get('detail')
  @OptionalAuth()
  @ApiDoc({
    summary: '查询作品详情',
    model: WorkDetailDto,
  })
  async getWorkDetail(
    @Query() query: IdDto,
    @CurrentUser('sub') userId: number,
    @Req() req: FastifyRequest,
  ) {
    const requestContext = extractRequestContext(req)

    return this.workService.getWorkDetail(query.id, {
      userId,
      ipAddress: requestContext.ip,
      device: serializeDeviceInfo(requestContext.deviceInfo),
      userAgent: requestContext.userAgent,
    })
  }

  @Get('comment/page')
  @OptionalAuth()
  @ApiPageDoc({
    summary: '分页查询作品评论',
    model: TargetCommentItemDto,
  })
  async getWorkCommentPage(
    @Query() query: QueryWorkCommentPageDto,
    @CurrentUser('sub') userId?: number,
  ) {
    const target = await this.workService.getWorkCommentTarget(query.id)
    return this.commentService.getTargetComments({
      ...target,
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
      sort: query.sort,
      previewReplyLimit: 3,
      userId,
    })
  }
}
