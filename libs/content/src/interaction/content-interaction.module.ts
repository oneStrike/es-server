import { InteractionModule } from '@libs/interaction'
import { UserGrowthRewardModule } from '@libs/user/growth-reward'
import { Module } from '@nestjs/common'
import { ContentInteractionEventHandler } from './content-interaction.handler'

@Module({
  imports: [
    InteractionModule,
    UserGrowthRewardModule,
  ],
  providers: [ContentInteractionEventHandler],
  exports: [ContentInteractionEventHandler],
})
export class ContentInteractionModule {}
