describe('forum DTO import regressions', () => {
  it('loads section and section-group DTO modules without decorator initialization errors', () => {
    expect(() => {
      jest.isolateModules(() => {
        require('../section/dto/forum-section.dto')
        require('../section-group/dto/forum-section-group.dto')
      })
    }).not.toThrow()
  })
})
