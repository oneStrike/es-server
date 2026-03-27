import { EmojiModule as LibEmojiModule } from '@libs/interaction/emoji'
import { Module } from '@nestjs/common'
import { EmojiController } from './emoji.controller'

@Module({
  imports: [LibEmojiModule],
  controllers: [EmojiController],
})
export class EmojiModule {}
