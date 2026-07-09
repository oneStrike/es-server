import {
  CreateForumSectionGroupDto,
  ForumSectionGroupOutputDto,
  QueryForumSectionGroupDto,
  SwapForumSectionGroupSortDto,
  UpdateForumSectionGroupDto,
  UpdateForumSectionGroupEnabledDto,
} from '@libs/forum/section-group/dto/forum-section-group.dto'
import { ForumSectionGroupService } from '@libs/forum/section-group/forum-section-group.service'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../../common/decorators/admin-permission.decorator'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

@Controller('admin/forum/section-groups')
@ApiTags('论坛管理/板块管理')
export class ForumSectionGroupController {
  constructor(
    private readonly forumSectionGroupService: ForumSectionGroupService,
  ) {}

  @Get('page')
  @AdminPermission({
    code: 'forum:section:groups:page',
    name: '查看板块组列表',
    groupCode: 'forum:section:groups',
  })
  @ApiPageDoc({
    summary: '查看板块组列表',
    model: ForumSectionGroupOutputDto,
  })
  async getSectionGroupPage(@Query() query: QueryForumSectionGroupDto) {
    return this.forumSectionGroupService.getSectionGroupPage(query)
  }

  @Get('detail')
  @AdminPermission({
    code: 'forum:section:groups:detail',
    name: '查看板块组详情',
    groupCode: 'forum:section:groups',
  })
  @ApiDoc({
    summary: '查看板块组详情',
    model: ForumSectionGroupOutputDto,
  })
  async getSectionGroupDetail(@Query() query: IdDto) {
    return this.forumSectionGroupService.getSectionGroupById(query.id)
  }

  @Post('create')
  @AdminPermission({
    code: 'forum:section:groups:create',
    name: '添加板块组',
    groupCode: 'forum:section:groups',
  })
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
  @AdminPermission({
    code: 'forum:section:groups:update',
    name: '更新板块组',
    groupCode: 'forum:section:groups',
  })
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
  @AdminPermission({
    code: 'forum:section:groups:delete',
    name: '删除板块组',
    groupCode: 'forum:section:groups',
  })
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
  @AdminPermission({
    code: 'forum:section:groups:update:enabled',
    name: '更新板块组启用状态',
    groupCode: 'forum:section:groups',
  })
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
  @AdminPermission({
    code: 'forum:section:groups:swap:sort:order',
    name: '交换板块组排序顺序',
    groupCode: 'forum:section:groups',
  })
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
