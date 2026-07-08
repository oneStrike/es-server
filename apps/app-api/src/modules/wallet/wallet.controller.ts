import { PaymentOrderResultDto } from '@libs/interaction/payment/dto/payment.dto'
import { UserAssetsService } from '@libs/interaction/user-assets/user-assets.service'
import {
  AppCurrencyPackageDto,
  CreateCurrencyRechargeOrderDto,
  WalletDetailDto,
  WalletLedgerRecordDto,
} from '@libs/interaction/wallet/dto/wallet.dto'
import { WalletService } from '@libs/interaction/wallet/wallet.service'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
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
    model: AppCurrencyPackageDto,
    isArray: true,
  })
  async getCurrencyPackageList() {
    return this.walletService.getCurrencyPackageList()
  }

  // 分页查询当前用户虚拟币流水。
  @Get('ledger/page')
  @ApiPageDoc({
    summary: '分页查询虚拟币流水',
    model: WalletLedgerRecordDto,
  })
  async getWalletLedgerPage(
    @CurrentUser('sub') userId: number,
    @Query() query: PageDto,
  ) {
    return this.walletService.getWalletLedgerPage(userId, query)
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
