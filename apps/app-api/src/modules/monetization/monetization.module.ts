import { MonetizationModule as InteractionMonetizationModule } from '@libs/interaction/monetization/monetization.module'
import { Module } from '@nestjs/common'
import { MonetizationController } from './monetization.controller'

@Module({
  imports: [InteractionMonetizationModule],
  controllers: [MonetizationController],
})
export class MonetizationModule {}
