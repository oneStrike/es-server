import {
  BaseForumTopicDto,
  CreateForumTopicDto,
  ForumTopicService,
  QueryForumTopicDto,
  UpdateForumTopicAuditStatusDto,
  UpdateForumTopicDto,
  UpdateForumTopicFeaturedDto,
  UpdateForumTopicHiddenDto,
  UpdateForumTopicLockedDto,
  UpdateForumTopicPinnedDto,
} from '@libs/forum'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminForumTopicDetailDto } from './dto/forum-topic.dto'

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
      isPinned: topic.isPinned,
      isFeatured: topic.isFeatured,
      isLocked: topic.isLocked,
      isHidden: topic.isHidden,
      auditStatus: topic.auditStatus,
      auditReason: topic.auditReason,
      viewCount: topic.viewCount,
      replyCount: topic.replyCount,
      likeCount: topic.likeCount,
      favoriteCount: topic.favoriteCount,
      lastReplyAt: topic.lastReplyAt,
      lastReplyUserId: topic.lastReplyUserId,
      createdAt: topic.createdAt,
      updatedAt: topic.updatedAt,
      topicTags: (topic.topicTags ?? []).map((item: Record<string, unknown>) => ({
        id: item.id,
        topicId: item.topicId,
        tagId: item.tagId,
        createdAt: item.createdAt,
      })),
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
            isEnabled: topic.user.isEnabled,
            status: topic.user.status,
            forumProfile: topic.user.forumProfile
              ? {
                  id: topic.user.forumProfile.id,
                  userId: topic.user.forumProfile.userId,
                  points: topic.user.forumProfile.points,
                  levelId: topic.user.forumProfile.levelId,
                  signature: topic.user.forumProfile.signature,
                  bio: topic.user.forumProfile.bio,
                  status: topic.user.forumProfile.status,
                  topicCount: topic.user.forumProfile.topicCount,
                  replyCount: topic.user.forumProfile.replyCount,
                  likeCount: topic.user.forumProfile.likeCount,
                  favoriteCount: topic.user.forumProfile.favoriteCount,
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
      await this.forumTopicService.getTopicById(query.id) as Record<string, any>,
    )
  }

  @Post('create')
  @ApiDoc({
    summary: '创建论坛主题',
    model: BaseForumTopicDto,
  })
  async create(@Body() body: CreateForumTopicDto) {
    return this.forumTopicService.createForumTopic(body)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新论坛主题',
    model: BaseForumTopicDto,
  })
  async update(@Body() body: UpdateForumTopicDto) {
    return this.forumTopicService.updateTopic(body)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除论坛主题',
    model: BaseForumTopicDto,
  })
  async delete(@Body() body: IdDto) {
    return this.forumTopicService.deleteTopic(body.id)
  }

  @Post('update-pinned')
  @ApiDoc({
    summary: '更新主题置顶状态',
    model: BaseForumTopicDto,
  })
  async updatePinned(@Body() body: UpdateForumTopicPinnedDto) {
    return this.forumTopicService.updateTopicPinned(body)
  }

  @Post('update-featured')
  @ApiDoc({
    summary: '更新主题精华状态',
    model: BaseForumTopicDto,
  })
  async updateFeatured(@Body() body: UpdateForumTopicFeaturedDto) {
    return this.forumTopicService.updateTopicFeatured(body)
  }

  @Post('update-locked')
  @ApiDoc({
    summary: '更新主题锁定状态',
    model: BaseForumTopicDto,
  })
  async updateLocked(@Body() body: UpdateForumTopicLockedDto) {
    return this.forumTopicService.updateTopicLocked(body)
  }

  @Post('update-hidden')
  @ApiDoc({
    summary: '更新主题隐藏状态',
    model: BaseForumTopicDto,
  })
  async updateHidden(@Body() body: UpdateForumTopicHiddenDto) {
    return this.forumTopicService.updateTopicHidden(body)
  }

  @Post('update-audit-status')
  @ApiDoc({
    summary: '更新主题审核状态',
    model: BaseForumTopicDto,
  })
  async updateAuditStatus(@Body() body: UpdateForumTopicAuditStatusDto) {
    return this.forumTopicService.updateTopicAuditStatus(body)
  }

  @Post('increment-view-count')
  @ApiDoc({
    summary: '增加主题浏览次数',
    model: BaseForumTopicDto,
  })
  async incrementViewCount(@Body() body: IdDto) {
    return this.forumTopicService.incrementViewCount(body.id)
  }
}
