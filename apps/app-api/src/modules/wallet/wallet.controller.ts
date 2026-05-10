import { PaymentOrderResultDto } from '@libs/interaction/payment/dto/payment.dto'
import { UserAssetsService } from '@libs/interaction/user-assets/user-assets.service'
import {
  BaseCurrencyPackageDto,
  CreateCurrencyRechargeOrderDto,
  WalletDetailDto,
} from '@libs/interaction/wallet/dto/wallet.dto'
import { WalletService } from '@libs/interaction/wallet/wallet.service'
import { ApiDoc, CurrentUser } from '@libs/platform/decorators'
import { Body, Controller, Get, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('钱包')
@Controller('app/wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly userAssetsService: UserAssetsService,
  ) {}

  // 获取用户钱包详情。
  @Get('detail')
  @ApiDoc({
    summary: '获取钱包详情',
    model: WalletDetailDto,
  })
  async getWalletDetail(@CurrentUser('sub') userId: number) {
    return this.userAssetsService.getWalletDetail(userId)
  }

  // 获取启用的虚拟币充值包列表。
  @Get('currency-package/list')
  @ApiDoc({
    summary: '获取虚拟币充值包列表',
    model: BaseCurrencyPackageDto,
    isArray: true,
  })
  async getCurrencyPackageList() {
    return this.walletService.getCurrencyPackageList()
  }

  // 创建虚拟币充值订单。
  @Post('recharge/create')
  @ApiDoc({
    summary: '创建虚拟币充值订单',
    model: PaymentOrderResultDto,
  })
  async createCurrencyRechargeOrder(
    @Body() body: CreateCurrencyRechargeOrderDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.walletService.createCurrencyRechargeOrder(userId, body)
  }
}
