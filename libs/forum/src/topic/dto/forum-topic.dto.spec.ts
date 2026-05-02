import 'reflect-metadata'
import { DECORATORS } from '@nestjs/swagger/dist/constants'

describe('forum-topic dto html contract', () => {
  it('documents create topic html as the only write contract', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { CreateUserForumTopicDto } = require('./forum-topic.dto')
    const htmlMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      CreateUserForumTopicDto.prototype,
      'html',
    ) as {
      description?: string
      required?: boolean
    }
    const bodyModeMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      CreateUserForumTopicDto.prototype,
      'bodyMode',
    )

    process.env.NODE_ENV = originalNodeEnv

    expect(htmlMetadata?.description).toBe(
      '正文 HTML；唯一写入合同，纯文本编辑器也需输出最小 HTML',
    )
    expect(htmlMetadata?.required).toBe(true)
    expect(bodyModeMetadata).toBeUndefined()
  })

  it('documents update topic html as the only write contract', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { UpdateForumTopicDto } = require('./forum-topic.dto')
    const htmlMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      UpdateForumTopicDto.prototype,
      'html',
    ) as {
      description?: string
      required?: boolean
    }
    const plainTextMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      UpdateForumTopicDto.prototype,
      'plainText',
    )

    process.env.NODE_ENV = originalNodeEnv

    expect(htmlMetadata?.description).toBe(
      '正文 HTML；唯一写入合同，纯文本编辑器也需输出最小 HTML',
    )
    expect(plainTextMetadata).toBeUndefined()
  })

  it('does not expose topic bodyTokens in public topic dto', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { PublicForumTopicDetailDto } = require('./forum-topic.dto')
    const metadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      PublicForumTopicDetailDto.prototype,
      'bodyTokens',
    )

    process.env.NODE_ENV = originalNodeEnv

    expect(metadata).toBeUndefined()
  })

  it('documents public topic list preview as structured contentPreview only', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { PublicForumTopicPageItemDto } = require('./forum-topic.dto')
    const contentPreviewMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      PublicForumTopicPageItemDto.prototype,
      'contentPreview',
    ) as {
      description?: string
      required?: boolean
    }
    const contentSnippetMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      PublicForumTopicPageItemDto.prototype,
      'contentSnippet',
    )

    process.env.NODE_ENV = originalNodeEnv

    expect(contentPreviewMetadata?.description).toBe(
      '主题列表预览；包含普通文本、@用户、#话题、表情片段',
    )
    expect(contentPreviewMetadata?.required).toBe(true)
    expect(contentSnippetMetadata).toBeUndefined()
  })

  it('documents topic preview emoji segment identity fields without display urls', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { ForumTopicContentPreviewSegmentDto } = require('./forum-topic.dto')
    const typeMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      ForumTopicContentPreviewSegmentDto.prototype,
      'type',
    ) as {
      description?: string
    }
    const kindMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      ForumTopicContentPreviewSegmentDto.prototype,
      'kind',
    )
    const unicodeSequenceMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      ForumTopicContentPreviewSegmentDto.prototype,
      'unicodeSequence',
    )
    const shortcodeMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      ForumTopicContentPreviewSegmentDto.prototype,
      'shortcode',
    )
    const emojiAssetIdMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      ForumTopicContentPreviewSegmentDto.prototype,
      'emojiAssetId',
    )
    const imageUrlMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      ForumTopicContentPreviewSegmentDto.prototype,
      'imageUrl',
    )
    const staticUrlMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      ForumTopicContentPreviewSegmentDto.prototype,
      'staticUrl',
    )
    const isAnimatedMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      ForumTopicContentPreviewSegmentDto.prototype,
      'isAnimated',
    )
    const ariaLabelMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      ForumTopicContentPreviewSegmentDto.prototype,
      'ariaLabel',
    )

    process.env.NODE_ENV = originalNodeEnv

    expect(typeMetadata?.description).toContain('emoji=表情')
    expect(kindMetadata).toBeDefined()
    expect(unicodeSequenceMetadata).toBeDefined()
    expect(shortcodeMetadata).toBeDefined()
    expect(emojiAssetIdMetadata).toBeDefined()
    expect(imageUrlMetadata).toBeUndefined()
    expect(staticUrlMetadata).toBeUndefined()
    expect(isAnimatedMetadata).toBeUndefined()
    expect(ariaLabelMetadata).toBeUndefined()
  })

  it('documents admin topic page user and section summaries', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { AdminForumTopicPageItemDto } = require('./forum-topic.dto')
    const userSummaryMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      AdminForumTopicPageItemDto.prototype,
      'userSummary',
    ) as {
      nullable?: boolean
      required?: boolean
    }
    const sectionSummaryMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      AdminForumTopicPageItemDto.prototype,
      'sectionSummary',
    ) as {
      nullable?: boolean
      required?: boolean
    }

    process.env.NODE_ENV = originalNodeEnv

    expect(userSummaryMetadata?.required).toBe(false)
    expect(userSummaryMetadata?.nullable).toBe(true)
    expect(sectionSummaryMetadata?.required).toBe(false)
    expect(sectionSummaryMetadata?.nullable).toBe(true)
  })

  it('documents admin topic detail nullable user and auditor summary', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { AdminForumTopicDetailDto } = require('./forum-topic.dto')
    const {
      InteractionActorSummaryDto,
    } = require('@libs/interaction/summary/dto/interaction-summary.dto')
    const userMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      AdminForumTopicDetailDto.prototype,
      'user',
    ) as {
      nullable?: boolean
      required?: boolean
    }
    const auditorSummaryMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      AdminForumTopicDetailDto.prototype,
      'auditorSummary',
    ) as {
      nullable?: boolean
      required?: boolean
    }
    const avatarMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      InteractionActorSummaryDto.prototype,
      'avatar',
    )
    const avatarUrlMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      InteractionActorSummaryDto.prototype,
      'avatarUrl',
    )

    process.env.NODE_ENV = originalNodeEnv

    expect(userMetadata?.required).toBe(false)
    expect(userMetadata?.nullable).toBe(true)
    expect(auditorSummaryMetadata?.required).toBe(false)
    expect(auditorSummaryMetadata?.nullable).toBe(true)
    expect(avatarMetadata).toBeDefined()
    expect(avatarUrlMetadata).toBeUndefined()
  })
})
