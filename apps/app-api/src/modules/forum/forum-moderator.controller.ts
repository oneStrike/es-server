import { ForumModeratorGovernanceService } from '@libs/forum/moderator/moderator-governance.service'
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
import { ApiDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('论坛/版主治理')
@Controller('app/forum/moderator')
export class ForumModeratorController {
  constructor(
    private readonly forumModeratorGovernanceService: ForumModeratorGovernanceService,
  ) {}

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
  async deleteTopic(
    @Body() body: IdDto,
    @CurrentUser('sub') userId: number,
  ) {
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
  async deleteComment(
    @Body() body: IdDto,
    @CurrentUser('sub') userId: number,
  ) {
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
