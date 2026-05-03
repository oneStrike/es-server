import 'reflect-metadata'
import { DECORATORS } from '@nestjs/swagger/dist/constants'

type AgreementDtoModule = typeof import('./agreement.dto')

function loadAgreementDtoModule() {
  const originalNodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'
  jest.resetModules()

  const agreementDtoModule = require('./agreement.dto') as AgreementDtoModule

  process.env.NODE_ENV = originalNodeEnv
  return agreementDtoModule
}

function getPropertyMetadata(target: object, propertyKey: string) {
  return Reflect.getMetadata(
    DECORATORS.API_MODEL_PROPERTIES,
    target,
    propertyKey,
  ) as { description?: string; required?: boolean } | undefined
}

describe('agreement admin access dto contract', () => {
  it('documents reusable agreement access fields', () => {
    const { AgreementAccessFieldsDto } = loadAgreementDtoModule()

    expect(
      getPropertyMetadata(AgreementAccessFieldsDto.prototype, 'accessPath'),
    ).toMatchObject({
      description: '协议 HTML 访问路径',
      required: true,
    })
    expect(
      getPropertyMetadata(AgreementAccessFieldsDto.prototype, 'accessUrl'),
    ).toBeUndefined()
  })

  it('adds access fields to admin list items without restoring content', () => {
    const { AdminAgreementListItemDto } = loadAgreementDtoModule()

    expect(
      getPropertyMetadata(AdminAgreementListItemDto.prototype, 'accessPath'),
    ).toBeDefined()
    expect(
      getPropertyMetadata(AdminAgreementListItemDto.prototype, 'accessUrl'),
    ).toBeUndefined()
    expect(
      getPropertyMetadata(AdminAgreementListItemDto.prototype, 'content'),
    ).toBeUndefined()
  })

  it('adds access fields to admin detail payloads while keeping content', () => {
    const { AdminAgreementDetailDto } = loadAgreementDtoModule()

    expect(
      getPropertyMetadata(AdminAgreementDetailDto.prototype, 'content'),
    ).toBeDefined()
    expect(
      getPropertyMetadata(AdminAgreementDetailDto.prototype, 'accessPath'),
    ).toBeDefined()
    expect(
      getPropertyMetadata(AdminAgreementDetailDto.prototype, 'accessUrl'),
    ).toBeUndefined()
  })
})
