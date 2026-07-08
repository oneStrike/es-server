import {
  BaseForumModeratorActionLogDto,
  QueryAppForumModeratorActionLogDto,
} from '@libs/forum/moderator/dto/moderator-action-log.dto'
import { AppForumModeratorProfileDto } from '@libs/forum/moderator/dto/moderator.dto'
import { ForumModeratorActionLogService } from '@libs/forum/moderator/moderator-action-log.service'
import { ForumModeratorGovernanceService } from '@libs/forum/moderator/moderator-governance.service'
import { ForumModeratorService } from '@libs/forum/moderator/moderator.service'
import {
  MoveForumTopicDto,
  UpdateForumTopicAuditStatusDto,
  UpdateForumTopicFeaturedDto,
  UpdateForumTopicHiddenDto,
  UpdateForumTopicLockedDto,
  UpdateForumTopicPinnedDto,
} from '@libs/forum/topic/dto/forum-topic.dto'
import {
  UpdateCommentAuditStatusDto,
  UpdateCommentHiddenDto,
} from '@libs/interaction/comment/dto/comment.dto'
import { BusinessErrorCode } from '@libs/platform/constant'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { BusinessException } from '@libs/platform/exceptions'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('论坛/版主治理')
@Controller('app/forum/moderator')
export class ForumModeratorController {
  constructor(
    private readonly forumModeratorService: ForumModeratorService,
    private readonly forumModeratorGovernanceService: ForumModeratorGovernanceService,
    private readonly forumModeratorActionLogService: ForumModeratorActionLogService,
  ) {}

  @Get('me')
  @ApiDoc({
    summary: '查询当前用户版主身份与可治理范围',
    model: AppForumModeratorProfileDto,
  })
  async getMe(@CurrentUser('sub') userId: number) {
    return this.forumModeratorService.getAppModeratorProfileByUserId(userId)
  }

  @Get('action-log/my/page')
  @ApiPageDoc({
    summary: '分页查询我的版主操作日志',
    model: BaseForumModeratorActionLogDto,
  })
  async getMyActionLogPage(
    @Query() query: QueryAppForumModeratorActionLogDto,
    @CurrentUser('sub') userId: number,
  ) {
    const profile =
      await this.forumModeratorService.getAppModeratorProfileByUserId(userId)

    if (!profile.isUsable || !profile.moderatorId) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '当前用户不是可用版主',
      )
    }

    return this.forumModeratorActionLogService.getAppActionLogPage(
      profile.moderatorId,
      query,
    )
  }

  @Post('topic/update-pinned')
  @ApiDoc({
    summary: '版主更新主题置顶状态',
    model: Boolean,
  })
  async updateTopicPinned(
    @Body() body: UpdateForumTopicPinnedDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumModeratorGovernanceService.updateTopicPinned(body, {
      actorType: 'moderator',
      actorUserId: userId,
    })
  }

  @Post('topic/update-featured')
  @ApiDoc({
    summary: '版主更新主题精华状态',
    model: Boolean,
  })
  async updateTopicFeatured(
    @Body() body: UpdateForumTopicFeaturedDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumModeratorGovernanceService.updateTopicFeatured(body, {
      actorType: 'moderator',
      actorUserId: userId,
    })
  }

  @Post('topic/update-locked')
  @ApiDoc({
    summary: '版主更新主题锁定状态',
    model: Boolean,
  })
  async updateTopicLocked(
    @Body() body: UpdateForumTopicLockedDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumModeratorGovernanceService.updateTopicLocked(body, {
      actorType: 'moderator',
      actorUserId: userId,
    })
  }

  @Post('topic/delete')
  @ApiDoc({
    summary: '版主删除主题',
    model: Boolean,
  })
  async deleteTopic(@Body() body: IdDto, @CurrentUser('sub') userId: number) {
    return this.forumModeratorGovernanceService.deleteTopic(body, {
      actorType: 'moderator',
      actorUserId: userId,
    })
  }

  @Post('topic/move')
  @ApiDoc({
    summary: '版主移动主题板块',
    model: Boolean,
  })
  async moveTopic(
    @Body() body: MoveForumTopicDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumModeratorGovernanceService.moveTopic(body, {
      actorType: 'moderator',
      actorUserId: userId,
    })
  }

  @Post('topic/update-hidden')
  @ApiDoc({
    summary: '版主更新主题隐藏状态',
    model: Boolean,
  })
  async updateTopicHidden(
    @Body() body: UpdateForumTopicHiddenDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumModeratorGovernanceService.updateTopicHidden(body, {
      actorType: 'moderator',
      actorUserId: userId,
    })
  }

  @Post('topic/update-audit-status')
  @ApiDoc({
    summary: '版主更新主题审核状态',
    model: Boolean,
  })
  async updateTopicAuditStatus(
    @Body() body: UpdateForumTopicAuditStatusDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumModeratorGovernanceService.updateTopicAuditStatus(body, {
      actorType: 'moderator',
      actorUserId: userId,
    })
  }

  @Post('comment/update-hidden')
  @ApiDoc({
    summary: '版主更新评论隐藏状态',
    model: Boolean,
  })
  async updateCommentHidden(
    @Body() body: UpdateCommentHiddenDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumModeratorGovernanceService.updateCommentHidden(body, {
      actorType: 'moderator',
      actorUserId: userId,
    })
  }

  @Post('comment/delete')
  @ApiDoc({
    summary: '版主删除评论',
    model: Boolean,
  })
  async deleteComment(@Body() body: IdDto, @CurrentUser('sub') userId: number) {
    return this.forumModeratorGovernanceService.deleteComment(body, {
      actorType: 'moderator',
      actorUserId: userId,
    })
  }

  @Post('comment/update-audit-status')
  @ApiDoc({
    summary: '版主更新评论审核状态',
    model: Boolean,
  })
  async updateCommentAuditStatus(
    @Body() body: UpdateCommentAuditStatusDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumModeratorGovernanceService.updateCommentAuditStatus(body, {
      actorType: 'moderator',
      actorUserId: userId,
    })
  }
}
