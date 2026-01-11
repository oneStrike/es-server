import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  CreateForumSectionDto,
  ForumSectionService,
  QueryForumSectionDto,
  UpdateForumSectionDto,
} from '@libs/forum'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Controller('/admin/forum/sections')
@ApiTags('论坛模块/板块管理')
export class ForumSectionController {
  constructor(private readonly forumSectionService: ForumSectionService) {}

  @Get('list')
  @ApiPageDoc({
    summary: '查看板块列表',
    model: CreateForumSectionDto,
  })
  async getSectionList(@Query() query: QueryForumSectionDto) {
    return this.forumSectionService.getForumSectionPage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '查看板块详情',
    model: CreateForumSectionDto,
  })
  async getSectionDetail(@Query() query: IdDto) {
    return this.forumSectionService.getForumSectionDetail(query.id)
  }

  @Get('tree')
  @ApiDoc({
    summary: '查看板块树',
  })
  async getSectionTree() {
    return this.forumSectionService.getSectionTree()
  }

  @Post('add')
  @ApiDoc({
    summary: '添加板块',
    model: CreateForumSectionDto,
  })
  async addSection(@Body() dto: CreateForumSectionDto) {
    return this.forumSectionService.createForumSection(dto)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新板块',
    model: UpdateForumSectionDto,
  })
  async updateSection(@Body() dto: UpdateForumSectionDto) {
    return this.forumSectionService.updateForumSection(dto)
  }

  @Post('remove')
  @ApiDoc({
    summary: '删除板块',
  })
  async removeSection(@Body() dto: IdDto) {
    return this.forumSectionService.deleteForumSection(dto.id)
  }

  @Post('update-enabled')
  @ApiDoc({
    summary: '更新板块启用状态',
  })
  async updateEnabledStatus(@Body() dto: { id: number, isEnabled: boolean }) {
    return this.forumSectionService.updateEnabledStatus(dto.id, dto.isEnabled)
  }
}
