import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { EnumArrayProperty } from '../enum-array-property'
import { EnumProperty } from '../enum-property'
import 'reflect-metadata'

enum NotificationChannelEnum {
  SITE = 'SITE',
  PUSH = 'PUSH',
}

enum ModeratorPermissionEnum {
  READ = 1,
  WRITE = 2,
}

class NumericEnumDto {
  @EnumProperty({
    description: '权限',
    enum: ModeratorPermissionEnum,
  })
  permission!: ModeratorPermissionEnum
}

describe('enum property decorators', () => {
  it('数字枚举单值属性应把合法数字字符串转换为数字枚举值', () => {
    const dto = plainToInstance(NumericEnumDto, {
      permission: '2',
    })

    const errors = validateSync(dto)

    expect(dto.permission).toBe(ModeratorPermissionEnum.WRITE)
    expect(errors).toHaveLength(0)
  })

  it('枚举数组属性应导出并支持数字枚举字符串数组', () => {
    class NumericEnumArrayDto {
      @EnumArrayProperty({
        description: '权限列表',
        enum: ModeratorPermissionEnum,
        minLength: 1,
      })
      permissions!: ModeratorPermissionEnum[]
    }

    const dto = plainToInstance(NumericEnumArrayDto, {
      permissions: ['1', '2'],
    })

    const errors = validateSync(dto)

    expect(dto.permissions).toEqual([
      ModeratorPermissionEnum.READ,
      ModeratorPermissionEnum.WRITE,
    ])
    expect(errors).toHaveLength(0)
  })

  it('枚举数组属性应对字符串枚举逐项去空白后校验', () => {
    class StringEnumArrayDto {
      @EnumArrayProperty({
        description: '渠道列表',
        enum: NotificationChannelEnum,
        minLength: 1,
      })
      channels!: NotificationChannelEnum[]
    }

    const dto = plainToInstance(StringEnumArrayDto, {
      channels: [' SITE ', 'PUSH'],
    })

    const errors = validateSync(dto)

    expect(dto.channels).toEqual([
      NotificationChannelEnum.SITE,
      NotificationChannelEnum.PUSH,
    ])
    expect(errors).toHaveLength(0)
  })
})
