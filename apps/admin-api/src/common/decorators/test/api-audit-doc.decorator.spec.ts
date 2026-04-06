import { AuditActionTypeEnum } from '@libs/platform/modules/audit'
import { DECORATORS } from '@nestjs/swagger/dist/constants'
import { ApiAuditDoc } from '../api-audit-doc.decorator'
import 'reflect-metadata'

describe('apiAuditDoc', () => {
  class DemoController {
    @ApiAuditDoc({
      summary: '创建页面配置',
      model: Boolean,
      audit: {
        actionType: AuditActionTypeEnum.CREATE,
      },
    })
    create() {}

    @ApiAuditDoc({
      summary: '修改密码',
      model: Boolean,
      audit: {
        actionType: AuditActionTypeEnum.UPDATE,
        content: '用户修改账户密码',
      },
    })
    changePassword() {}
  }

  it('defaults audit content to ApiDoc summary', () => {
    const handler = Object.getOwnPropertyDescriptor(
      DemoController.prototype,
      'create',
    )?.value

    expect(Reflect.getMetadata('audit', handler)).toEqual({
      actionType: AuditActionTypeEnum.CREATE,
      content: '创建页面配置',
    })
    expect(Reflect.getMetadata(DECORATORS.API_OPERATION, handler)).toEqual(
      expect.objectContaining({
        summary: '创建页面配置',
      }),
    )
  })

  it('allows overriding audit content without affecting ApiDoc summary', () => {
    const handler = Object.getOwnPropertyDescriptor(
      DemoController.prototype,
      'changePassword',
    )?.value

    expect(Reflect.getMetadata('audit', handler)).toEqual({
      actionType: AuditActionTypeEnum.UPDATE,
      content: '用户修改账户密码',
    })
    expect(Reflect.getMetadata(DECORATORS.API_OPERATION, handler)).toEqual(
      expect.objectContaining({
        summary: '修改密码',
      }),
    )
  })
})
