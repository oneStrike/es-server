import { AuditRoleEnum, AuditStatusEnum } from '@libs/platform/constant'
import { ForumHashtagController } from './forum-hashtag.controller'

describe('ForumHashtagController', () => {
  it('passes admin auditRole when updating hashtag audit status', async () => {
    const forumHashtagService = {
      updateHashtagAuditStatus: jest.fn().mockResolvedValue(true),
    }
    const controller = new ForumHashtagController(
      forumHashtagService as never,
    )

    await expect(
      controller.updateAuditStatus(
        {
          id: 77,
          auditStatus: AuditStatusEnum.APPROVED,
          auditReason: '通过',
        },
        9,
      ),
    ).resolves.toBe(true)

    expect(forumHashtagService.updateHashtagAuditStatus).toHaveBeenCalledWith(
      {
        id: 77,
        auditStatus: AuditStatusEnum.APPROVED,
        auditReason: '通过',
      },
      {
        auditById: 9,
        auditRole: AuditRoleEnum.ADMIN,
      },
    )
  })
})
