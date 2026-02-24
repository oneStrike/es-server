import { NumberProperty } from '@libs/base/decorators'

export class DragReorderDto {
  @NumberProperty({
    description: '拖拽的目标位置id',
    required: true,
    example: 1,
  })
  targetId!: number

  @NumberProperty({
    description: '当前拖拽元素的id',
    required: true,
    example: 2,
  })
  dragId!: number
}
