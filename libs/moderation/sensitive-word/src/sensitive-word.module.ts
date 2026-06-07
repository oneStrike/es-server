import { SystemConfigModule } from '@libs/system-config/system-config.module'
import { Module } from '@nestjs/common'
import { SensitiveWordCacheService } from './sensitive-word-cache.service'
import { SensitiveWordDetectService } from './sensitive-word-detect.service'
import { SensitiveWordReviewPolicyService } from './sensitive-word-review-policy.service'
import { SensitiveWordStatisticsService } from './sensitive-word-statistics.service'
import { SensitiveWordService } from './sensitive-word.service'

@Module({
  imports: [SystemConfigModule],
  controllers: [],
  providers: [
    SensitiveWordService,
    SensitiveWordDetectService,
    SensitiveWordCacheService,
    SensitiveWordReviewPolicyService,
    SensitiveWordStatisticsService,
  ],
  exports: [
    SensitiveWordService,
    SensitiveWordDetectService,
    SensitiveWordCacheService,
    SensitiveWordReviewPolicyService,
    SensitiveWordStatisticsService,
  ],
})
export class SensitiveWordModule {}
