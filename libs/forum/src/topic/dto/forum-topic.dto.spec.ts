import 'reflect-metadata'

import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { AuditStatusEnum } from '@libs/platform/constant'
import { UpdateForumTopicAuditStatusDto } from './forum-topic.dto'

describe('UpdateForumTopicAuditStatusDto validation', () => {
  it('keeps auditReason request validation enabled when reused from base topic fields', async () => {
    const validTextReason = plainToInstance(UpdateForumTopicAuditStatusDto, {
      auditReason: '内容重复',
      auditStatus: AuditStatusEnum.REJECTED,
      id: 1,
    })
    const validNullReason = plainToInstance(UpdateForumTopicAuditStatusDto, {
      auditReason: null,
      auditStatus: AuditStatusEnum.APPROVED,
      id: 1,
    })
    const invalid = plainToInstance(UpdateForumTopicAuditStatusDto, {
      auditReason: 'x'.repeat(501),
      auditStatus: AuditStatusEnum.REJECTED,
      id: 1,
    })
    const missingReason = plainToInstance(UpdateForumTopicAuditStatusDto, {
      auditStatus: AuditStatusEnum.APPROVED,
      id: 1,
    })

    expect(await validate(validTextReason)).toHaveLength(0)
    expect(await validate(validNullReason)).toHaveLength(0)
    expect(await validate(invalid)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'auditReason' }),
      ]),
    )
    expect(await validate(missingReason)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'auditReason' }),
      ]),
    )
  })
})
