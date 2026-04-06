import { BaseReportDto, HandleAdminReportDto, QueryAdminReportPageDto } from '@libs/interaction/report/dto/report.dto';
import { ReportService } from '@libs/interaction/report/report.service';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { CurrentUser } from '@libs/platform/decorators/current-user.decorator';
import { IdDto } from '@libs/platform/dto/base.dto';
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../common/decorators/audit.decorator'
import { AuditActionTypeEnum } from '../system/audit/audit.constant'

@ApiTags('内容治理/举报处理')
@Controller('admin/report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询举报记录',
    model: BaseReportDto,
  })
  async getPage(@Query() query: QueryAdminReportPageDto) {
    return this.reportService.getAdminReportPage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取举报详情',
    model: BaseReportDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.reportService.getAdminReportDetail(query.id)
  }

  @Post('handle')
  @ApiDoc({
    summary: '处理举报',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '处理举报',
  })
  async handle(
    @Body() body: HandleAdminReportDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.reportService.handleReport({
      ...body,
      handlerId: userId,
    })
  }
}
