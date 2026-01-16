import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  CreateForumReportDto,
  ForumReportService,
  HandleReportDto,
  QueryForumReportDto,
} from '@libs/forum/report'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Controller('/admin/forum/reports')
@ApiTags('论坛模块/举报管理')
export class ForumReportController {
  constructor(private readonly forumReportService: ForumReportService) {}

  @Get('list')
  @ApiPageDoc({
    summary: '查看举报列表',
    model: CreateForumReportDto,
  })
  async getReportList(@Query() query: QueryForumReportDto) {
    return this.forumReportService.getReports(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '查看举报详情',
    model: CreateForumReportDto,
  })
  async getReportDetail(@Query() query: IdDto) {
    return this.forumReportService.getForumReportById(query.id)
  }

  @Get('statistics')
  @ApiDoc({
    summary: '获取举报统计数据',
  })
  async getStatistics() {
    return this.forumReportService.getReportStatistics()
  }

  @Post('add')
  @ApiDoc({
    summary: '创建举报',
    model: CreateForumReportDto,
  })
  async addReport(@Body() dto: CreateForumReportDto) {
    return this.forumReportService.createForumReport(dto)
  }

  @Post('handle')
  @ApiDoc({
    summary: '处理举报',
    model: HandleReportDto,
  })
  async handleReport(@Body() dto: HandleReportDto) {
    return this.forumReportService.handleReport(dto)
  }

  @Post('remove')
  @ApiDoc({
    summary: '删除举报记录',
  })
  async removeReport(@Body() dto: IdDto) {
    return this.forumReportService.deleteForumReport(dto.id)
  }
}
