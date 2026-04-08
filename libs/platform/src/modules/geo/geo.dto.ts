import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property'
import { DateProperty } from '@libs/platform/decorators/validate/date-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { StringProperty } from '@libs/platform/decorators/validate/string-property'

/**
 * ip2region 运行状态 DTO。
 * 用于后台查看当前进程已加载的属地库与热切换状态。
 */
export class Ip2regionRuntimeStatusDto {
  @BooleanProperty({
    description: '当前进程是否已加载可用属地库',
    example: true,
    required: true,
    validation: false,
  })
  ready!: boolean

  @BooleanProperty({
    description: '当前是否正在执行热切换',
    example: false,
    required: true,
    validation: false,
  })
  reloading!: boolean

  @StringProperty({
    description: '当前生效库来源',
    example: 'managed-active',
    required: true,
    validation: false,
  })
  source!: string

  @StringProperty({
    description: '当前生效文件名',
    example: '20260408-120000-ip2region_v4.xdb',
    required: false,
    validation: false,
  })
  fileName?: string

  @StringProperty({
    description: '当前生效文件绝对路径',
    example: 'D:/code/es/es-server/uploads/ip2region/active/20260408-120000-ip2region_v4.xdb',
    required: false,
    validation: false,
  })
  filePath?: string

  @NumberProperty({
    description: '当前生效文件大小（字节）',
    example: 10485760,
    required: false,
    validation: false,
  })
  fileSize?: number

  @DateProperty({
    description: '当前生效时间',
    example: '2026-04-08T12:00:00.000Z',
    required: false,
    validation: false,
  })
  activatedAt?: Date

  @StringProperty({
    description: 'ip2region 专用存储根目录',
    example: 'D:/code/es/es-server/uploads/ip2region',
    required: false,
    validation: false,
  })
  storageDir?: string
}
