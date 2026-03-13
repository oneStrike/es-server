import { ContentTypeEnum } from '@libs/platform/constant'

export enum WorkSerialStatusEnum {
  NOT_STARTED = 0,
  SERIALIZING = 1,
  COMPLETED = 2,
  PAUSED = 3,
  DISCONTINUED = 4,
}

export const WorkTypeMap = {
  [ContentTypeEnum.COMIC]: 'comic',
  [ContentTypeEnum.NOVEL]: 'novel',
} as const
