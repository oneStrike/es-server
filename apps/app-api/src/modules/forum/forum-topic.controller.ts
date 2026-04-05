import { UserProfileService } from '@libs/forum/profile'
import {
  CreateUserForumTopicDto,
  ForumTopicService,
  QueryForumTopicCommentPageDto,
  QueryMyForumTopicDto,
  QueryPublicForumTopicDto,
  UpdateForumTopicDto,
} from '@libs/forum/topic'
import { CommentService } from '@libs/interaction/comment'
import {
  ApiDoc,
  ApiPageDoc,
  CurrentUser,
  OptionalAuth,
  RequestMeta,
  RequestMetaResult,
} from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { TargetCommentItemDto } from '../comment/dto/comment.dto'
import {
  AppForumTopicDetailDto,
  AppForumTopicPageItemDto,
  MyForumTopicItemDto,
} from './dto/forum-topic.dto'

@ApiTags('论坛/主题')
@Controller('app/forum/topic')
export class ForumTopicController {
  constructor(
    private readonly forumTopicService: ForumTopicService,
    private readonly userProfileService: UserProfileService,
    private readonly commentService: CommentService,
  ) { }

  @Get('page')
  @OptionalAuth()
  @ApiPageDoc({
    summary: '分页查询论坛主题',
    model: AppForumTopicPageItemDto,
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
    model: AppForumTopicDetailDto,
  })
  async getDetail(
    @Query() query: IdDto,
    @CurrentUser('sub') userId?: number,
    @RequestMeta() meta?: RequestMetaResult,
  ) {
    return this.forumTopicService.getPublicTopicById(query.id, {
      userId,
      ipAddress: meta?.ip,
      device: meta?.deviceId,
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
    summary: '分页查询我发布的主题',
    model: MyForumTopicItemDto,
  })
  async getMyTopicPage(
    @Query() query: QueryMyForumTopicDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.userProfileService.getMyTopics(userId, query)
  }

  @Post('create')
  @ApiDoc({
    summary: '创建论坛主题',
    model: Boolean,
  })
  async create(
    @Body() body: CreateUserForumTopicDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumTopicService.createForumTopic({
      ...body,
      userId,
    })
  }

  @Post('update')
  @ApiDoc({
    summary: '更新我的论坛主题',
    model: Boolean,
  })
  async update(
    @Body() body: UpdateForumTopicDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumTopicService.updateUserTopic(userId, body)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除我的论坛主题',
    model: Boolean,
  })
  async delete(@Body() body: IdDto, @CurrentUser('sub') userId: number) {
    return this.forumTopicService.deleteUserTopic(userId, body.id)
  }
}
