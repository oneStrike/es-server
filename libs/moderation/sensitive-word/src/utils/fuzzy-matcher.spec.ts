import { FuzzyMatcher } from './fuzzy-matcher'

describe('FuzzyMatcher', () => {
  it('matches long fuzzy words without truncating the candidate window', () => {
    const matcher = new FuzzyMatcher(2, true)
    matcher.setWords(['abcdefghijklmnop'])

    const results = matcher.match('abcxefghijklmnop')

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          word: 'abcdefghijklmnop',
        }),
      ]),
    )
  })
})
