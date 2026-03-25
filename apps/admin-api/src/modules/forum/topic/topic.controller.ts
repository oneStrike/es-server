import {
  BaseForumTopicDto,
  ForumTopicService,
} from '@libs/forum/topic'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  AdminForumTopicDetailDto,
  CreateForumTopicDto,
  QueryForumTopicDto,
  UpdateForumTopicAuditStatusDto,
  UpdateForumTopicDto,
  UpdateForumTopicFeaturedDto,
  UpdateForumTopicHiddenDto,
  UpdateForumTopicLockedDto,
  UpdateForumTopicPinnedDto,
} from './dto/forum-topic.dto'

@ApiTags('论坛管理/主题管理')
@Controller('admin/forum/topic')
export class ForumTopicController {
  constructor(private readonly forumTopicService: ForumTopicService) {}

  private mapTopicDetail(topic: Record<string, any>) {
    return {
      id: topic.id,
      sectionId: topic.sectionId,
      userId: topic.userId,
      title: topic.title,
      content: topic.content,
      images: topic.images ?? [],
      videos: topic.videos ?? [],
      isPinned: topic.isPinned,
      isFeatured: topic.isFeatured,
      isLocked: topic.isLocked,
      isHidden: topic.isHidden,
      auditStatus: topic.auditStatus,
      auditReason: topic.auditReason,
      auditAt: topic.auditAt,
      viewCount: topic.viewCount,
      likeCount: topic.likeCount,
      commentCount: topic.commentCount,
      favoriteCount: topic.favoriteCount,
      version: topic.version,
      sensitiveWordHits: topic.sensitiveWordHits,
      lastCommentAt: topic.lastCommentAt,
      lastCommentUserId: topic.lastCommentUserId,
      createdAt: topic.createdAt,
      updatedAt: topic.updatedAt,
      topicTags: (topic.topicTags ?? []).map(
        (item: Record<string, unknown>) => ({
          id: item.id,
          topicId: item.topicId,
          tagId: item.tagId,
          createdAt: item.createdAt,
        }),
      ),
      section: topic.section
        ? {
            id: topic.section.id,
            name: topic.section.name,
            description: topic.section.description,
            icon: topic.section.icon,
            isEnabled: topic.section.isEnabled,
            topicReviewPolicy: topic.section.topicReviewPolicy,
          }
        : null,
      user: topic.user
        ? {
            id: topic.user.id,
            nickname: topic.user.nickname,
            avatarUrl: topic.user.avatarUrl,
            signature: topic.user.signature,
            bio: topic.user.bio,
            isEnabled: topic.user.isEnabled,
            points: topic.user.points,
            levelId: topic.user.levelId,
            status: topic.user.status,
            banReason: topic.user.banReason,
            banUntil: topic.user.banUntil,
            counts: topic.user.counts
              ? {
                  commentCount: topic.user.counts.commentCount,
                  likeCount: topic.user.counts.likeCount,
                  favoriteCount: topic.user.counts.favoriteCount,
                  forumTopicCount: topic.user.counts.forumTopicCount,
                  commentReceivedLikeCount:
                    topic.user.counts.commentReceivedLikeCount,
                  forumTopicReceivedLikeCount:
                    topic.user.counts.forumTopicReceivedLikeCount,
                  forumTopicReceivedFavoriteCount:
                    topic.user.counts.forumTopicReceivedFavoriteCount,
                }
              : null,
            level: topic.user.level
              ? {
                  id: topic.user.level.id,
                  name: topic.user.level.name,
                  icon: topic.user.level.icon,
                  sortOrder: topic.user.level.sortOrder,
                }
              : null,
          }
        : null,
    }
  }

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询论坛主题列表',
    model: BaseForumTopicDto,
  })
  async getPage(@Query() query: QueryForumTopicDto) {
    return this.forumTopicService.getTopics(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取论坛主题详情',
    model: AdminForumTopicDetailDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.mapTopicDetail(
      (await this.forumTopicService.getTopicById(query.id)) as Record<
        string,
        any
      >,
    )
  }

  @Post('create')
  @ApiDoc({
    summary: '创建论坛主题',
    model: Boolean,
  })
  async create(@Body() body: CreateForumTopicDto) {
    return this.forumTopicService.createForumTopic(body)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新论坛主题',
    model: Boolean,
  })
  async update(@Body() body: UpdateForumTopicDto) {
    return this.forumTopicService.updateTopic(body)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除论坛主题',
    model: Boolean,
  })
  async delete(@Body() body: IdDto) {
    return this.forumTopicService.deleteTopic(body.id)
  }

  @Post('update-pinned')
  @ApiDoc({
    summary: '更新主题置顶状态',
    model: Boolean,
  })
  async updatePinned(@Body() body: UpdateForumTopicPinnedDto) {
    return this.forumTopicService.updateTopicPinned(body)
  }

  @Post('update-featured')
  @ApiDoc({
    summary: '更新主题精华状态',
    model: Boolean,
  })
  async updateFeatured(@Body() body: UpdateForumTopicFeaturedDto) {
    return this.forumTopicService.updateTopicFeatured(body)
  }

  @Post('update-locked')
  @ApiDoc({
    summary: '更新主题锁定状态',
    model: Boolean,
  })
  async updateLocked(@Body() body: UpdateForumTopicLockedDto) {
    return this.forumTopicService.updateTopicLocked(body)
  }

  @Post('update-hidden')
  @ApiDoc({
    summary: '更新主题隐藏状态',
    model: Boolean,
  })
  async updateHidden(@Body() body: UpdateForumTopicHiddenDto) {
    return this.forumTopicService.updateTopicHidden(body)
  }

  @Post('update-audit-status')
  @ApiDoc({
    summary: '更新主题审核状态',
    model: Boolean,
  })
  async updateAuditStatus(@Body() body: UpdateForumTopicAuditStatusDto) {
    return this.forumTopicService.updateTopicAuditStatus(body)
  }
}
