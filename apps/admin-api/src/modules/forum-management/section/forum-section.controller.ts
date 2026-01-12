import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { DragReorderDto, IdDto, UpdateEnabledStatusDto } from '@libs/base/dto'
import {
  BaseForumSectionDto,
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

  @Get('page')
  @ApiPageDoc({
    summary: '查看板块列表',
    model: BaseForumSectionDto,
  })
  async getSectionPage(@Query() query: QueryForumSectionDto) {
    return this.forumSectionService.getForumSectionPage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '查看板块详情',
    model: BaseForumSectionDto,
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

  @Post('create')
  @ApiDoc({
    summary: '添加板块',
    model: BaseForumSectionDto,
  })
  async createSection(@Body() dto: CreateForumSectionDto) {
    return this.forumSectionService.createForumSection(dto)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新板块',
    model: BaseForumSectionDto,
  })
  async updateSection(@Body() dto: UpdateForumSectionDto) {
    return this.forumSectionService.updateForumSection(dto)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除板块',
    model: BaseForumSectionDto,
  })
  async deleteSection(@Body() dto: IdDto) {
    return this.forumSectionService.deleteForumSection(dto.id)
  }

  @Post('update-enabled')
  @ApiDoc({
    summary: '更新板块启用状态',
    model: BaseForumSectionDto,
  })
  async updateEnabledStatus(@Body() dto: UpdateEnabledStatusDto) {
    return this.forumSectionService.updateEnabledStatus(dto)
  }

  @Post('swap-sort-order')
  @ApiDoc({
    summary: '交换板块排序顺序',
    model: BaseForumSectionDto,
  })
  async swapSortOrder(@Body() dto: DragReorderDto) {
    return this.forumSectionService.updateSectionSort(dto)
  }
}
