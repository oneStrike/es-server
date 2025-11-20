import { ValidateNumber } from '@libs/decorators'

export class DragReorderDto {
  @ValidateNumber({
    description: '拖拽的目标位置id',
    required: true,
    example: 1,
  })
  targetId!: number

  @ValidateNumber({
    description: '当前拖拽元素的id',
    required: true,
    example: 2,
  })
  dragId!: number
}
