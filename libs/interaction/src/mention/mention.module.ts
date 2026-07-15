import { DrizzleModule } from '@db/core'
import { EventingModule } from '@libs/eventing/eventing/eventing.module'
import { EmojiModule } from '@libs/interaction/emoji/emoji.module'
import { UserModule } from '@libs/user/user.module'
import { Module } from '@nestjs/common'
import { InteractionNotificationEventModule } from '../eventing/interaction-notification-event.module'
import { MentionService } from './mention.service'

@Module({
  imports: [
    DrizzleModule,
    EventingModule,
    EmojiModule,
    InteractionNotificationEventModule,
    UserModule,
  ],
  providers: [MentionService],
  exports: [MentionService],
})
export class MentionModule {}
