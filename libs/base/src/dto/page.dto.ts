import {
  JsonProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'

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
    description: '当前页码',
    example: 0,
    min: 0,
    required: false,
    default: 0,
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
