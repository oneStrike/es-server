import { ApiPageDoc } from '@libs/platform/decorators'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  GrowthRuleEventPageItemDto,
  QueryGrowthRuleEventPageDto,
} from './dto/growth.dto'
import { GrowthService } from './growth.service'

@ApiTags('用户成长/规则聚合视图')
@Controller('admin/growth')
export class GrowthController {
  constructor(private readonly growthService: GrowthService) {}

  @Get('rule-events/page')
  @ApiPageDoc({
    summary:
      '按事件聚合查看积分规则、经验规则与任务 bonus 关联关系',
    model: GrowthRuleEventPageItemDto,
  })
  async getGrowthRuleEventPage(@Query() query: QueryGrowthRuleEventPageDto) {
    return this.growthService.getGrowthRuleEventPage(query)
  }
}
