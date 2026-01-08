import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { BaseDto, IdDto } from '@libs/base/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import {
  BaseForumViewDto,
  CreateForumViewDto,
  QueryForumViewDto,
  ViewStatisticsDto,
} from './dto/forum-view.dto'
import { ForumViewService } from './forum-view.service'

/**
 * 论坛浏览记录管理控制器
 * 提供论坛浏览记录相关的API接口
 */
@ApiTags('论坛管理/浏览记录模块')
@Controller('admin/forum/view')
export class ForumViewController {
  constructor(
    private readonly forumViewService: ForumViewService,
  ) {}

  /**
   * 创建浏览记录
   * @param body - 创建浏览记录的数据传输对象
   * @returns 创建的浏览记录
   */
  @Post('/create')
  @ApiDoc({
    summary: '创建浏览记录',
    model: BaseForumViewDto,
  })
  async create(@Body() body: CreateForumViewDto) {
    return this.forumViewService.createForumView(body)
  }

  /**
   * 分页查询浏览记录
   * @param query - 查询参数
   * @returns 分页的浏览记录列表
   */
  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询浏览记录',
    model: BaseForumViewDto,
  })
  async getPage(@Query() query: QueryForumViewDto) {
    return this.forumViewService.getForumViews(query)
  }

  /**
   * 获取主题浏览统计
   * @param query - 统计查询参数
   * @returns 浏览统计数据
   */
  @Get('/statistics')
  @ApiDoc({
    summary: '获取主题浏览统计',
    model: {
      totalViews: 100,
      uniqueViewers: 50,
      viewsByType: {},
      recentViews: [],
    },
  })
  async getStatistics(@Query() query: ViewStatisticsDto) {
    return this.forumViewService.getViewStatistics(query)
  }

  /**
   * 获取用户浏览历史
   * @param profileId - 用户资料ID
   * @param pageIndex - 页码，默认为0
   * @param pageSize - 每页数量，默认为15
   * @returns 分页的用户浏览历史记录
   */
  @Get('/user-history')
  @ApiPageDoc({
    summary: '获取用户浏览历史',
    model: BaseForumViewDto,
  })
  async getUserHistory(
    @Query('profileId') profileId: number,
    @Query('pageIndex') pageIndex = 0,
    @Query('pageSize') pageSize = 15,
  ) {
    return this.forumViewService.getUserViewHistory(profileId, pageIndex, pageSize)
  }

  /**
   * 删除浏览记录
   * @param body - 包含浏览记录ID的对象
   * @returns 操作结果
   */
  @Post('/delete')
  @ApiDoc({
    summary: '删除浏览记录',
    model: BaseDto,
  })
  async delete(@Body() body: IdDto) {
    return this.forumViewService.deleteForumView(body.id)
  }

  /**
   * 清理旧浏览记录
   * @param daysOld - 保留天数，默认为30天
   * @returns 删除的记录数量
   */
  @Post('/clear-old')
  @ApiDoc({
    summary: '清理旧浏览记录',
    model: { deletedCount: 100 },
  })
  async clearOld(@Body('daysOld') daysOld = 30) {
    return this.forumViewService.clearOldViews(daysOld)
  }
}
