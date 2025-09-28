import {
  ApiProperty,
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import {
  ValidateBoolean,
  ValidateEnum,
  ValidateJson,
  ValidateNumber,
  ValidateString,
} from '@/common/decorators/validate.decorator'
import { PageDto } from '@/common/dto/page.dto'
import {
  ActionTypeEnum,
  ApiTypeEnum,
  HttpMethodEnum,
} from '../request-log.constant'

export class RequestLogDto {
  @ValidateNumber({
    description: '主键ID',
    example: 1,
    required: true,
    min: 1,
  })
  id!: number

  @ValidateNumber({
    description: '用户ID',
    example: 1001,
    required: false,
    min: 1,
  })
  userId?: number

  @ValidateString({
    description: '用户名',
    example: 'admin001',
    required: false,
    maxLength: 50,
  })
  username?: string

  @ValidateEnum({
    description: '接口类型（admin/client/system等）',
    example: 'admin',
    required: false,
    enum: ApiTypeEnum,
  })
  apiType?: ApiTypeEnum

  @ValidateString({
    description: 'IP地址',
    example: '192.168.1.100',
    required: false,
    maxLength: 45,
  })
  ip?: string

  @ValidateEnum({
    description: '请求方法',
    example: 'POST',
    required: true,
    enum: HttpMethodEnum,
  })
  method!: HttpMethodEnum

  @ValidateString({
    description: '请求路径',
    example: '/api/admin/user/login',
    required: true,
    maxLength: 255,
  })
  path!: string

  @ValidateJson({
    description: '请求参数（JSON格式）',
    example: '{"username": "admin", "password": "***"}',
    required: false,
  })
  params?: string

  @ValidateNumber({
    description: '响应状态码',
    example: 200,
    required: false,
    min: 100,
    max: 599,
  })
  statusCode?: number

  @ValidateEnum({
    description: '操作类型',
    example: '用户登录',
    required: false,
    enum: ActionTypeEnum,
  })
  actionType?: ActionTypeEnum

  @ValidateBoolean({
    description: '操作是否成功',
    example: true,
    required: true,
  })
  isSuccess!: boolean

  @ValidateString({
    description: '设备信息（User-Agent）',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    required: false,
    maxLength: 255,
  })
  userAgent?: string

  @ValidateJson({
    description: '设备信息解析结果（JSON）',
    example: '{"browser": "Chrome", "os": "Windows", "device": "Desktop"}',
    required: false,
  })
  device?: string

  @ValidateString({
    description: '自定义日志内容',
    example: '用户admin成功登录系统',
    required: true,
  })
  content!: string

  @ApiProperty({
    description: '创建时间',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt!: Date

  @ApiProperty({
    description: '更新时间',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt!: Date
}

/**
 * 创建请求日志DTO
 */
export class CreateRequestLogDto extends OmitType(RequestLogDto, [
  'id',
  'createdAt',
  'updatedAt',
]) {}

/**
 * 请求日志分页查询DTO
 */
export class RequestLogPageDto extends IntersectionType(
  PageDto,
  PickType(PartialType(RequestLogDto), [
    'userId',
    'username',
    'ip',
    'method',
    'path',
    'statusCode',
    'apiType',
    'actionType',
    'isSuccess',
    'device',
  ]),
) {}
