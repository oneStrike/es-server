import { Module } from '@nestjs/common'
import { ForumSensitiveWordCacheService } from './sensitive-word-cache.service'
import { ForumSensitiveWordDetectService } from './sensitive-word-detect.service'
import { ForumSensitiveWordStatisticsService } from './sensitive-word-statistics.service'
import { ForumSensitiveWordService } from './sensitive-word.service'

@Module({
  imports: [],
  controllers: [],
  providers: [
    ForumSensitiveWordService,
    ForumSensitiveWordDetectService,
    ForumSensitiveWordCacheService,
    ForumSensitiveWordStatisticsService,
  ],
  exports: [
    ForumSensitiveWordService,
    ForumSensitiveWordDetectService,
    ForumSensitiveWordCacheService,
    ForumSensitiveWordStatisticsService,
  ],
})
export class ForumSensitiveWordModule {}
