import {
  EmojiAssetDto,
  EmojiCatalogPackDto,
  EmojiCatalogService,
  EmojiRecentItemDto,
  EmojiSceneEnum,
  QueryEmojiCatalogDto,
  QueryEmojiRecentDto,
  QueryEmojiSearchDto,
} from '@libs/interaction/emoji'
import { ApiDoc, CurrentUser, Public } from '@libs/platform/decorators'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('表情')
@Controller('app/emoji')
export class EmojiController {
  constructor(private readonly emojiCatalogService: EmojiCatalogService) {}

  private resolveScene(scene?: EmojiSceneEnum) {
    return scene ?? EmojiSceneEnum.CHAT
  }

  @Get('catalog/list')
  @ApiDoc({
    summary: '获取表情目录',
    model: EmojiCatalogPackDto,
    isArray: true,
  })
  @Public()
  async getCatalog(@Query() query: QueryEmojiCatalogDto) {
    return this.emojiCatalogService.listCatalog({
      scene: this.resolveScene(query.scene),
    })
  }

  @Get('search/list')
  @ApiDoc({
    summary: '搜索表情',
    model: EmojiAssetDto,
    isArray: true,
  })
  @Public()
  async search(@Query() query: QueryEmojiSearchDto) {
    return this.emojiCatalogService.search({
      scene: this.resolveScene(query.scene),
      q: query.q,
      limit: query.limit,
    })
  }

  @Get('recent/list')
  @ApiDoc({
    summary: '获取最近使用表情',
    model: EmojiRecentItemDto,
    isArray: true,
  })
  async recent(
    @Query() query: QueryEmojiRecentDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.emojiCatalogService.listRecent({
      userId,
      scene: this.resolveScene(query.scene),
      limit: query.limit,
    })
  }
}
