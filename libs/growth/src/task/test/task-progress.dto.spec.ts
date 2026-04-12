import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import 'reflect-metadata'
import { TaskProgressDto } from '../dto/task.dto'

describe('task progress dto', () => {
  it('允许正整数进度增量', () => {
    const dto = plainToInstance(TaskProgressDto, {
      taskId: 1,
      delta: 1,
    })

    const errors = validateSync(dto)

    expect(dto.delta).toBe(1)
    expect(errors).toHaveLength(0)
  })

  it('允许合法数字字符串被转换为正整数', () => {
    const dto = plainToInstance(TaskProgressDto, {
      taskId: 1,
      delta: '2',
    })

    const errors = validateSync(dto)

    expect(dto.delta).toBe(2)
    expect(errors).toHaveLength(0)
  })

  it('拒绝 0、负数和小数进度增量', () => {
    const zeroDto = plainToInstance(TaskProgressDto, {
      taskId: 1,
      delta: 0,
    })
    const negativeDto = plainToInstance(TaskProgressDto, {
      taskId: 1,
      delta: -1,
    })
    const decimalDto = plainToInstance(TaskProgressDto, {
      taskId: 1,
      delta: 1.5,
    })

    const zeroErrors = validateSync(zeroDto)
    const negativeErrors = validateSync(negativeDto)
    const decimalErrors = validateSync(decimalDto)

    expect(zeroErrors).toHaveLength(1)
    expect(negativeErrors).toHaveLength(1)
    expect(decimalErrors).toHaveLength(1)
  })
})
