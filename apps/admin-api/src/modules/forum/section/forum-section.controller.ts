import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import {
  BatchOperationResponseDto,
  DragReorderDto,
  IdDto,
} from '@libs/base/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import {
  BaseForumSectionDto,
  CreateForumSectionDto,
  QueryForumSectionDto,
  UpdateForumSectionDto,
  UpdateSectionEnabledDto,
  UpdateSectionSortDto,
} from './dto/forum-section.dto'
import { ForumSectionService } from './forum-section.service'

/**
 * 论坛板块管理控制器
 * 提供论坛板块相关的API接口
 */
@ApiTags('论坛管理/板块管理模块')
@Controller('admin/forum/section')
export class ForumSectionController {
  constructor(private readonly forumSectionService: ForumSectionService) {}

  /**
   * 创建论坛板块
   */
  @Post('/create')
  @ApiDoc({
    summary: '创建论坛板块',
    model: IdDto,
  })
  async create(@Body() body: CreateForumSectionDto) {
    return this.forumSectionService.createForumSection(body)
  }

  /**
   * 分页查询论坛板块列表
   */
  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询论坛板块列表',
    model: BaseForumSectionDto,
  })
  async getPage(@Query() query: QueryForumSectionDto) {
    return this.forumSectionService.getForumSectionPage(query)
  }

  /**
   * 获取论坛板块详情
   */
  @Get('/detail')
  @ApiDoc({
    summary: '获取论坛板块详情',
    model: BaseForumSectionDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.forumSectionService.getForumSectionDetail(query.id)
  }

  /**
   * 更新论坛板块
   */
  @Post('/update')
  @ApiDoc({
    summary: '更新论坛板块',
    model: IdDto,
  })
  async update(@Body() body: UpdateForumSectionDto) {
    return this.forumSectionService.updateForumSection(body)
  }

  /**
   * 软删除论坛板块
   */
  @Post('/delete')
  @ApiDoc({
    summary: '软删除论坛板块',
    model: IdDto,
  })
  async delete(@Body() body: IdDto) {
    return this.forumSectionService.deleteForumSection(body.id)
  }

  /**
   * 更新板块启用状态
   */
  @Post('/update-enabled')
  @ApiDoc({
    summary: '更新板块启用状态',
    model: BatchOperationResponseDto,
  })
  async updateEnabled(@Body() body: UpdateSectionEnabledDto) {
    return this.forumSectionService.updateEnabledStatus(body.id, body.isEnabled)
  }

  /**
   * 更新板块排序
   */
  @Post('/update-sort')
  @ApiDoc({
    summary: '更新板块排序',
    model: BatchOperationResponseDto,
  })
  async updateSort(@Body() body: UpdateSectionSortDto) {
    return this.forumSectionService.updateSortOrder(body.id, body.sortOrder)
  }

  /**
   * 拖拽排序
   */
  @Post('/order')
  @ApiDoc({
    summary: '板块拖拽排序',
    model: DragReorderDto,
  })
  async sectionOrder(@Body() body: DragReorderDto) {
    return this.forumSectionService.updateSectionSort(body)
  }
}
