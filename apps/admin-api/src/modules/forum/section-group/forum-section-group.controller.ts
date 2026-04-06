import { BaseForumSectionGroupDto, CreateForumSectionGroupDto, QueryForumSectionGroupDto, SwapForumSectionGroupSortDto, UpdateForumSectionGroupDto, UpdateForumSectionGroupEnabledDto } from '@libs/forum/section-group/dto/forum-section-group.dto';
import { ForumSectionGroupService } from '@libs/forum/section-group/forum-section-group.service';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { IdDto } from '@libs/platform/dto/base.dto';
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'
import { AuditActionTypeEnum } from '../../system/audit/audit.constant'

@Controller('admin/forum/section-groups')
@ApiTags('论坛管理/板块管理')
export class ForumSectionGroupController {
  constructor(
    private readonly forumSectionGroupService: ForumSectionGroupService,
  ) {}

  @Get('page')
  @ApiPageDoc({
    summary: '查看板块组列表',
    model: BaseForumSectionGroupDto,
  })
  async getSectionGroupPage(@Query() query: QueryForumSectionGroupDto) {
    return this.forumSectionGroupService.getSectionGroupPage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '查看板块组详情',
    model: BaseForumSectionGroupDto,
  })
  async getSectionGroupDetail(@Query() query: IdDto) {
    return this.forumSectionGroupService.getSectionGroupById(query.id)
  }

  @Post('create')
  @ApiAuditDoc({
    summary: '添加板块组',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async createSectionGroup(@Body() dto: CreateForumSectionGroupDto) {
    return this.forumSectionGroupService.createSectionGroup(dto)
  }

  @Post('update')
  @ApiAuditDoc({
    summary: '更新板块组',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateSectionGroup(@Body() dto: UpdateForumSectionGroupDto) {
    return this.forumSectionGroupService.updateSectionGroup(dto)
  }

  @Post('delete')
  @ApiAuditDoc({
    summary: '删除板块组',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async deleteSectionGroup(@Body() dto: IdDto) {
    return this.forumSectionGroupService.deleteSectionGroup(dto.id)
  }

  @Post('update-enabled')
  @ApiAuditDoc({
    summary: '更新板块组启用状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateEnabledStatus(@Body() dto: UpdateForumSectionGroupEnabledDto) {
    return this.forumSectionGroupService.updateSectionGroupEnabled(dto)
  }

  @Post('swap-sort-order')
  @ApiAuditDoc({
    summary: '交换板块组排序顺序',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async swapSortOrder(@Body() dto: SwapForumSectionGroupSortDto) {
    return this.forumSectionGroupService.swapSectionGroupSortOrder(dto)
  }
}
