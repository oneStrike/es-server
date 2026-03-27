jest.mock('@db/core', () => ({
  DrizzleService: class {},
  escapeLikePattern: (value: string) => value,
}))

jest.mock('@libs/interaction/follow', () => ({
  FollowService: class {},
  FollowTargetTypeEnum: {},
}))

jest.mock('../counter', () => ({
  ForumCounterService: class {},
}))

jest.mock('../permission', () => ({
  ForumPermissionService: class {},
}))

describe('forum section service', () => {
  it('uses groupId as the swap scope when reordering sections', async () => {
    const { ForumSectionService } = await import('./forum-section.service')
    const swapField = jest.fn().mockResolvedValue(true)
    const service = new ForumSectionService(
      {
        ext: { swapField },
        schema: { forumSection: { __table: 'forumSection' } },
      } as any,
      {} as any,
      {} as any,
      {} as any,
    )

    await expect(
      service.updateSectionSort({ dragId: 11, targetId: 22 }),
    ).resolves.toBe(true)

    expect(swapField).toHaveBeenCalledWith(
      service.forumSection,
      expect.objectContaining({
        where: [{ id: 11 }, { id: 22 }],
        sourceField: 'groupId',
      }),
    )
  })
})
