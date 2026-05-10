import { AdRewardService } from '@libs/interaction/ad-reward/ad-reward.service'
import {
  BaseAdProviderConfigDto,
  CreateAdProviderConfigDto,
  QueryAdProviderConfigDto,
  UpdateAdProviderConfigDto,
} from '@libs/interaction/ad-reward/dto/ad-reward.dto'
import { ApiPageDoc } from '@libs/platform/decorators'
import { UpdateEnabledStatusDto } from '@libs/platform/dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
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
}
