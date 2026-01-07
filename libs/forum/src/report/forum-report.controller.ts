import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { BaseDto, IdDto } from '@libs/base/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import {
  BaseForumReportDto,
  CreateForumReportDto,
  HandleReportDto,
  QueryForumReportDto,
} from './dto/forum-report.dto'
import { ForumReportService } from './forum-report.service'

@ApiTags('论坛管理/举报模块')
@Controller('admin/forum/report')
export class ForumReportController {
  constructor(
    private readonly forumReportService: ForumReportService,
  ) {}

  @Post('/create')
  @ApiDoc({
    summary: '创建举报',
    model: BaseForumReportDto,
  })
  async create(@Body() body: CreateForumReportDto) {
    return this.forumReportService.createForumReport(body)
  }

  @Get('/page')
  @ApiPageDoc({
    summary: '分页查询举报记录',
    model: BaseForumReportDto,
  })
  async getPage(@Query() query: QueryForumReportDto) {
    return this.forumReportService.getForumReports(query)
  }

  @Get('/detail')
  @ApiDoc({
    summary: '获取举报详情',
    model: BaseForumReportDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.forumReportService.getForumReportById(query.id)
  }

  @Post('/handle')
  @ApiDoc({
    summary: '处理举报',
    model: BaseForumReportDto,
  })
  async handle(@Body() body: HandleReportDto) {
    return this.forumReportService.handleReport(body)
  }

  @Get('/statistics')
  @ApiDoc({
    summary: '获取举报统计',
    model: {
      totalReports: 100,
      pendingReports: 10,
      reportsByStatus: {},
      reportsByType: {},
      reportsByReason: {},
    },
  })
  async getStatistics() {
    return this.forumReportService.getReportStatistics()
  }

  @Get('/user-reports')
  @ApiPageDoc({
    summary: '获取用户举报记录',
    model: BaseForumReportDto,
  })
  async getUserReports(
    @Query('profileId') profileId: number,
    @Query('pageIndex') pageIndex = 0,
    @Query('pageSize') pageSize = 15,
  ) {
    return this.forumReportService.getUserReports(profileId, pageIndex, pageSize)
  }

  @Post('/delete')
  @ApiDoc({
    summary: '删除举报记录',
    model: BaseDto,
  })
  async delete(@Body() body: IdDto) {
    return this.forumReportService.deleteForumReport(body.id)
  }
}
