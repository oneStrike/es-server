import { UserStatusEnum } from '@libs/user/app-user.constant'
import { CommentTargetTypeEnum } from './comment.constant'
import { CommentPermissionService } from './comment-permission.service'

describe('CommentPermissionService', () => {
  function createServiceHarness() {
    const forumPermissionService = {
      ensureUserCanAccessTopicSection: jest.fn().mockResolvedValue(undefined),
    }
    const drizzle = {
      db: {
        query: {
          appUser: {
            findFirst: jest.fn().mockResolvedValue({
              isEnabled: true,
              status: UserStatusEnum.NORMAL,
              level: null,
            }),
          },
        },
      },
      schema: {},
    }

    return {
      forumPermissionService,
      service: new CommentPermissionService(
        drizzle as never,
        forumPermissionService as never,
      ),
    }
  }

  it('reuses ForumPermissionService for forum topic section access checks', async () => {
    const { forumPermissionService, service } = createServiceHarness()

    await expect(
      service.ensureCanComment(7, CommentTargetTypeEnum.FORUM_TOPIC, 11),
    ).resolves.toBeUndefined()

    expect(
      forumPermissionService.ensureUserCanAccessTopicSection,
    ).toHaveBeenCalledWith(11, 7)
  })
})
