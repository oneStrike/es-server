import { InteractionModule } from '@libs/interaction'
import { UserGrowthRewardModule } from '@libs/user/growth-reward'
import { Module } from '@nestjs/common'
import { ForumUserActionLogModule } from '../action-log/action-log.module'
import { ForumCounterModule } from '../counter'
import { ForumInteractionEventHandler } from './forum-interaction.handler'

@Module({
  imports: [
    InteractionModule,
    UserGrowthRewardModule,
    ForumCounterModule,
    ForumUserActionLogModule,
  ],
  providers: [ForumInteractionEventHandler],
  exports: [ForumInteractionEventHandler],
})
export class ForumInteractionModule {}
