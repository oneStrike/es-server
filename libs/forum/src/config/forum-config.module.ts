import { CacheModule } from '@nestjs/cache-manager'
import { Module } from '@nestjs/common'
import { ForumConfigCacheService } from './forum-config-cache.service'
import { ForumConfigService } from './forum-config.service'

@Module({
  imports: [CacheModule.register()],
  controllers: [],
  providers: [ForumConfigService, ForumConfigCacheService],
  exports: [ForumConfigService, ForumConfigCacheService],
})
export class ForumConfigModule {}
