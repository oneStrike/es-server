import 'reflect-metadata'

import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { CreateWorkDto } from './work.dto'

function createWorkPayload(overrides: Record<string, unknown> = {}) {
  return {
    type: 1,
    name: '测试作品',
    cover: 'https://example.com/cover.jpg',
    description: '测试简介',
    language: 'zh-CN',
    region: 'CN',
    serialStatus: 1,
    isPublished: true,
    isRecommended: false,
    isHot: false,
    isNew: false,
    viewRule: 0,
    chapterPrice: 0,
    canComment: true,
    recommendWeight: 1,
    authorIds: [1],
    categoryIds: [2],
    tagIds: [3],
    ...overrides,
  }
}

function validateCreateWork(payload: Record<string, unknown>) {
  return validateSync(plainToInstance(CreateWorkDto, payload), {
    forbidUnknownValues: false,
  })
}

function validationProperties(errors: Array<{ property: string }>) {
  return errors.map((item) => item.property)
}

describe('CreateWorkDto relation validation', () => {
  it.each(['authorIds', 'categoryIds', 'tagIds'])(
    'rejects empty %s',
    (fieldName) => {
      const errors = validateCreateWork(
        createWorkPayload({ [fieldName]: [] }),
      )

      expect(validationProperties(errors)).toContain(fieldName)
    },
  )

  it('accepts one relation id for each required relation group', () => {
    const errors = validateCreateWork(createWorkPayload())

    expect(errors).toHaveLength(0)
  })
})
