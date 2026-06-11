import { JsonProperty, NumberProperty, StringProperty } from '@libs/platform/decorators'
import { ApiHideProperty, IntersectionType, PickType } from '@nestjs/swagger'
import { ValidateBy } from 'class-validator'

/**
 * 日期范围
 */
export class DateRangeDto {
  @StringProperty({
    description: '开始时间',
    example: '2025-05-29',
    required: false,
    type: 'ISO8601',
  })
  startDate?: string

  @StringProperty({
    description: '结束时间',
    example: '2025-05-29',
    required: false,
    type: 'ISO8601',
  })
  endDate?: string
}

export class PageDto extends DateRangeDto {
  @NumberProperty({
    description: '单页大小，最大500，默认15',
    example: 15,
    max: 500,
    min: 1,
    required: false,
    default: 15,
  })
  pageSize?: number

  @NumberProperty({
    description: '当前页码（从1开始）',
    example: 1,
    min: 1,
    required: false,
    default: 1,
  })
  pageIndex?: number

  @JsonProperty({
    description: '排序字段，json格式',
    // prettier ignore
    example: "{id:'desc'}",
    required: false,
  })
  orderBy?: string
}

export class ForbiddenOffsetPaginationFieldsDto {
  @ApiHideProperty()
  @ValidateBy(
    {
      name: 'isAbsent',
      validator: {
        validate: (value: unknown) => value === undefined,
      },
    },
    { message: 'cursor 分页不支持 pageIndex 参数' },
  )
  pageIndex?: never

  @ApiHideProperty()
  @ValidateBy(
    {
      name: 'isAbsent',
      validator: {
        validate: (value: unknown) => value === undefined,
      },
    },
    { message: 'cursor 分页不支持 orderBy 参数' },
  )
  orderBy?: never

  @ApiHideProperty()
  @ValidateBy(
    {
      name: 'isAbsent',
      validator: {
        validate: (value: unknown) => value === undefined,
      },
    },
    { message: 'cursor 分页不支持 startDate 参数' },
  )
  startDate?: never

  @ApiHideProperty()
  @ValidateBy(
    {
      name: 'isAbsent',
      validator: {
        validate: (value: unknown) => value === undefined,
      },
    },
    { message: 'cursor 分页不支持 endDate 参数' },
  )
  endDate?: never
}

export class CursorPageSizeDto extends IntersectionType(
  PickType(PageDto, ['pageSize'] as const),
  ForbiddenOffsetPaginationFieldsDto,
) {}

export class CursorPageDto extends CursorPageSizeDto {
  @StringProperty({
    description: '游标；首次请求不传，后续请求传上次响应 nextCursor',
    example: 'eyJpZCI6MTAwfQ',
    required: false,
  })
  cursor?: string
}
