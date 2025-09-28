import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import {
  ValidateBoolean,
  ValidateDate,
  ValidateEnum,
  ValidateJson,
  ValidateNumber,
  ValidateString,
} from '@/common/decorators/validate.decorator'
import { IdDto } from '@/common/dto/id.dto'
import { PageDto } from '@/common/dto/page.dto'
import { RequestLogApiTypeEnum } from '../request-log.constant'

/**
 * 请求日志基础 DTO
 */
export class RequestLogDto extends IdDto {
  @ValidateNumber({
    min: 1,
    max: 9999999999,
    required: false,
    example: 1,
    description: '用户id',
  })
  userId?: number

  @ValidateString({
    maxLength: 255,
    required: false,
    example: 'admin',
    description: '用户名',
  })
  username?: string

  @ValidateEnum({
    enum: RequestLogApiTypeEnum,
    required: true,
    example: 'admin',
    description: '接口类型（admin/client/system等）',
  })
  apiType: string

  @ValidateString({
    maxLength: 255,
    required: true,
    example: '127.0.0.1',
    description: '用户ip',
  })
  ip: string

  @ValidateString({
    maxLength: 255,
    required: true,
    example: 'GET',
    description: '请求方法',
  })
  method: string

  @ValidateString({
    maxLength: 255,
    required: true,
    example: '/api/v1/users',
    description: '请求路径',
  })
  path: string

  @ValidateJson({
    description: '请求参数（JSON格式）',
    required: false,
  })
  params?: string

  @ValidateNumber({
    required: true,
    example: 200,
    description: '状态码',
  })
  statusCode: number

  @ValidateString({
    maxLength: 255,
    required: false,
    example: 'admin_log',
    description: '操作类型',
  })
  actionType?: string

  @ValidateBoolean({
    required: true,
    example: true,
    description: '操作是否成功',
  })
  isSuccess: boolean

  @ValidateString({
    maxLength: 255,
    required: false,
    example:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    description: '用户代理',
  })
  userAgent: string

  @ValidateJson({
    required: false,
    example: '{}',
    description: '设备信息',
  })
  device: string

  @ValidateString({
    maxLength: 255,
    required: true,
    example: '请求成功',
    description: '自定义日志内容',
  })
  content: string
}

/**
 * 查询请求日志 DTO
 */
export class QueryRequestLogDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(RequestLogDto, [
      'userId',
      'username',
      'apiType',
      'method',
      'path',
      'isSuccess',
    ]),
  ),
) {
  @ValidateDate({
    required: false,
    example: new Date(),
    description: '开始时间',
  })
  startTime?: Date

  @ValidateDate({
    required: false,
    example: new Date(),
    description: '结束时间',
  })
  endTime?: Date
}

export class RequestLogPageDto extends OmitType(RequestLogDto, [
  'params',
  'device',
]) {}
