import {
  ApiTypeEnum,
  HttpMethodEnum,
} from '@libs/platform/constant'
import {
  BooleanProperty,
  EnumProperty,
  JsonProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { AuditActionTypeEnum } from '../audit-action.constant'

export class BaseAuditDto extends BaseDto {
  @NumberProperty({
    description: '用户ID',
    example: 1001,
    required: false,
    min: 1,
  })
  userId?: number

  @StringProperty({
    description: '用户名',
    example: 'admin001',
    required: false,
    maxLength: 50,
  })
  username?: string

  @EnumProperty({
    description: '接口类型（1=管理端；2=应用端；3=系统端；4=公共端）',
    example: ApiTypeEnum.ADMIN,
    required: false,
    enum: ApiTypeEnum,
  })
  apiType?: ApiTypeEnum

  @StringProperty({
    description: 'IP地址',
    example: '192.168.1.100',
    required: false,
    maxLength: 45,
  })
  ip?: string

  @EnumProperty({
    description: '请求方法（GET；POST；PUT；DELETE；PATCH；HEAD；OPTIONS）',
    example: 'POST',
    required: true,
    enum: HttpMethodEnum,
  })
  method!: HttpMethodEnum

  @StringProperty({
    description: '请求路径',
    example: '/api/admin/user/login',
    required: true,
    maxLength: 255,
  })
  path!: string

  @JsonProperty({
    description: '请求参数（JSON格式）',
    example: '{"username": "admin", "password": "***"}',
    required: false,
  })
  params?: string

  @EnumProperty({
    description:
      '操作类型（1=登录；2=登出；3=创建；4=更新；5=删除；6=上传；7=下载；8=导出；9=导入）',
    example: AuditActionTypeEnum.LOGIN,
    required: false,
    enum: AuditActionTypeEnum,
  })
  actionType?: AuditActionTypeEnum

  @BooleanProperty({
    description: '操作是否成功',
    example: true,
    required: true,
  })
  isSuccess!: boolean

  @StringProperty({
    description: '设备信息（User-Agent）',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    required: false,
    maxLength: 255,
  })
  userAgent?: string

  @JsonProperty({
    description: '设备信息解析结果（JSON）',
    example: '{"browser": "Chrome", "os": "Windows", "device": "Desktop"}',
    required: false,
  })
  device?: string

  @StringProperty({
    description: '自定义日志内容',
    example: '用户admin成功登录系统',
    required: true,
  })
  content!: string
}

export class AuditItemDto extends BaseAuditDto {
  @StringProperty({
    description: '操作类型展示文案',
    example: '用户登录',
    required: false,
    maxLength: 50,
    validation: false,
  })
  actionTypeLabel?: string
}

export class CreateRequestLogDto extends PickType(BaseAuditDto, [
  'userId',
  'content',
  'username',
  'isSuccess',
  'actionType',
] as const) {}

export class CreateRequestLogSimpleDto extends IntersectionType(
  PickType(BaseAuditDto, ['content'] as const),
  PartialType(PickType(BaseAuditDto, ['username', 'userId'] as const)),
) {}

export class AuditPageRequestDto extends IntersectionType(
  PageDto,
  PickType(PartialType(BaseAuditDto), [
    'userId',
    'username',
    'ip',
    'method',
    'path',
    'apiType',
    'actionType',
    'isSuccess',
  ] as const),
) {}
