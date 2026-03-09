import { ApiDoc, CurrentUser } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import { CreateReportBodyDto, ReportService } from '@libs/interaction'
import { Body, Controller, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('举报模块')
@Controller('app/report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
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
}
