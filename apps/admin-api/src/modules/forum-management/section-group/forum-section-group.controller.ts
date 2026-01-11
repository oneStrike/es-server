import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  CreateForumSectionGroupDto,
  ForumSectionGroupService,
  QueryForumSectionGroupDto,
  UpdateForumSectionGroupDto,
} from '@libs/forum'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Controller('/admin/forum/section-groups')
@ApiTags('论坛模块/板块组管理')
export class ForumSectionGroupController {
  constructor(
    private readonly forumSectionGroupService: ForumSectionGroupService,
  ) {}

  @Get('list')
  @ApiPageDoc({
    summary: '查看板块组列表',
    model: CreateForumSectionGroupDto,
  })
  async getSectionGroupList(@Query() query: QueryForumSectionGroupDto) {
    return this.forumSectionGroupService.getForumSectionGroups(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '查看板块组详情',
    model: CreateForumSectionGroupDto,
  })
  async getSectionGroupDetail(@Query() query: IdDto) {
    return this.forumSectionGroupService.getForumSectionGroupById(query.id)
  }

  @Get('all-enabled')
  @ApiDoc({
    summary: '获取所有启用的板块组',
  })
  async getAllEnabledGroups() {
    return this.forumSectionGroupService.getAllEnabledGroups()
  }

  @Post('add')
  @ApiDoc({
    summary: '添加板块组',
    model: CreateForumSectionGroupDto,
  })
  async addSectionGroup(@Body() dto: CreateForumSectionGroupDto) {
    return this.forumSectionGroupService.createForumSectionGroup(dto)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新板块组',
    model: UpdateForumSectionGroupDto,
  })
  async updateSectionGroup(@Body() dto: UpdateForumSectionGroupDto) {
    return this.forumSectionGroupService.updateForumSectionGroup(dto)
  }

  @Post('remove')
  @ApiDoc({
    summary: '删除板块组',
  })
  async removeSectionGroup(@Body() dto: IdDto) {
    return this.forumSectionGroupService.deleteForumSectionGroup(dto.id)
  }

  @Post('update-enabled')
  @ApiDoc({
    summary: '更新板块组启用状态',
  })
  async updateEnabledStatus(@Body() dto: { id: number, isEnabled: boolean }) {
    return this.forumSectionGroupService.updateSectionGroupEnabled(dto)
  }
}
