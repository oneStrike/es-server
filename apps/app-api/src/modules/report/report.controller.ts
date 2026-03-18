import { ReportService } from '@libs/interaction'
import { ApiDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { CreateReportBodyDto } from './dto/report.dto'

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
