import {
  BaseForumHashtagDto,
  CreateForumHashtagDto,
  QueryForumHashtagDto,
  UpdateForumHashtagAuditStatusDto,
  UpdateForumHashtagDto,
  UpdateForumHashtagHiddenDto,
} from '@libs/forum/hashtag/dto/forum-hashtag.dto'
import { ForumHashtagService } from '@libs/forum/hashtag/forum-hashtag.service'
import { AuditRoleEnum } from '@libs/platform/constant'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

@ApiTags('论坛管理/话题管理')
@Controller('admin/forum/hashtags')
export class ForumHashtagController {
  constructor(private readonly forumHashtagService: ForumHashtagService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询论坛话题',
    model: BaseForumHashtagDto,
  })
  async getPage(@Query() query: QueryForumHashtagDto) {
    return this.forumHashtagService.getHashtagPage({
      pageIndex: query.pageIndex ?? 1,
      pageSize: query.pageSize ?? 10,
      keyword: query.keyword,
      auditStatus: query.auditStatus,
      isHidden: query.isHidden,
    })
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取论坛话题详情',
    model: BaseForumHashtagDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.forumHashtagService.getHashtagDetail(query.id)
  }

  @Post('create')
  @ApiAuditDoc({
    summary: '创建论坛话题',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async create(
    @Body() body: CreateForumHashtagDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumHashtagService.createHashtag(
      {
        displayName: body.displayName,
        description: body.description ?? undefined,
        manualBoost: body.manualBoost,
      },
      userId,
    )
  }

  @Post('update')
  @ApiAuditDoc({
    summary: '更新论坛话题',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async update(@Body() body: UpdateForumHashtagDto) {
    return this.forumHashtagService.updateHashtag(body)
  }

  @Post('update-hidden')
  @ApiAuditDoc({
    summary: '更新论坛话题隐藏状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateHidden(@Body() body: UpdateForumHashtagHiddenDto) {
    return this.forumHashtagService.updateHashtagHidden(body)
  }

  @Post('update-audit-status')
  @ApiAuditDoc({
    summary: '更新论坛话题审核状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateAuditStatus(
    @Body() body: UpdateForumHashtagAuditStatusDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumHashtagService.updateHashtagAuditStatus(
      {
        id: body.id,
        auditStatus: body.auditStatus,
        auditReason: body.auditReason ?? undefined,
      },
      {
        auditById: userId,
        auditRole: AuditRoleEnum.ADMIN,
      },
    )
  }
}
