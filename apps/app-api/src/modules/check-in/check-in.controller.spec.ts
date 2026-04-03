import { PATH_METADATA } from '@nestjs/common/constants'
import { CheckInController } from './check-in.controller'

describe('app CheckInController metadata', () => {
  it('registers stable route segments for check-in reads and actions', () => {
    const getSummaryHandler = Object.getOwnPropertyDescriptor(
      CheckInController.prototype,
      'getSummary',
    )?.value
    const getCalendarHandler = Object.getOwnPropertyDescriptor(
      CheckInController.prototype,
      'getCalendar',
    )?.value
    const getMyRecordsHandler = Object.getOwnPropertyDescriptor(
      CheckInController.prototype,
      'getMyRecords',
    )?.value
    const signHandler = Object.getOwnPropertyDescriptor(
      CheckInController.prototype,
      'sign',
    )?.value
    const makeupHandler = Object.getOwnPropertyDescriptor(
      CheckInController.prototype,
      'makeup',
    )?.value

    expect(Reflect.getMetadata(PATH_METADATA, CheckInController)).toBe(
      'app/check-in',
    )
    expect(Reflect.getMetadata(PATH_METADATA, getSummaryHandler)).toBe(
      'summary',
    )
    expect(Reflect.getMetadata(PATH_METADATA, getCalendarHandler)).toBe(
      'calendar',
    )
    expect(Reflect.getMetadata(PATH_METADATA, getMyRecordsHandler)).toBe(
      'my/page',
    )
    expect(Reflect.getMetadata(PATH_METADATA, signHandler)).toBe('sign')
    expect(Reflect.getMetadata(PATH_METADATA, makeupHandler)).toBe('makeup')
  })
})
