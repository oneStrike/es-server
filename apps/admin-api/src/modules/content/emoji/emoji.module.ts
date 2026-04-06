import { EmojiModule as LibEmojiModule } from '@libs/interaction/emoji/emoji.module';
import { Module } from '@nestjs/common'
import { EmojiAssetController } from './emoji-asset.controller'
import { EmojiPackController } from './emoji-pack.controller'

@Module({
  imports: [LibEmojiModule],
  controllers: [EmojiPackController, EmojiAssetController],
})
export class ContentEmojiModule {}
