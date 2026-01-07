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

@ApiTags('论坛管理/浏览记录模块')
@Controller('admin/forum/view')
export class ForumViewController {
  constructor(
    private readonly forumViewService: ForumViewService,
  ) {}

  @Post('/create')
  @ApiDoc({
    summary: '创建浏览记录',
    model: BaseForumViewDto,
  })
  async create(@Body() body: CreateForumViewDto) {
    return this.forumViewService.createForumView(body)
  }

  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询浏览记录',
    model: BaseForumViewDto,
  })
  async getPage(@Query() query: QueryForumViewDto) {
    return this.forumViewService.getForumViews(query)
  }

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

  @Post('/delete')
  @ApiDoc({
    summary: '删除浏览记录',
    model: BaseDto,
  })
  async delete(@Body() body: IdDto) {
    return this.forumViewService.deleteForumView(body.id)
  }

  @Post('/clear-old')
  @ApiDoc({
    summary: '清理旧浏览记录',
    model: { deletedCount: 100 },
  })
  async clearOld(@Body('daysOld') daysOld = 30) {
    return this.forumViewService.clearOldViews(daysOld)
  }
}
