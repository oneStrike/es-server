import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiDoc, ApiPageDoc } from '@/common/decorators/api-doc.decorator'
import { IdDto } from '@/common/dto/id.dto'
import { QueryRequestLogDto, RequestLogDto, RequestLogPageDto } from './dto/request-log.dto'
import { RequestLogService } from './request-log.service'

@ApiTags('请求日志')
@Controller('/admin/request-log')
export class RequestLogController {
  constructor(private readonly requestLogService: RequestLogService) { }

  @Get('/request-log-page')
  @ApiPageDoc({
    summary: '获取请求日志列表',
    model: RequestLogPageDto,
  })
  async getRequestLogList(@Query() queryDto: QueryRequestLogDto) {
    return this.requestLogService.findRequestLogPage(queryDto)
  }

  @Get('/request-log-detail')
  @ApiDoc({
    summary: '获取请求日志详情',
    model: RequestLogDto
  })
  async getRequestLogDetail(@Query() query: IdDto) {
    return this.requestLogService.findRequestLogById(query.id)
  }
}
