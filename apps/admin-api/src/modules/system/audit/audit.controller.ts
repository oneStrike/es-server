import { ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator'
import { AuditItemDto, AuditPageRequestDto } from '@libs/platform/modules/audit/dto/audit.dto'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuditService } from './audit.service'

@Controller('admin/audit')
@ApiTags('系统管理/审计日志')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * 获取审计日志列表
   */
  @Get('page')
  @ApiPageDoc({
    summary: '获取审计日志列表',
    model: AuditItemDto,
  })
  async getAuditPage(@Query() query: AuditPageRequestDto) {
    return this.auditService.getAuditPage(query)
  }
}
