import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { BaseSensitiveWordHitDto } from '@libs/sensitive-word/dto/sensitive-word.dto'
import { BaseCommentDto } from './comment.dto'

describe('comment.dto sensitive-word hit contract', () => {
  it('transforms sensitiveWordHits into structured hit objects', () => {
    const dto = plainToInstance(BaseCommentDto, {
      sensitiveWordHits: [
        {
          word: '测试',
          start: 0,
          end: 1,
          level: 2,
          type: 5,
        },
      ],
    })

    expect(dto.sensitiveWordHits?.[0]).toBeInstanceOf(BaseSensitiveWordHitDto)
  })
})
