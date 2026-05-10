import { WalletModule as InteractionWalletModule } from '@libs/interaction/wallet/wallet.module'
import { Module } from '@nestjs/common'
import { WalletController } from './wallet.controller'

@Module({
  imports: [InteractionWalletModule],
  controllers: [WalletController],
})
export class AdminWalletModule {}
