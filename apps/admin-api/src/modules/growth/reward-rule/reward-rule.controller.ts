import {
  BaseGrowthRewardRuleDto,
  CreateGrowthRewardRuleDto,
  QueryGrowthRewardRuleDto,
  UpdateGrowthRewardRuleDto,
} from '@libs/growth/reward-rule/dto/reward-rule.dto'
import { GrowthRewardRuleService } from '@libs/growth/reward-rule/reward-rule.service'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator'
import { IdDto } from '@libs/platform/dto/base.dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

@ApiTags('用户成长/奖励规则管理')
@Controller('admin/growth/reward-rules')
export class RewardRuleController {
  constructor(private readonly growthRewardRuleService: GrowthRewardRuleService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询成长奖励规则',
    model: BaseGrowthRewardRuleDto,
  })
  async getRewardRulePage(@Query() query: QueryGrowthRewardRuleDto) {
    return this.growthRewardRuleService.getRewardRulePage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '查询成长奖励规则详情',
    model: BaseGrowthRewardRuleDto,
  })
  async getRewardRuleDetail(@Query() query: IdDto) {
    return this.growthRewardRuleService.getRewardRuleDetail(query.id)
  }

  @Post('create')
  @ApiAuditDoc({
    summary: '创建成长奖励规则',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async createRewardRule(@Body() body: CreateGrowthRewardRuleDto) {
    return this.growthRewardRuleService.createRewardRule(body)
  }

  @Post('update')
  @ApiAuditDoc({
    summary: '更新成长奖励规则',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updateRewardRule(@Body() body: UpdateGrowthRewardRuleDto) {
    return this.growthRewardRuleService.updateRewardRule(body)
  }

  @Post('delete')
  @ApiAuditDoc({
    summary: '删除成长奖励规则',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.DELETE,
    },
  })
  async deleteRewardRule(@Body() body: IdDto) {
    return this.growthRewardRuleService.deleteRewardRule(body.id)
  }
}
