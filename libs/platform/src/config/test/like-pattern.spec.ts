import { PgDialect, pgTable, text } from 'drizzle-orm/pg-core'

const dialect = new PgDialect()
const sampleTable = pgTable('sample_like_pattern', {
  name: text(),
})

describe('like pattern helpers', () => {
  it('escapes reserved LIKE characters', async () => {
    const likePattern = await import('../../../../../db/core/query/like-pattern')

    expect(likePattern.escapeLikePattern('a%b_c\\d')).toBe('a\\%b\\_c\\\\d')
  })

  it('builds a trimmed contains pattern by default', async () => {
    const likePattern = await import(
      '../../../../../db/core/query/like-pattern'
    )

    expect((likePattern as any).buildLikePattern?.('  a%b_c\\d  ')).toBe(
      '%a\\%b\\_c\\\\d%',
    )
  })

  it('returns undefined for blank LIKE input', async () => {
    const likePattern = await import(
      '../../../../../db/core/query/like-pattern'
    )

    expect((likePattern as any).buildLikePattern?.('   ')).toBeUndefined()
  })

  it('builds ilike SQL with escaped parameters', async () => {
    const likePattern = await import(
      '../../../../../db/core/query/like-pattern'
    )

    const condition = (likePattern as any).buildILikeCondition?.(
      sampleTable.name,
      '  a%b_c\\d  ',
    )
    const query = condition ? dialect.sqlToQuery(condition) : undefined

    expect(query).toMatchObject({
      sql: '"sample_like_pattern"."name" ilike $1',
      params: ['%a\\%b\\_c\\\\d%'],
    })
  })

  it('returns undefined ilike SQL for blank input', async () => {
    const likePattern = await import(
      '../../../../../db/core/query/like-pattern'
    )

    expect(
      (likePattern as any).buildILikeCondition?.(sampleTable.name, '   '),
    ).toBeUndefined()
  })
})
