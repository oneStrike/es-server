import type { ForumTopicClientContext } from '@libs/forum/topic/forum-topic.type'
import type { FastifyRequest } from 'fastify'
import { ForumModeratorGovernanceService } from '@libs/forum/moderator/moderator-governance.service'
import {
  AdminForumTopicDetailDto,
  AdminForumTopicPageItemDto,
  CreateForumTopicDto,
  MoveForumTopicDto,
  QueryForumTopicDto,
  RestoreForumTopicDto,
  UpdateForumTopicAuditStatusDto,
  UpdateForumTopicDto,
  UpdateForumTopicFeaturedDto,
  UpdateForumTopicHiddenDto,
  UpdateForumTopicLockedDto,
  UpdateForumTopicPinnedDto,
} from '@libs/forum/topic/dto/forum-topic.dto'
import { ForumTopicService } from '@libs/forum/topic/forum-topic.service'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'

import { IdDto } from '@libs/platform/dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { GeoService } from '@libs/platform/modules/geo/geo.service'
import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

@ApiTags('论坛管理/主题管理')
@Controller('admin/forum/topic')
export class ForumTopicController {
  constructor(
    private readonly forumModeratorGovernanceService: ForumModeratorGovernanceService,
    private readonly forumTopicService: ForumTopicService,
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
  @ApiPageDoc({
    summary: '分页查询论坛主题列表',
    model: AdminForumTopicPageItemDto,
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
    return this.forumTopicService.getTopicById(query.id)
  }

  @Post('create')
  @ApiAuditDoc({
    summary: '创建论坛主题',
    model: IdDto,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async create(@Body() body: CreateForumTopicDto, @Req() req: FastifyRequest) {
    return this.forumTopicService.createForumTopic(
      body,
      await this.buildTopicClientContext(req),
    )
  }

  @Post('update')
  @ApiAuditDoc({
    summary: '更新论坛主题',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async update(
    @Body() body: UpdateForumTopicDto,
    @Req() req: FastifyRequest,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumModeratorGovernanceService.updateTopicContent(
      body,
      {
        actorType: 'admin',
        actorUserId: userId,
      },
      await this.buildTopicClientContext(req),
    )
  }

  @Post('delete')
  @ApiAuditDoc({
    summary: '删除论坛主题',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async delete(
    @Body() body: IdDto,
    @Req() req: FastifyRequest,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumModeratorGovernanceService.deleteTopic(
      body,
      {
        actorType: 'admin',
        actorUserId: userId,
      },
      await this.buildTopicClientContext(req),
    )
  }

  @Post('restore')
  @ApiAuditDoc({
    summary: '恢复已删除论坛主题',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async restore(
    @Body() body: RestoreForumTopicDto,
    @Req() req: FastifyRequest,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumModeratorGovernanceService.restoreTopic(
      body,
      {
        actorType: 'admin',
        actorUserId: userId,
      },
      await this.buildTopicClientContext(req),
    )
  }

  @Post('move')
  @ApiAuditDoc({
    summary: '移动论坛主题板块',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async move(
    @Body() body: MoveForumTopicDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumModeratorGovernanceService.moveTopic(body, {
      actorType: 'admin',
      actorUserId: userId,
    })
  }

  @Post('update-pinned')
  @ApiAuditDoc({
    summary: '更新主题置顶状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updatePinned(
    @Body() body: UpdateForumTopicPinnedDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumModeratorGovernanceService.updateTopicPinned(body, {
      actorType: 'admin',
      actorUserId: userId,
    })
  }

  @Post('update-featured')
  @ApiAuditDoc({
    summary: '更新主题精华状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateFeatured(
    @Body() body: UpdateForumTopicFeaturedDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumModeratorGovernanceService.updateTopicFeatured(body, {
      actorType: 'admin',
      actorUserId: userId,
    })
  }

  @Post('update-locked')
  @ApiAuditDoc({
    summary: '更新主题锁定状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateLocked(
    @Body() body: UpdateForumTopicLockedDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumModeratorGovernanceService.updateTopicLocked(body, {
      actorType: 'admin',
      actorUserId: userId,
    })
  }

  @Post('update-hidden')
  @ApiAuditDoc({
    summary: '更新主题隐藏状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateHidden(
    @Body() body: UpdateForumTopicHiddenDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumModeratorGovernanceService.updateTopicHidden(body, {
      actorType: 'admin',
      actorUserId: userId,
    })
  }

  @Post('update-audit-status')
  @ApiAuditDoc({
    summary: '更新主题审核状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateAuditStatus(
    @Body() body: UpdateForumTopicAuditStatusDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumModeratorGovernanceService.updateTopicAuditStatus(body, {
      actorType: 'admin',
      actorUserId: userId,
    })
  }
}
