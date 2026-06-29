import 'reflect-metadata'

const SWAGGER_API_EXTRA_MODELS = 'swagger/apiExtraModels'
const SWAGGER_API_MODEL_PROPERTIES = 'swagger/apiModelProperties'

function swaggerPropertyMetadata(target: object, propertyKey: string) {
  return Reflect.getMetadata(
    SWAGGER_API_MODEL_PROPERTIES,
    target,
    propertyKey,
  ) as Record<string, unknown>
}

function swaggerExtraModels(target: Function) {
  return Reflect.getMetadata(SWAGGER_API_EXTRA_MODELS, target) as Function[]
}

describe('BaseUserNotificationDto swagger contract', () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeAll(() => {
    process.env.NODE_ENV = 'development'
  })

  afterAll(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }
  })

  it('documents data as nullable anyOf across the supported notification payload shapes', () => {
    jest.isolateModules(() => {
      const {
        BaseUserNotificationDto,
        NotificationAnnouncementSnapshotDto,
        NotificationChapterSnapshotDto,
        NotificationCommentSnapshotDto,
        NotificationTaskReminderInfoDto,
        NotificationTaskRewardSnapshotDto,
        NotificationTaskSnapshotDto,
        NotificationTopicSnapshotDto,
        NotificationWorkSnapshotDto,
      } = require('./notification.dto')

      expect(
        swaggerPropertyMetadata(BaseUserNotificationDto.prototype, 'data'),
      ).toMatchObject({
        required: true,
        nullable: true,
        anyOf: [
          {
            title: '评论回复通知数据',
            required: [
              'object',
              'container',
              'parentContainer',
              'parentComment',
            ],
            properties: {
              object: {
                $ref: '#/components/schemas/NotificationCommentSnapshotDto',
              },
              container: {
                oneOf: [
                  { $ref: '#/components/schemas/NotificationWorkSnapshotDto' },
                  { $ref: '#/components/schemas/NotificationTopicSnapshotDto' },
                  {
                    $ref: '#/components/schemas/NotificationChapterSnapshotDto',
                  },
                ],
              },
              parentContainer: {
                allOf: [
                  { $ref: '#/components/schemas/NotificationWorkSnapshotDto' },
                ],
                nullable: true,
              },
              parentComment: {
                allOf: [
                  {
                    $ref: '#/components/schemas/NotificationCommentSnapshotDto',
                  },
                ],
                nullable: true,
              },
            },
          },
          {
            title: '评论提及 / 点赞通知数据',
            required: ['object', 'container', 'parentContainer'],
          },
          {
            title: '主题互动通知数据',
            required: ['object'],
          },
          {
            title: '主题评论通知数据',
            required: ['object', 'container'],
          },
          {
            title: '系统公告通知数据',
            required: ['object'],
          },
          {
            title: '任务提醒通知数据',
            required: ['object', 'reminder', 'reward'],
            properties: {
              object: {
                $ref: '#/components/schemas/NotificationTaskSnapshotDto',
              },
              reminder: {
                $ref: '#/components/schemas/NotificationTaskReminderInfoDto',
              },
              reward: {
                allOf: [
                  {
                    $ref: '#/components/schemas/NotificationTaskRewardSnapshotDto',
                  },
                ],
                nullable: true,
              },
            },
          },
        ],
      })

      expect(swaggerExtraModels(BaseUserNotificationDto)).toEqual(
        expect.arrayContaining([
          NotificationCommentSnapshotDto,
          NotificationTopicSnapshotDto,
          NotificationWorkSnapshotDto,
          NotificationChapterSnapshotDto,
          NotificationAnnouncementSnapshotDto,
          NotificationTaskSnapshotDto,
          NotificationTaskReminderInfoDto,
          NotificationTaskRewardSnapshotDto,
        ]),
      )
    })
  })
})
