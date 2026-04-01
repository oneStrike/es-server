import { PATH_METADATA } from '@nestjs/common/constants'
import { CheckInController } from './check-in.controller'

describe('app CheckInController metadata', () => {
  it('uses my/page for personal check-in record pagination', () => {
    const handler = Object.getOwnPropertyDescriptor(
      CheckInController.prototype,
      'getMyRecords',
    )?.value

    expect(
      Reflect.getMetadata(PATH_METADATA, handler),
    ).toBe('my/page')
  })
})
