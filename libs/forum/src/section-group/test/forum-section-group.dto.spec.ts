describe('forum section group dto module', () => {
  it('imports without circular dependency crashes', async () => {
    await expect(import('../dto/forum-section-group.dto')).resolves.toMatchObject({
      PublicForumSectionGroupListItemDto: expect.any(Function),
    })
  })
})
