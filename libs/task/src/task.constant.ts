export enum TaskTypeEnum {
  NEWBIE = 1,
  DAILY = 2,
  REPEAT = 3,
  ACTIVITY = 4,
  OPERATION = 5,
}

export enum TaskStatusEnum {
  DRAFT = 0,
  PUBLISHED = 1,
  OFFLINE = 2,
}

export enum TaskClaimModeEnum {
  AUTO = 1,
  MANUAL = 2,
}

export enum TaskCompleteModeEnum {
  AUTO = 1,
  MANUAL = 2,
}

export enum TaskAssignmentStatusEnum {
  PENDING = 0,
  IN_PROGRESS = 1,
  COMPLETED = 2,
  EXPIRED = 3,
}

export enum TaskProgressActionTypeEnum {
  CLAIM = 1,
  PROGRESS = 2,
  COMPLETE = 3,
  EXPIRE = 4,
}

export enum TaskRepeatTypeEnum {
  ONCE = 'once',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export const TaskGrowthEventKey = {
  COMPLETE: 'task.complete',
} as const

export type TaskGrowthEventKeyType =
  (typeof TaskGrowthEventKey)[keyof typeof TaskGrowthEventKey]
