import { Module } from '@nestjs/common'
import { PurchaseService } from './purchase.service'

@Module({
  providers: [PurchaseService],
  exports: [PurchaseService],
})
export class PurchaseModule {}
