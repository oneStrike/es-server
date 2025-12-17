import { ApiPageDoc } from '@libs/base/decorators'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuditService } from './audit.service'
import { AuditPageRequestDto, BaseAuditDto } from './dto/audit.dto'

@Controller('admin/audit')
@ApiTags('系统管理/审计日志')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * 获取审计日志列表
   */
  @Get('/page')
  @ApiPageDoc({
    summary: '获取审计日志列表',
    model: BaseAuditDto,
  })
  async getAuditPage(@Query() query: AuditPageRequestDto) {
    return this.auditService.getAuditPage(query)
  }
}
