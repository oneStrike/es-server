import { AdRewardService } from '@libs/interaction/ad-reward/ad-reward.service'
import {
  AdminAdRewardReconcileItemDto,
  AdminAdRewardRecordDetailDto,
  AdminAdRewardRecordPageItemDto,
  AdRewardCredentialOptionDto,
  AdRewardRevokeDto,
  BaseAdProviderConfigDto,
  CreateAdProviderConfigDto,
  QueryAdProviderConfigDto,
  QueryAdRewardReconcileDto,
  QueryAdRewardRecordDto,
  UpdateAdProviderConfigDto,
} from '@libs/interaction/ad-reward/dto/ad-reward.dto'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { UpdateEnabledStatusDto } from '@libs/platform/dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, ParseIntPipe, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'

@ApiTags('广告激励')
@Controller('admin/ad-reward')
export class AdRewardController {
  constructor(private readonly adRewardService: AdRewardService) {}

  // 分页查询广告 provider 配置。
  @Get('provider/page')
  @ApiPageDoc({
    summary: '分页查询广告 provider 配置',
    model: BaseAdProviderConfigDto,
  })
  async getAdProviderConfigPage(@Query() query: QueryAdProviderConfigDto) {
    return this.adRewardService.getAdProviderConfigPage(query)
  }

  // 查询广告验签密钥选项。
  @Get('credential-option/list')
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
  @ApiPageDoc({
    summary: '分页查询广告奖励记录',
    model: AdminAdRewardRecordPageItemDto,
  })
  async getAdRewardRecordPage(@Query() query: QueryAdRewardRecordDto) {
    return this.adRewardService.getAdRewardRecordPage(query)
  }

  // 查询广告奖励记录详情。
  @Get('record/detail')
  @ApiDoc({
    summary: '查询广告奖励记录详情',
    model: AdminAdRewardRecordDetailDto,
  })
  async getAdRewardRecordDetail(@Query('id', ParseIntPipe) id: number) {
    return this.adRewardService.getAdRewardRecordDetail(id)
  }

  // 分页查询广告奖励和内容权益对账视图。
  @Get('record/reconcile/page')
  @ApiPageDoc({
    summary: '分页查询广告奖励和内容权益对账视图',
    model: AdminAdRewardReconcileItemDto,
  })
  async getAdRewardReconcilePage(@Query() query: QueryAdRewardReconcileDto) {
    return this.adRewardService.getAdRewardReconcilePage(query)
  }

  // 创建广告 provider 配置。
  @Post('provider/create')
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
  @ApiAuditDoc({
    summary: '撤销广告奖励记录',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async revokeAdRewardRecord(@Body() body: AdRewardRevokeDto) {
    return this.adRewardService.revokeAdRewardRecord(body)
  }
}
