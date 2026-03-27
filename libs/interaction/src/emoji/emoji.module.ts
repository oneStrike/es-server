import { Module } from '@nestjs/common'
import { EmojiAssetService } from './emoji-asset.service'
import { EmojiCatalogService } from './emoji-catalog.service'
import { EmojiParserService } from './emoji-parser.service'

/**
 * 表情模块。
 * - 提供表情包管理（EmojiAssetService）、目录查询（EmojiCatalogService）和文本解析（EmojiParserService）能力。
 * - 依赖 DrizzleService 访问数据库，无其他外部模块依赖。
 */
@Module({
  providers: [EmojiCatalogService, EmojiParserService, EmojiAssetService],
  exports: [EmojiCatalogService, EmojiParserService, EmojiAssetService],
})
export class EmojiModule {}
