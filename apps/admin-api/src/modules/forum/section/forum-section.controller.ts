import { ForumSectionTreeNodeDto } from '@libs/forum/section-group/dto/forum-section-group.dto'
import {
  AdminForumSectionDetailDto,
  AdminForumSectionDto,
  CreateForumSectionDto,
  ForumSectionCountRepairResultDto,
  QueryForumSectionDto,
  SwapForumSectionSortDto,
  UpdateForumSectionDto,
  UpdateForumSectionEnabledDto,
} from '@libs/forum/section/dto/forum-section.dto'
import { ForumSectionService } from '@libs/forum/section/forum-section.service'
import { AuditActionTypeEnum } from '@libs/observability/audit/audit-action.constant'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../../common/decorators/admin-permission.decorator'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

@Controller('admin/forum/sections')
@ApiTags('论坛管理/板块管理')
export class ForumSectionController {
  constructor(private readonly forumSectionService: ForumSectionService) {}

  @Get('page')
  @AdminPermission({
    code: 'forum:sections:page',
    name: '查看板块分页',
    groupCode: 'forum:sections',
  })
  @ApiPageDoc({
    summary: '查看板块分页',
    model: AdminForumSectionDto,
  })
  async getSectionPage(@Query() query: QueryForumSectionDto) {
    return this.forumSectionService.getSectionPage(query)
  }

  @Get('detail')
  @AdminPermission({
    code: 'forum:sections:detail',
    name: '查看板块详情',
    groupCode: 'forum:sections',
  })
  @ApiDoc({
    summary: '查看板块详情',
    model: AdminForumSectionDetailDto,
  })
  async getSectionDetail(@Query() query: IdDto) {
    return this.forumSectionService.getSectionDetail(query.id)
  }

  @Get('tree')
  @AdminPermission({
    code: 'forum:sections:tree',
    name: '查看板块树',
    groupCode: 'forum:sections',
  })
  @ApiDoc({
    summary: '查看板块树',
    model: ForumSectionTreeNodeDto,
    isArray: true,
  })
  async getSectionTree() {
    return this.forumSectionService.getSectionTree()
  }

  @Post('create')
  @AdminPermission({
    code: 'forum:sections:create',
    name: '添加板块',
    groupCode: 'forum:sections',
  })
  @ApiAuditDoc({
    summary: '添加板块',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async createSection(@Body() dto: CreateForumSectionDto) {
    return this.forumSectionService.createSection(dto)
  }

  @Post('update')
  @AdminPermission({
    code: 'forum:sections:update',
    name: '更新板块',
    groupCode: 'forum:sections',
  })
  @ApiAuditDoc({
    summary: '更新板块',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateSection(@Body() dto: UpdateForumSectionDto) {
    return this.forumSectionService.updateSection(dto)
  }

  @Post('delete')
  @AdminPermission({
    code: 'forum:sections:delete',
    name: '删除板块',
    groupCode: 'forum:sections',
  })
  @ApiAuditDoc({
    summary: '删除板块',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async deleteSection(@Body() dto: IdDto) {
    return this.forumSectionService.deleteSection(dto.id)
  }

  @Post('update-enabled')
  @AdminPermission({
    code: 'forum:sections:update:enabled',
    name: '更新板块启用状态',
    groupCode: 'forum:sections',
  })
  @ApiAuditDoc({
    summary: '更新板块启用状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateEnabledStatus(@Body() dto: UpdateForumSectionEnabledDto) {
    return this.forumSectionService.updateEnabledStatus(dto)
  }

  @Post('rebuild-counts')
  @AdminPermission({
    code: 'forum:sections:rebuild:counts',
    name: '重建板块计数',
    groupCode: 'forum:sections',
  })
  @ApiAuditDoc({
    summary: '重建板块计数',
    model: ForumSectionCountRepairResultDto,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async rebuildCounts(@Body() dto: IdDto) {
    return this.forumSectionService.rebuildSectionCounts(dto.id)
  }

  @Post('rebuild-counts-all')
  @AdminPermission({
    code: 'forum:sections:rebuild:counts:all',
    name: '全量重建板块计数',
    groupCode: 'forum:sections',
  })
  @ApiAuditDoc({
    summary: '全量重建板块计数',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async rebuildCountsAll() {
    return this.forumSectionService.rebuildAllSectionCounts()
  }

  @Post('swap-sort-order')
  @AdminPermission({
    code: 'forum:sections:swap:sort:order',
    name: '交换板块排序顺序',
    groupCode: 'forum:sections',
  })
  @ApiAuditDoc({
    summary: '交换板块排序顺序',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async swapSortOrder(@Body() dto: SwapForumSectionSortDto) {
    return this.forumSectionService.updateSectionSort(dto)
  }
}
