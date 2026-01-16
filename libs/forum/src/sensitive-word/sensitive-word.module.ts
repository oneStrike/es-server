import { Module } from '@nestjs/common'
import { SensitiveWordCacheService } from './sensitive-word-cache.service'
import { ForumSensitiveWordDetectService } from './sensitive-word-detect.service'
import { SensitiveWordStatisticsService } from './sensitive-word-statistics.service'
import { ForumSensitiveWordService } from './sensitive-word.service'

@Module({
  imports: [],
  controllers: [],
  providers: [
    ForumSensitiveWordService,
    ForumSensitiveWordDetectService,
    SensitiveWordCacheService,
    SensitiveWordStatisticsService,
  ],
  exports: [
    ForumSensitiveWordService,
    ForumSensitiveWordDetectService,
    SensitiveWordCacheService,
    SensitiveWordStatisticsService,
  ],
})
export class ForumSensitiveWordModule {}
