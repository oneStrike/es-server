import { AuditStatusEnum } from '@libs/platform/constant'
import { CommentController } from './comment.controller'

describe('CommentController admin moderation routing', () => {
  function createController(params: {
    commentService: {
      updateCommentAuditStatus: jest.Mock
      updateCommentHidden: jest.Mock
    }
    governanceService: {
      updateCommentAuditStatus: jest.Mock
      updateCommentHidden: jest.Mock
    }
  }) {
    return Reflect.construct(CommentController, [
      params.commentService,
      params.governanceService,
    ]) as CommentController
  }

  it('delegates admin comment audit updates to governance service', async () => {
    const commentService = {
      updateCommentAuditStatus: jest.fn().mockResolvedValue(true),
      updateCommentHidden: jest.fn().mockResolvedValue(true),
    }
    const governanceService = {
      updateCommentAuditStatus: jest.fn().mockResolvedValue(true),
      updateCommentHidden: jest.fn().mockResolvedValue(true),
    }
    const controller = createController({
      commentService,
      governanceService,
    })

    await controller.updateAuditStatus(
      {
        id: 7,
        auditStatus: AuditStatusEnum.APPROVED,
        auditReason: '通过',
      },
      101,
    )

    expect(governanceService.updateCommentAuditStatus).toHaveBeenCalledWith(
      {
        id: 7,
        auditStatus: AuditStatusEnum.APPROVED,
        auditReason: '通过',
      },
      {
        actorType: 'admin',
        actorUserId: 101,
      },
    )
    expect(commentService.updateCommentAuditStatus).not.toHaveBeenCalled()
  })

  it('delegates admin comment hidden updates to governance service', async () => {
    const commentService = {
      updateCommentAuditStatus: jest.fn().mockResolvedValue(true),
      updateCommentHidden: jest.fn().mockResolvedValue(true),
    }
    const governanceService = {
      updateCommentAuditStatus: jest.fn().mockResolvedValue(true),
      updateCommentHidden: jest.fn().mockResolvedValue(true),
    }
    const controller = createController({
      commentService,
      governanceService,
    })

    await controller.updateHidden(
      {
        id: 9,
        isHidden: true,
      },
      202,
    )

    expect(governanceService.updateCommentHidden).toHaveBeenCalledWith(
      {
        id: 9,
        isHidden: true,
      },
      {
        actorType: 'admin',
        actorUserId: 202,
      },
    )
    expect(commentService.updateCommentHidden).not.toHaveBeenCalled()
  })
})
