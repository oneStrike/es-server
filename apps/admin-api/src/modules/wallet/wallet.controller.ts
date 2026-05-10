import {
  BaseCurrencyPackageDto,
  CreateCurrencyPackageDto,
  QueryCurrencyPackageDto,
  UpdateCurrencyPackageDto,
} from '@libs/interaction/wallet/dto/wallet.dto'
import { WalletService } from '@libs/interaction/wallet/wallet.service'
import { ApiPageDoc } from '@libs/platform/decorators'
import { UpdateEnabledStatusDto } from '@libs/platform/dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'

@ApiTags('钱包管理')
@Controller('admin/wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  // 分页查询虚拟币充值包。
  @Get('currency-package/page')
  @ApiPageDoc({
    summary: '分页查询虚拟币充值包',
    model: BaseCurrencyPackageDto,
  })
  async getCurrencyPackagePage(@Query() query: QueryCurrencyPackageDto) {
    return this.walletService.getCurrencyPackagePage(query)
  }

  // 创建虚拟币充值包。
  @Post('currency-package/create')
  @ApiAuditDoc({
    summary: '创建虚拟币充值包',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.CREATE },
  })
  async createCurrencyPackage(@Body() body: CreateCurrencyPackageDto) {
    return this.walletService.createCurrencyPackage(body)
  }

  // 更新虚拟币充值包。
  @Post('currency-package/update')
  @ApiAuditDoc({
    summary: '更新虚拟币充值包',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updateCurrencyPackage(@Body() body: UpdateCurrencyPackageDto) {
    return this.walletService.updateCurrencyPackage(body)
  }

  // 更新虚拟币充值包启用状态。
  @Post('currency-package/update-status')
  @ApiAuditDoc({
    summary: '更新虚拟币充值包启用状态',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updateCurrencyPackageStatus(@Body() body: UpdateEnabledStatusDto) {
    return this.walletService.updateCurrencyPackageStatus(
      body.id,
      body.isEnabled,
    )
  }
}
