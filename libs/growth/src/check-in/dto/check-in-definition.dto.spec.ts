import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import {
  CheckInMakeupPeriodTypeEnum,
  CheckInPatternRewardRuleTypeEnum,
} from '../check-in.constant'
import { UpdateCheckInConfigDto } from './check-in-definition.dto'

async function transformDto<T extends object>(
  metatype: new () => T,
  value: Record<string, unknown>,
): Promise<T> {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
  })

  return pipe.transform(value, {
    metatype,
    type: 'body',
  } as never)
}

describe('UpdateCheckInConfigDto pattern reward rules contract', () => {
  it('keeps optional weekday and monthDay fields when transforming request body', async () => {
    const dto = await transformDto(UpdateCheckInConfigDto, {
      isEnabled: true,
      makeupPeriodType: CheckInMakeupPeriodTypeEnum.MONTHLY,
      periodicAllowance: 2,
      patternRewardRules: [
        {
          patternType: CheckInPatternRewardRuleTypeEnum.MONTH_DAY,
          monthDay: 29,
          rewardItems: [
            {
              assetType: 1,
              assetKey: '',
              amount: 2,
            },
          ],
        },
        {
          patternType: CheckInPatternRewardRuleTypeEnum.WEEKDAY,
          weekday: 3,
          rewardItems: [
            {
              assetType: 1,
              assetKey: '',
              amount: 2,
            },
          ],
        },
      ],
    })

    expect(dto.patternRewardRules?.[0]).toMatchObject({
      patternType: CheckInPatternRewardRuleTypeEnum.MONTH_DAY,
      monthDay: 29,
    })
    expect(dto.patternRewardRules?.[1]).toMatchObject({
      patternType: CheckInPatternRewardRuleTypeEnum.WEEKDAY,
      weekday: 3,
    })
  })
})
