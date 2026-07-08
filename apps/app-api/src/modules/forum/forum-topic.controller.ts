import type { ForumTopicClientContext } from '@libs/forum/topic/forum-topic.type'
import type { FastifyRequest } from 'fastify'
import { UserProfileService } from '@libs/forum/profile/profile.service'
import {
  CreateUserForumTopicDto,
  MyForumTopicItemDto,
  PublicForumTopicDetailDto,
  PublicForumTopicPageItemDto,
  QueryForumTopicCommentPageDto,
  QueryMyForumTopicDto,
  QueryPublicForumTopicDto,
  QueryPublicUserForumTopicDto,
  UpdateForumTopicDto,
} from '@libs/forum/topic/dto/forum-topic.dto'
import { ForumTopicService } from '@libs/forum/topic/forum-topic.service'
import { CommentService } from '@libs/interaction/comment/comment.service'
import { TargetCommentItemDto } from '@libs/interaction/comment/dto/comment.dto'
import {
  ApiDoc,
  ApiPageDoc,
  CurrentUser,
  OptionalAuth,
} from '@libs/platform/decorators'

import { IdDto } from '@libs/platform/dto'
import { GeoService } from '@libs/platform/modules/geo/geo.service'
import {
  extractRequestContext,
  serializeDeviceInfo,
} from '@libs/platform/utils'
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
} from '@nestjs/common'
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

  // 提取用户主题写操作需要记录的客户端来源信息。
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

  // 公开分页查询综合或板块主题。
  @Get('page')
  @OptionalAuth()
  @ApiPageDoc({
    summary: '分页查询论坛主题（综合/板块）',
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

  // 公开分页查询热门主题。
  @Get('hot/page')
  @OptionalAuth()
  @ApiPageDoc({
    summary: '分页查询热门论坛主题',
    model: PublicForumTopicPageItemDto,
  })
  async getHotPage(
    @Query() query: QueryPublicForumTopicDto,
    @CurrentUser('sub') userId?: number,
  ) {
    return this.forumTopicService.getHotPublicTopics({
      ...query,
      userId,
    })
  }

  // 查询当前用户关注范围内的主题分页。
  @Get('following/page')
  @ApiPageDoc({
    summary: '分页查询关注论坛主题',
    model: PublicForumTopicPageItemDto,
  })
  async getFollowingPage(
    @Query() query: QueryPublicForumTopicDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumTopicService.getFollowingPublicTopics({
      ...query,
      userId,
    })
  }

  // 查看公开主题详情并补记浏览上下文。
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

  // 查询主题评论分页并复用评论域排序与可见性规则。
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
    const { id, ...commentQuery } = query
    const target = await this.forumTopicService.getTopicCommentTarget(
      id,
      userId,
    )
    return this.commentService.getTargetComments({
      ...commentQuery,
      ...target,
      userId,
    })
  }

  // 查询指定用户公开可见的主题分页。
  @Get('user/page')
  @OptionalAuth()
  @ApiPageDoc({
    summary: '分页查询指定用户的公开主题',
    model: PublicForumTopicPageItemDto,
  })
  async getPublicUserTopicPage(
    @Query() query: QueryPublicUserForumTopicDto,
    @CurrentUser('sub') userId?: number,
  ) {
    return this.userProfileService.getPublicUserTopics(
      query.userId,
      userId,
      query,
    )
  }

  // 查询当前登录用户自己的主题分页。
  @Get('my/page')
  @ApiPageDoc({
    summary: '分页查询我的论坛主题',
    model: MyForumTopicItemDto,
  })
  async getMyTopicPage(
    @Query() query: QueryMyForumTopicDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.userProfileService.getMyTopics(userId, query)
  }

  // 创建当前用户主题并记录客户端来源。
  @Post('create')
  @ApiDoc({
    summary: '创建论坛主题',
    model: IdDto,
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

  // 更新当前用户自己的主题内容。
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

  // 删除当前用户自己的主题并同步相关可见性。
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
