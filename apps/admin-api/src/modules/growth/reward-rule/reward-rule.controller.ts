import {
  ArchiveGrowthRewardRuleDto,
  CreateGrowthRewardRuleDto,
  GrowthRewardRuleOutputDto,
  QueryGrowthRewardRuleDto,
  UpdateGrowthRewardRuleDto,
} from '@libs/growth/reward-rule/dto/reward-rule.dto'
import { GrowthRewardRuleService } from '@libs/growth/reward-rule/reward-rule.service'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../../common/decorators/admin-permission.decorator'
import { ApiAuditDoc } from '../../../common/decorators/api-audit-doc.decorator'

@ApiTags('用户成长/奖励规则管理')
@Controller('admin/growth/reward-rules')
export class RewardRuleController {
  constructor(
    private readonly growthRewardRuleService: GrowthRewardRuleService,
  ) {}

  @Get('page')
  @AdminPermission({
    code: 'growth:reward:rules:page',
    name: '分页查询成长奖励规则',
    groupCode: 'growth:reward:rules',
  })
  @ApiPageDoc({
    summary: '分页查询成长奖励规则',
    model: GrowthRewardRuleOutputDto,
  })
  async getRewardRulePage(@Query() query: QueryGrowthRewardRuleDto) {
    return this.growthRewardRuleService.getRewardRulePage(query)
  }

  @Get('detail')
  @AdminPermission({
    code: 'growth:reward:rules:detail',
    name: '查询成长奖励规则详情',
    groupCode: 'growth:reward:rules',
  })
  @ApiDoc({
    summary: '查询成长奖励规则详情',
    model: GrowthRewardRuleOutputDto,
  })
  async getRewardRuleDetail(@Query() query: IdDto) {
    return this.growthRewardRuleService.getRewardRuleDetail(query.id)
  }

  @Post('create')
  @AdminPermission({
    code: 'growth:reward:rules:create',
    name: '创建成长奖励规则',
    groupCode: 'growth:reward:rules',
  })
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
  @AdminPermission({
    code: 'growth:reward:rules:update',
    name: '更新成长奖励规则',
    groupCode: 'growth:reward:rules',
  })
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

  @Post('archive')
  @AdminPermission({
    code: 'growth:reward:rules:archive',
    name: '归档成长奖励规则',
    groupCode: 'growth:reward:rules',
  })
  @ApiAuditDoc({
    summary: '归档成长奖励规则',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async archiveRewardRule(
    @Body() body: ArchiveGrowthRewardRuleDto,
    @CurrentUser('sub') adminUserId: number,
  ) {
    return this.growthRewardRuleService.archiveRewardRule(body, adminUserId)
  }
}
