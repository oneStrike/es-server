import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiDoc, ApiPageDoc } from '@/common/decorators/api-doc.decorator'
import { IdDto } from '@/common/dto/id.dto'
import {
  RequestLogDto,
  RequestLogPageDto,
  RequestLogService,
} from '@/modules/shared/request-log'

/**
 * 请求日志控制器
 * 提供请求日志相关的 RESTful API 接口
 */
@ApiTags('系统请求日志模块')
@Controller('system/request-log')
export class RequestLogController {
  constructor(private readonly requestLogService: RequestLogService) {}

  /**
   * 分页获取请求日志列表
   */
  @Get('page')
  @ApiPageDoc({
    summary: '分页获取请求日志列表',
    model: RequestLogDto,
  })
  async getRequestLogPage(@Query() queryDto: RequestLogPageDto) {
    return this.requestLogService.getRequestLogPage(queryDto)
  }

  /**
   * 根据ID获取请求日志详情
   */
  @Get('detail/:id')
  @ApiDoc({
    summary: '根据ID获取请求日志详情',
    model: RequestLogDto,
  })
  async getRequestLogById(@Param() params: IdDto) {
    return this.requestLogService.getRequestLogById(params.id)
  }
}
