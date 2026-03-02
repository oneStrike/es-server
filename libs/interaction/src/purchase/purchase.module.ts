import { UserPermissionModule } from '@libs/user/permission'
import { UserPointModule } from '@libs/user/point'
import { Module } from '@nestjs/common'
import { PurchaseService } from './purchase.service'

@Module({
  imports: [UserPermissionModule, UserPointModule],
  providers: [PurchaseService],
  exports: [PurchaseService],
})
export class PurchaseModule {}
