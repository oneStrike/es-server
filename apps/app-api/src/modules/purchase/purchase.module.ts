import { PurchaseModule as PurchaseCoreModule } from '@libs/interaction'
import { Module } from '@nestjs/common'
import { PurchaseController } from './purchase.controller'

@Module({
  imports: [PurchaseCoreModule],
  controllers: [PurchaseController],
})
export class PurchaseModule {}