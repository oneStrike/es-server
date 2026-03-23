import { ReportService } from '@libs/interaction/report'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  CreateReportBodyDto,
  QueryMyReportPageDto,
  ReportItemDto,
} from './dto/report.dto'

@ApiTags('举报')
@Controller('app/report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post('create')
  @ApiDoc({
    summary: '创建举报',
    model: IdDto,
  })
  async createReport(
    @Body() body: CreateReportBodyDto,
    @CurrentUser('sub') userId: number,
  ) {
    const report = await this.reportService.createReport({
      ...body,
      reporterId: userId,
    })

    return { id: report.id }
  }

  @Get('my/page')
  @ApiPageDoc({
    summary: '分页查询我的举报记录',
    model: ReportItemDto,
  })
  async my(
    @Query() query: QueryMyReportPageDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.reportService.getUserReports({
      ...query,
      reporterId: userId,
    })
  }

  @Get('detail')
  @ApiDoc({
    summary: '查询举报详情',
    model: ReportItemDto,
  })
  async detail(@Query() query: IdDto, @CurrentUser('sub') userId: number) {
    return this.reportService.getReportDetail(query.id, userId)
  }
}
