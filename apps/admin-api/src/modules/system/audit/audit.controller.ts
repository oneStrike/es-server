import { AuditService } from '@libs/observability/audit/audit.service'
import {
  AuditItemDto,
  AuditPageRequestDto,
} from '@libs/observability/audit/dto/audit.dto'
import { ApiPageDoc } from '@libs/platform/decorators'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../../common/decorators/admin-permission.decorator'

@Controller('admin/audit')
@ApiTags('系统管理/审计日志')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * 获取审计日志列表
   */
  @Get('page')
  @AdminPermission({
    code: 'audit:page',
    name: '获取审计日志列表',
    groupCode: 'audit',
  })
  @ApiPageDoc({
    summary: '获取审计日志列表',
    model: AuditItemDto,
  })
  async getAuditPage(@Query() query: AuditPageRequestDto) {
    return this.auditService.getAuditPage(query)
  }
}
