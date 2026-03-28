import { EnumProperty } from './enum-property'

enum TestEnum {
  ENABLED = 1,
  DISABLED = 2,
}

describe('enum property description mapping validation', () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    process.env.NODE_ENV = 'development'
  })

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  it('ignores explanatory key value text that is not an enum mapping', () => {
    expect(() =>
      EnumProperty({
        description: '成长规则类型。新增或调整规则配置时，建议优先使用 isRuleConfigurable=true 的事件编码。',
        example: TestEnum.ENABLED,
        enum: TestEnum,
      }),
    ).not.toThrow()
  })

  it('still rejects explicit enum mappings that do not match the enum', () => {
    expect(() =>
      EnumProperty({
        description: '状态（1=启用，3=禁用）',
        example: TestEnum.ENABLED,
        enum: TestEnum,
      }),
    ).toThrow('EnumProperty: description 枚举映射与 enum 不匹配')
  })
})
