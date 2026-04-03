import { DateProperty, NumberProperty } from '@libs/platform/decorators'

export class BaseUserBadgeAssignmentDto {
  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @NumberProperty({
    description: '徽章ID',
    example: 1,
    required: true,
  })
  badgeId!: number

  @DateProperty({
    description: '获得时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
  })
  createdAt!: Date
}
