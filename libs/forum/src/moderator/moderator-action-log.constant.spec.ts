import { ForumModeratorActionTypeEnum } from './moderator-action-log.constant'

describe('ForumModeratorActionTypeEnum contract', () => {
  it('keeps delete and move governance actions on their formalized contract codes', () => {
    expect(ForumModeratorActionTypeEnum.PIN_TOPIC).toBe(1)
    expect(ForumModeratorActionTypeEnum.UNPIN_TOPIC).toBe(2)
    expect(ForumModeratorActionTypeEnum.FEATURE_TOPIC).toBe(3)
    expect(ForumModeratorActionTypeEnum.UNFEATURE_TOPIC).toBe(4)
    expect(ForumModeratorActionTypeEnum.LOCK_TOPIC).toBe(5)
    expect(ForumModeratorActionTypeEnum.UNLOCK_TOPIC).toBe(6)
    expect(ForumModeratorActionTypeEnum.DELETE_TOPIC).toBe(7)
    expect(ForumModeratorActionTypeEnum.MOVE_TOPIC).toBe(8)
    expect(ForumModeratorActionTypeEnum.AUDIT_TOPIC).toBe(9)
    expect(ForumModeratorActionTypeEnum.DELETE_COMMENT).toBe(10)
    expect(ForumModeratorActionTypeEnum.HIDE_TOPIC).toBe(11)
    expect(ForumModeratorActionTypeEnum.UNHIDE_TOPIC).toBe(12)
    expect(ForumModeratorActionTypeEnum.AUDIT_COMMENT).toBe(13)
    expect(ForumModeratorActionTypeEnum.HIDE_COMMENT).toBe(14)
    expect(ForumModeratorActionTypeEnum.UNHIDE_COMMENT).toBe(15)
  })
})
