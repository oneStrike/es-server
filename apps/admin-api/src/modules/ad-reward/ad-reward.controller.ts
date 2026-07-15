import { AdRewardService } from '@libs/interaction/ad-reward/ad-reward.service'
import {
  AdminAdRewardReconcileItemDto,
  AdminAdRewardRecordDetailDto,
  AdProviderConfigOutputDto,
  AdRewardCredentialOptionDto,
  AdRewardRevokeDto,
  BaseAdRewardRecordDto,
  CreateAdProviderConfigDto,
  QueryAdProviderConfigDto,
  QueryAdRewardRecordDto,
  UpdateAdProviderConfigDto,
} from '@libs/interaction/ad-reward/dto/ad-reward.dto'
import { AuditActionTypeEnum } from '@libs/observability/audit/audit-action.constant'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto, UpdateEnabledStatusDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../common/decorators/admin-permission.decorator'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'

@ApiTags('广告激励')
@Controller('admin/ad-reward')
export class AdRewardController {
  constructor(private readonly adRewardService: AdRewardService) {}

  // 分页查询广告 provider 配置。
  @Get('provider/page')
  @AdminPermission({
    code: 'ad:reward:provider:page',
    name: '分页查询广告 provider 配置',
    groupCode: 'ad:reward',
  })
  @ApiPageDoc({
    summary: '分页查询广告 provider 配置',
    model: AdProviderConfigOutputDto,
  })
  async getAdProviderConfigPage(@Query() query: QueryAdProviderConfigDto) {
    return this.adRewardService.getAdProviderConfigPage(query)
  }

  // 查询广告验签密钥选项。
  @Get('credential-option/list')
  @AdminPermission({
    code: 'ad:reward:credential:option:list',
    name: '查询广告验签密钥选项',
    groupCode: 'ad:reward',
  })
  @ApiDoc({
    summary: '查询广告验签密钥选项',
    model: AdRewardCredentialOptionDto,
    isArray: true,
  })
  async getAdRewardCredentialOptions() {
    return this.adRewardService.getAdRewardCredentialOptions()
  }

  // 分页查询广告奖励记录。
  @Get('record/page')
  @AdminPermission({
    code: 'ad:reward:record:page',
    name: '分页查询广告奖励记录',
    groupCode: 'ad:reward',
  })
  @ApiPageDoc({
    summary: '分页查询广告奖励记录',
    model: BaseAdRewardRecordDto,
  })
  async getAdRewardRecordPage(@Query() query: QueryAdRewardRecordDto) {
    return this.adRewardService.getAdRewardRecordPage(query)
  }

  // 查询广告奖励记录详情。
  @Get('record/detail')
  @AdminPermission({
    code: 'ad:reward:record:detail',
    name: '查询广告奖励记录详情',
    groupCode: 'ad:reward',
  })
  @ApiDoc({
    summary: '查询广告奖励记录详情',
    model: AdminAdRewardRecordDetailDto,
  })
  async getAdRewardRecordDetail(@Query() query: IdDto) {
    return this.adRewardService.getAdRewardRecordDetail(query.id)
  }

  // 分页查询广告奖励和内容权益对账视图。
  @Get('record/reconcile/page')
  @AdminPermission({
    code: 'ad:reward:record:reconcile:page',
    name: '分页查询广告奖励和内容权益对账视图',
    groupCode: 'ad:reward',
  })
  @ApiPageDoc({
    summary: '分页查询广告奖励和内容权益对账视图',
    model: AdminAdRewardReconcileItemDto,
  })
  async getAdRewardReconcilePage(@Query() query: QueryAdRewardRecordDto) {
    return this.adRewardService.getAdRewardReconcilePage(query)
  }

  // 创建广告 provider 配置。
  @Post('provider/create')
  @AdminPermission({
    code: 'ad:reward:provider:create',
    name: '创建广告 provider 配置',
    groupCode: 'ad:reward',
  })
  @ApiAuditDoc({
    summary: '创建广告 provider 配置',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.CREATE },
  })
  async createAdProviderConfig(@Body() body: CreateAdProviderConfigDto) {
    return this.adRewardService.createAdProviderConfig(body)
  }

  // 更新广告 provider 配置。
  @Post('provider/update')
  @AdminPermission({
    code: 'ad:reward:provider:update',
    name: '更新广告 provider 配置',
    groupCode: 'ad:reward',
  })
  @ApiAuditDoc({
    summary: '更新广告 provider 配置',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updateAdProviderConfig(@Body() body: UpdateAdProviderConfigDto) {
    return this.adRewardService.updateAdProviderConfig(body)
  }

  // 更新广告 provider 启用状态。
  @Post('provider/update-status')
  @AdminPermission({
    code: 'ad:reward:provider:update:status',
    name: '更新广告 provider 启用状态',
    groupCode: 'ad:reward',
  })
  @ApiAuditDoc({
    summary: '更新广告 provider 启用状态',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updateAdProviderStatus(@Body() body: UpdateEnabledStatusDto) {
    return this.adRewardService.updateAdProviderStatus(body.id, body.isEnabled)
  }

  // 撤销广告奖励记录。
  @Post('record/revoke')
  @AdminPermission({
    code: 'ad:reward:record:revoke',
    name: '撤销广告奖励记录',
    groupCode: 'ad:reward',
  })
  @ApiAuditDoc({
    summary: '撤销广告奖励记录',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async revokeAdRewardRecord(@Body() body: AdRewardRevokeDto) {
    return this.adRewardService.revokeAdRewardRecord(body)
  }
}
