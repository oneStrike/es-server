import { ForumTopicService } from '@libs/forum'
import { CommentService } from '@libs/interaction'
import {
  ApiDoc,
  ApiPageDoc,
  CurrentUser,
  OptionalAuth,
} from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  AppForumTopicDetailDto,
  AppForumTopicPageItemDto,
  CreateAppForumTopicDto,
  ForumTopicCommentItemDto,
  QueryAppForumTopicPageDto,
  QueryForumTopicCommentPageDto,
  UpdateAppForumTopicDto,
} from './dto/forum-topic.dto'

@ApiTags('论坛主题')
@Controller('app/forum/topic')
export class ForumController {
  constructor(
    private readonly forumTopicService: ForumTopicService,
    private readonly commentService: CommentService,
  ) {}

  private mapTopicItem(item: Record<string, unknown>) {
    return {
      id: item.id,
      sectionId: item.sectionId,
      userId: item.userId,
      title: item.title,
      isPinned: item.isPinned,
      isFeatured: item.isFeatured,
      isLocked: item.isLocked,
      viewCount: item.viewCount,
      replyCount: item.replyCount,
      likeCount: item.likeCount,
      favoriteCount: item.favoriteCount,
      lastReplyAt: item.lastReplyAt,
      createdAt: item.createdAt,
    }
  }

  private mapTopicDetail(topic: Record<string, any>) {
    return {
      ...this.mapTopicItem(topic),
      content: topic.content,
      section: topic.section
        ? {
            id: topic.section.id,
            name: topic.section.name,
            icon: topic.section.icon,
          }
        : null,
      user: topic.user
        ? {
            id: topic.user.id,
            nickname: topic.user.nickname,
            avatarUrl: topic.user.avatarUrl,
          }
        : null,
    }
  }

  @Get('page')
  @OptionalAuth()
  @ApiPageDoc({
    summary: '分页查询公开论坛主题',
    model: AppForumTopicPageItemDto,
  })
  async getPage(
    @Query() query: QueryAppForumTopicPageDto,
    @CurrentUser('sub') userId?: number,
  ) {
    const page = await this.forumTopicService.getPublicTopics({
      ...query,
      userId,
    })
    return {
      ...page,
      list: page.list.map((item) => this.mapTopicItem(item as Record<string, unknown>)),
    }
  }

  @Get('detail')
  @OptionalAuth()
  @ApiDoc({
    summary: '获取公开论坛主题详情',
    model: AppForumTopicDetailDto,
  })
  async getDetail(@Query() query: IdDto, @CurrentUser('sub') userId?: number) {
    return this.mapTopicDetail(
      await this.forumTopicService.getPublicTopicById(query.id, userId) as Record<string, any>,
    )
  }

  @Get('comment/page')
  @OptionalAuth()
  @ApiPageDoc({
    summary: '分页查询论坛主题评论',
    model: ForumTopicCommentItemDto,
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
      previewReplyLimit: 3,
    })
  }

  @Post('create')
  @ApiDoc({
    summary: '创建论坛主题',
    model: IdDto,
  })
  async create(
    @Body() body: CreateAppForumTopicDto,
    @CurrentUser('sub') userId: number,
  ) {
    const topic = await this.forumTopicService.createForumTopic({
      ...body,
      userId,
    })
    return { id: topic.id }
  }

  @Post('update')
  @ApiDoc({
    summary: '更新我的论坛主题',
    model: IdDto,
  })
  async update(
    @Body() body: UpdateAppForumTopicDto,
    @CurrentUser('sub') userId: number,
  ) {
    const topic = await this.forumTopicService.updateUserTopic(userId, body)
    return { id: topic.id }
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除我的论坛主题',
    model: IdDto,
  })
  async delete(@Body() body: IdDto, @CurrentUser('sub') userId: number) {
    const topic = await this.forumTopicService.deleteUserTopic(userId, body.id)
    return { id: topic.id }
  }
}
