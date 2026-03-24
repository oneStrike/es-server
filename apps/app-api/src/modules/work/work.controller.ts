import { WorkService } from '@libs/content/work'
import { CommentService } from '@libs/interaction/comment'
import {
  ApiDoc,
  ApiPageDoc,
  CurrentUser,
  OptionalAuth,
  Public,
  RequestMeta,
  RequestMetaResult,
} from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { TargetCommentItemDto } from '../comment/dto/comment.dto'
import {
  PageWorkDto,
  QueryWorkCommentPageDto,
  QueryWorkDto,
  QueryWorkTypeDto,
  WorkDetailDto,
  WorkForumSectionDto,
} from './dto/work.dto'

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
  async getWorkPage(
    @Query() query: QueryWorkDto,
  ) {
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
    @RequestMeta() meta: RequestMetaResult,
  ) {
    return this.workService.getWorkDetail(query.id, {
      userId,
      ipAddress: meta.ip,
      device: meta.deviceId,
    })
  }

  @Get('forum-section/detail')
  @OptionalAuth()
  @ApiDoc({
    summary: '查询作品关联板块详情',
    model: WorkForumSectionDto,
  })
  async getWorkForumSection(
    @Query() query: IdDto,
    @CurrentUser('sub') userId?: number,
  ) {
    return this.workService.getWorkForumSection(query.id, userId)
  }

  @Get('comment/page')
  @Public()
  @ApiPageDoc({
    summary: '分页查询作品评论',
    model: TargetCommentItemDto,
  })
  async getWorkCommentPage(@Query() query: QueryWorkCommentPageDto) {
    const target = await this.workService.getWorkCommentTarget(query.id)
    return this.commentService.getTargetComments({
      ...target,
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
      previewReplyLimit: 3,
    })
  }
}
