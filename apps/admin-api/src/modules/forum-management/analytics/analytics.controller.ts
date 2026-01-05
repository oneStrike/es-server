import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AnalyticsService } from './analytics.service'
import {
  ActiveUsersQueryDto,
  ActivityTrendQueryDto,
  ForumOverviewDto,
  HotTopicsQueryDto,
  SectionStatsQueryDto,
} from './dto/analytics.dto'

@ApiTags('论坛管理/数据分析')
@Controller('admin/forum/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('/overview')
  @ApiDoc({
    summary: '获取论坛概览数据',
    model: ForumOverviewDto,
  })
  async getForumOverview() {
    return this.analyticsService.getForumOverview()
  }

  @Get('/activity-trend')
  @ApiDoc({
    summary: '获取活跃度趋势数据',
    model: ActivityTrendQueryDto,
  })
  async getActivityTrend(@Query() query: ActivityTrendQueryDto) {
    return this.analyticsService.getActivityTrend(query)
  }

  @Get('/hot-topics')
  @ApiPageDoc({
    summary: '获取热门主题排行',
    model: HotTopicsQueryDto,
  })
  async getHotTopics(@Query() query: HotTopicsQueryDto) {
    return this.analyticsService.getHotTopics(query)
  }

  @Get('/active-users')
  @ApiPageDoc({
    summary: '获取活跃用户排行',
    model: ActiveUsersQueryDto,
  })
  async getActiveUsers(@Query() query: ActiveUsersQueryDto) {
    return this.analyticsService.getActiveUsers(query)
  }

  @Get('/section-stats')
  @ApiPageDoc({
    summary: '获取板块统计数据',
    model: SectionStatsQueryDto,
  })
  async getSectionStats(@Query() query: SectionStatsQueryDto) {
    return this.analyticsService.getSectionStats(query)
  }
}
