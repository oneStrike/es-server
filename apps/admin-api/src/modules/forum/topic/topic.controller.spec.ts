import 'reflect-metadata'
import { DECORATORS } from '@nestjs/swagger/dist/constants'
import { getSchemaPath } from '@nestjs/swagger'
import { IdDto } from '@libs/platform/dto'

jest.mock('ip2region.js', () => ({}))

import { ForumTopicController } from './topic.controller'

type TopicControllerPrivateApi = {
  mapTopicDetail: (topic: Record<string, unknown>) => Record<string, unknown>
}

describe('ForumTopicController detail mapping', () => {
  it('maps admin detail payload to html-only body exposure', () => {
    const controller = new ForumTopicController(
      {} as never,
      {} as never,
      {} as never,
    )

    const result = (controller as unknown as TopicControllerPrivateApi).mapTopicDetail(
      {
        id: 1,
        sectionId: 2,
        userId: 3,
        title: '主题标题',
        html: '<p>正文</p>',
      },
    )

    expect(result.html).toBe('<p>正文</p>')
    expect(result).not.toHaveProperty('bodyTokens')
  })

  it('documents admin create response data as IdDto instead of boolean', () => {
    const responseMetadata = Reflect.getMetadata(
      DECORATORS.API_RESPONSE,
      ForumTopicController.prototype.create,
    ) as Record<
      string,
      {
        content?: {
          'application/json'?: {
            schema?: {
              properties?: {
                data?: {
                  $ref?: string
                  type?: string
                }
              }
            }
          }
        }
      }
    >

    expect(
      responseMetadata?.['200']?.content?.['application/json']?.schema
        ?.properties?.data?.$ref,
    ).toBe(getSchemaPath(IdDto))
  })
})
