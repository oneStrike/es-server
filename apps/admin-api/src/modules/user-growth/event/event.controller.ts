import { ApiPageDoc } from '@libs/base/decorators'
import {
  BaseUserGrowthEventDto,
  QueryUserGrowthEventDto,
  UserGrowthEventAuditService,
} from '@libs/user/growth-event'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Controller('/admin/user-growth/events')
@ApiTags('用户成长/事件审计')
export class UserGrowthEventController {
  constructor(
    private readonly userGrowthEventAuditService: UserGrowthEventAuditService,
  ) {}

  @Get('page')
  @ApiPageDoc({
    summary: '获取成长事件分页',
    model: BaseUserGrowthEventDto,
  })
  async getEventPage(@Query() query: QueryUserGrowthEventDto) {
    return this.userGrowthEventAuditService.findPage(query)
  }
}
