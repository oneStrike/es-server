import 'reflect-metadata'
import { DECORATORS } from '@nestjs/swagger/dist/constants'

function getSwaggerPropertyMetadata(dto: object, propertyKey: string) {
  return Reflect.getMetadata(
    DECORATORS.API_MODEL_PROPERTIES,
    dto,
    propertyKey,
  ) as {
    description?: string
    nullable?: boolean
    required?: boolean
  }
}

function loadReportDtoForSwagger() {
  const originalNodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'
  jest.resetModules()
  const dto = require('./report.dto')
  process.env.NODE_ENV = originalNodeEnv
  return dto
}

describe('report.dto summary contract', () => {
  it('documents my report list target and scene summaries', () => {
    const { MyReportPageItemDto } = loadReportDtoForSwagger()

    const targetMetadata = getSwaggerPropertyMetadata(
      MyReportPageItemDto.prototype,
      'targetSummary',
    )
    const sceneMetadata = getSwaggerPropertyMetadata(
      MyReportPageItemDto.prototype,
      'sceneSummary',
    )

    expect(targetMetadata?.description).toBe('举报目标展示摘要')
    expect(targetMetadata?.nullable).toBe(true)
    expect(targetMetadata?.required).toBe(false)
    expect(sceneMetadata?.description).toBe('举报业务场景展示摘要')
    expect(sceneMetadata?.nullable).toBe(true)
  })

  it('documents admin report list actor, target, and scene summaries', () => {
    const { AdminReportPageItemDto } = loadReportDtoForSwagger()

    const reporterMetadata = getSwaggerPropertyMetadata(
      AdminReportPageItemDto.prototype,
      'reporterSummary',
    )
    const handlerMetadata = getSwaggerPropertyMetadata(
      AdminReportPageItemDto.prototype,
      'handlerSummary',
    )
    const targetMetadata = getSwaggerPropertyMetadata(
      AdminReportPageItemDto.prototype,
      'targetSummary',
    )
    const sceneMetadata = getSwaggerPropertyMetadata(
      AdminReportPageItemDto.prototype,
      'sceneSummary',
    )

    expect(reporterMetadata?.description).toBe('举报人展示摘要')
    expect(reporterMetadata?.nullable).toBe(true)
    expect(handlerMetadata?.description).toBe('处理人展示摘要')
    expect(handlerMetadata?.nullable).toBe(true)
    expect(targetMetadata?.description).toBe('举报目标展示摘要')
    expect(targetMetadata?.nullable).toBe(true)
    expect(sceneMetadata?.description).toBe('举报业务场景展示摘要')
    expect(sceneMetadata?.nullable).toBe(true)
  })

  it('documents report detail comment summary for comment targets', () => {
    const { AdminReportDetailDto, MyReportDetailDto } =
      loadReportDtoForSwagger()

    const adminMetadata = getSwaggerPropertyMetadata(
      AdminReportDetailDto.prototype,
      'commentSummary',
    )
    const myMetadata = getSwaggerPropertyMetadata(
      MyReportDetailDto.prototype,
      'commentSummary',
    )

    expect(adminMetadata?.description).toBe(
      '被举报评论展示摘要；仅举报目标为评论时返回',
    )
    expect(adminMetadata?.nullable).toBe(true)
    expect(myMetadata?.description).toBe(
      '被举报评论展示摘要；仅举报目标为评论时返回',
    )
    expect(myMetadata?.nullable).toBe(true)
  })
})
