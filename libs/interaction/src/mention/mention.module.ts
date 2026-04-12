import { DrizzleModule } from '@db/core'
import { EmojiModule } from '@libs/interaction/emoji/emoji.module'
import { MessageModule } from '@libs/message/message.module'
import { UserModule } from '@libs/user/user.module'
import { Module } from '@nestjs/common'
import { MentionService } from './mention.service'

@Module({
  imports: [DrizzleModule, EmojiModule, MessageModule, UserModule],
  providers: [MentionService],
  exports: [MentionService],
})
export class MentionModule {}
