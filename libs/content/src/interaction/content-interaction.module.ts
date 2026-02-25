import { Module } from '@nestjs/common'
import { InteractionModule } from '@libs/interaction'
import { UserGrowthEventModule } from '@libs/user/growth-event'
import { ContentInteractionEventHandler } from './content-interaction.handler'

@Module({
  imports: [
    InteractionModule,
    UserGrowthEventModule,
  ],
  providers: [ContentInteractionEventHandler],
  exports: [ContentInteractionEventHandler],
})
export class ContentInteractionModule {}
