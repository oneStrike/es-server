import { Module } from '@nestjs/common'
import { SensitiveWordCacheService } from './sensitive-word-cache.service'
import { SensitiveWordDetectService } from './sensitive-word-detect.service'
import { SensitiveWordStatisticsService } from './sensitive-word-statistics.service'
import { SensitiveWordService } from './sensitive-word.service'

@Module({
  imports: [],
  controllers: [],
  providers: [
    SensitiveWordService,
    SensitiveWordDetectService,
    SensitiveWordCacheService,
    SensitiveWordStatisticsService,
  ],
  exports: [
    SensitiveWordService,
    SensitiveWordDetectService,
    SensitiveWordCacheService,
    SensitiveWordStatisticsService,
  ],
})
export class SensitiveWordModule {}
