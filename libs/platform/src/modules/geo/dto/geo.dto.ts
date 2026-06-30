import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { GEO_RUNTIME_SOURCE } from '../geo.constant'

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

  @EnumProperty({
    description:
      '生效库来源（托管 active 目录；环境变量显式路径；仓库默认路径；无可用属地库）',
    enum: GEO_RUNTIME_SOURCE,
    example: GEO_RUNTIME_SOURCE.MANAGED_ACTIVE,
    required: true,
    validation: false,
  })
  source!: (typeof GEO_RUNTIME_SOURCE)[keyof typeof GEO_RUNTIME_SOURCE]

  @StringProperty({
    description: '当前生效文件名',
    example: '20260408-120000-ip2region_v4.xdb',
    nullable: true,
    validation: false,
  })
  fileName!: string | null

  @StringProperty({
    description: '当前生效文件绝对路径',
    example:
      'D:/code/es/es-server/uploads/ip2region/active/20260408-120000-ip2region_v4.xdb',
    nullable: true,
    validation: false,
  })
  filePath!: string | null

  @NumberProperty({
    description: '当前生效文件大小（字节）',
    example: 10485760,
    nullable: true,
    validation: false,
  })
  fileSize!: number | null

  @DateProperty({
    description: '当前生效时间',
    example: '2026-04-08T12:00:00.000Z',
    nullable: true,
    validation: false,
  })
  activatedAt!: Date | null

  @StringProperty({
    description: 'ip2region 专用存储根目录',
    example: 'D:/code/es/es-server/uploads/ip2region',
    required: true,
    validation: false,
  })
  storageDir!: string
}
