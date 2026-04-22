import {
  GrowthRewardSettlementPageItemDto,
  GrowthRewardSettlementRetryBatchResultDto,
  QueryGrowthRewardSettlementPageDto,
  RetryGrowthRewardSettlementBatchDto,
} from '@libs/growth/growth-reward/dto/growth-reward-settlement.dto'
import {
  GrowthRuleEventPageItemDto,
  QueryGrowthRuleEventPageDto,
} from '@libs/growth/growth/dto/growth.dto'
import { ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator'
import { CurrentUser } from '@libs/platform/decorators/current-user.decorator'
import { IdDto } from '@libs/platform/dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'
import { GrowthService } from './growth.service'

@ApiTags('用户成长/规则聚合视图')
@Controller('admin/growth')
export class GrowthController {
  constructor(private readonly growthService: GrowthService) {}

  // 分页查询事件维度的基础奖励与任务 bonus 关联关系。
  @Get('rule-events/page')
  @ApiPageDoc({
    summary: '按事件聚合查看积分规则、经验规则与任务 bonus 关联关系',
    model: GrowthRuleEventPageItemDto,
  })
  async getGrowthRuleEventPage(@Query() query: QueryGrowthRuleEventPageDto) {
    return this.growthService.getGrowthRuleEventPage(query)
  }

  // 分页查询成长奖励补偿记录。
  @Get('reward-settlement/page')
  @ApiPageDoc({
    summary: '分页查询通用成长奖励补偿记录',
    model: GrowthRewardSettlementPageItemDto,
  })
  async getGrowthRewardSettlementPage(
    @Query() query: QueryGrowthRewardSettlementPageDto,
  ) {
    return this.growthService.getGrowthRewardSettlementPage(query)
  }

  // 手动重试单条成长奖励补偿记录。
  @Post('reward-settlement/retry')
  @ApiAuditDoc({
    summary: '重试单条通用成长奖励补偿',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async retryGrowthRewardSettlement(
    @Body() body: IdDto,
    @CurrentUser('sub') adminUserId: number,
  ) {
    return this.growthService.retryGrowthRewardSettlement(body.id, adminUserId)
  }

  // 批量重试当前仍处于待补偿状态的成长奖励记录。
  @Post('reward-settlement/retry-pending/batch')
  @ApiAuditDoc({
    summary: '批量重试待补偿的通用成长奖励记录',
    model: GrowthRewardSettlementRetryBatchResultDto,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async retryPendingGrowthRewardSettlementsBatch(
    @Body() body: RetryGrowthRewardSettlementBatchDto,
    @CurrentUser('sub') adminUserId: number,
  ) {
    return this.growthService.retryPendingGrowthRewardSettlementsBatch(
      body.limit,
      adminUserId,
    )
  }
}
