import type { ForumTopicClientContext } from '@libs/forum/topic/forum-topic.type'
import type { FastifyRequest } from 'fastify'
import { UserProfileService } from '@libs/forum/profile/profile.service'
import {
  CreateUserForumTopicDto,
  MyForumTopicItemDto,
  PublicForumTopicDetailDto,
  PublicForumTopicPageItemDto,
  QueryForumTopicCommentPageDto,
  QueryPublicForumTopicDto,
  QueryUserForumTopicDto,
  UpdateForumTopicDto,
} from '@libs/forum/topic/dto/forum-topic.dto'
import { ForumTopicService } from '@libs/forum/topic/forum-topic.service'
import { CommentService } from '@libs/interaction/comment/comment.service'
import { TargetCommentItemDto } from '@libs/interaction/comment/dto/comment.dto'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator'
import { CurrentUser } from '@libs/platform/decorators/current-user.decorator'
import { OptionalAuth } from '@libs/platform/decorators/public.decorator'
import { IdDto } from '@libs/platform/dto/base.dto'
import { GeoService } from '@libs/platform/modules/geo'
import {
  extractRequestContext,
  serializeDeviceInfo,
} from '@libs/platform/utils'
import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('论坛/主题')
@Controller('app/forum/topic')
export class ForumTopicController {
  constructor(
    private readonly forumTopicService: ForumTopicService,
    private readonly userProfileService: UserProfileService,
    private readonly commentService: CommentService,
    private readonly geoService: GeoService,
  ) {}

  private async buildTopicClientContext(
    req: FastifyRequest,
  ): Promise<ForumTopicClientContext> {
    const clientContext = await this.geoService.buildClientRequestContext(req)

    return {
      ipAddress: clientContext.ip,
      userAgent: clientContext.userAgent,
      geoCountry: clientContext.geoCountry,
      geoProvince: clientContext.geoProvince,
      geoCity: clientContext.geoCity,
      geoIsp: clientContext.geoIsp,
      geoSource: clientContext.geoSource,
    }
  }

  @Get('page')
  @OptionalAuth()
  @ApiPageDoc({
    summary: '分页查询论坛主题',
    model: PublicForumTopicPageItemDto,
  })
  async getPage(
    @Query() query: QueryPublicForumTopicDto,
    @CurrentUser('sub') userId?: number,
  ) {
    return this.forumTopicService.getPublicTopics({
      ...query,
      userId,
    })
  }

  @Get('detail')
  @OptionalAuth()
  @ApiDoc({
    summary: '获取论坛主题详情',
    model: PublicForumTopicDetailDto,
  })
  async getDetail(
    @Query() query: IdDto,
    @Req() req: FastifyRequest,
    @CurrentUser('sub') userId?: number,
  ) {
    const requestContext = extractRequestContext(req)

    return this.forumTopicService.getPublicTopicById(query.id, {
      userId,
      ipAddress: requestContext.ip,
      device: serializeDeviceInfo(requestContext.deviceInfo),
    })
  }

  @Get('comment/page')
  @OptionalAuth()
  @ApiPageDoc({
    summary: '分页查询论坛主题评论',
    model: TargetCommentItemDto,
  })
  async getTopicCommentPage(
    @Query() query: QueryForumTopicCommentPageDto,
    @CurrentUser('sub') userId?: number,
  ) {
    const target = await this.forumTopicService.getTopicCommentTarget(
      query.id,
      userId,
    )
    return this.commentService.getTargetComments({
      ...target,
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
      userId,
    })
  }

  @Get('my/page')
  @ApiPageDoc({
    summary: '分页查询用户发布的主题',
    model: MyForumTopicItemDto,
  })
  async getMyTopicPage(
    @Query() query: QueryUserForumTopicDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.userProfileService.getMyTopics(query.userId || userId, query)
  }

  @Post('create')
  @ApiDoc({
    summary: '创建论坛主题',
    model: Boolean,
  })
  async create(
    @Body() body: CreateUserForumTopicDto,
    @CurrentUser('sub') userId: number,
    @Req() req: FastifyRequest,
  ) {
    return this.forumTopicService.createForumTopic(
      {
        ...body,
        userId,
      },
      await this.buildTopicClientContext(req),
    )
  }

  @Post('update')
  @ApiDoc({
    summary: '更新我的论坛主题',
    model: Boolean,
  })
  async update(
    @Body() body: UpdateForumTopicDto,
    @CurrentUser('sub') userId: number,
    @Req() req: FastifyRequest,
  ) {
    return this.forumTopicService.updateUserTopic(
      userId,
      body,
      await this.buildTopicClientContext(req),
    )
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除我的论坛主题',
    model: Boolean,
  })
  async delete(
    @Body() body: IdDto,
    @CurrentUser('sub') userId: number,
    @Req() req: FastifyRequest,
  ) {
    return this.forumTopicService.deleteUserTopic(
      userId,
      body.id,
      await this.buildTopicClientContext(req),
    )
  }
}
