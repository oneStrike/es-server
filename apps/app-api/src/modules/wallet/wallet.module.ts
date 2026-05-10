import { UserAssetsModule } from '@libs/interaction/user-assets/user-assets.module'
import { WalletModule as InteractionWalletModule } from '@libs/interaction/wallet/wallet.module'
import { Module } from '@nestjs/common'
import { WalletController } from './wallet.controller'

@Module({
  imports: [InteractionWalletModule, UserAssetsModule],
  controllers: [WalletController],
})
export class AppWalletModule {}
