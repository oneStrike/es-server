import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { DragReorderDto, IdDto, UpdateEnabledStatusDto } from '@libs/base/dto'
import {
  BaseForumSectionGroupDto,
  CreateForumSectionGroupDto,
  ForumSectionGroupService,
  QueryForumSectionGroupDto,
  UpdateForumSectionGroupDto,
} from '@libs/forum/section-group'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Controller('/admin/forum/section-groups')
@ApiTags('论坛模块/板块组管理')
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
    model: BaseForumSectionGroupDto,
  })
  async createSectionGroup(@Body() dto: CreateForumSectionGroupDto) {
    return this.forumSectionGroupService.createSectionGroup(dto)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新板块组',
    model: BaseForumSectionGroupDto,
  })
  async updateSectionGroup(@Body() dto: UpdateForumSectionGroupDto) {
    return this.forumSectionGroupService.updateSectionGroup(dto)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除板块组',
    model: BaseForumSectionGroupDto,
  })
  async deleteSectionGroup(@Body() dto: IdDto) {
    return this.forumSectionGroupService.deleteSectionGroup(dto.id)
  }

  @Post('update-enabled')
  @ApiDoc({
    summary: '更新板块组启用状态',
    model: BaseForumSectionGroupDto,
  })
  async updateEnabledStatus(@Body() dto: UpdateEnabledStatusDto) {
    return this.forumSectionGroupService.updateSectionGroupEnabled(dto)
  }

  @Post('swap-sort-order')
  @ApiDoc({
    summary: '交换板块组排序顺序',
    model: BaseForumSectionGroupDto,
  })
  async swapSortOrder(@Body() dto: DragReorderDto) {
    return this.forumSectionGroupService.swapSectionGroupSortOrder(dto)
  }
}
