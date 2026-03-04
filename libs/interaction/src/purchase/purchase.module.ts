import { ContentPermissionModule } from '@libs/content/permission'
import { UserPointModule } from '@libs/user/point'
import { Module } from '@nestjs/common'
import { PurchaseService } from './purchase.service'

@Module({
  imports: [ContentPermissionModule, UserPointModule],
  providers: [PurchaseService],
  exports: [PurchaseService],
})
export class PurchaseModule {}
