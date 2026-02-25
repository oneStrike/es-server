import { InteractionModule } from '@libs/interaction'
import { UserGrowthEventModule } from '@libs/user/growth-event'
import { Module } from '@nestjs/common'
import { ForumUserActionLogModule } from '../action-log/action-log.module'
import { ForumCounterModule } from '../counter'
import { ForumInteractionEventHandler } from './forum-interaction.handler'

@Module({
  imports: [
    InteractionModule,
    UserGrowthEventModule,
    ForumCounterModule,
    ForumUserActionLogModule,
  ],
  providers: [ForumInteractionEventHandler],
  exports: [ForumInteractionEventHandler],
})
export class ForumInteractionModule {}
