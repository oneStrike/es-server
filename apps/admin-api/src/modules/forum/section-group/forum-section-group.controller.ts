import {
  BaseForumSectionGroupDto,
  CreateForumSectionGroupDto,
  ForumSectionGroupService,
  QueryForumSectionGroupDto,
  SwapForumSectionGroupSortDto,
  UpdateForumSectionGroupDto,
  UpdateForumSectionGroupEnabledDto,
} from '@libs/forum/section-group'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../../common/decorators/audit.decorator'
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
  @ApiDoc({
    summary: '添加板块组',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.CREATE,
    content: '添加板块组',
  })
  async createSectionGroup(@Body() dto: CreateForumSectionGroupDto) {
    return this.forumSectionGroupService.createSectionGroup(dto)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新板块组',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新板块组',
  })
  async updateSectionGroup(@Body() dto: UpdateForumSectionGroupDto) {
    return this.forumSectionGroupService.updateSectionGroup(dto)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除板块组',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.DELETE,
    content: '删除板块组',
  })
  async deleteSectionGroup(@Body() dto: IdDto) {
    return this.forumSectionGroupService.deleteSectionGroup(dto.id)
  }

  @Post('update-enabled')
  @ApiDoc({
    summary: '更新板块组启用状态',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新板块组启用状态',
  })
  async updateEnabledStatus(@Body() dto: UpdateForumSectionGroupEnabledDto) {
    return this.forumSectionGroupService.updateSectionGroupEnabled(dto)
  }

  @Post('swap-sort-order')
  @ApiDoc({
    summary: '交换板块组排序顺序',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '交换板块组排序顺序',
  })
  async swapSortOrder(@Body() dto: SwapForumSectionGroupSortDto) {
    return this.forumSectionGroupService.swapSectionGroupSortOrder(dto)
  }
}
