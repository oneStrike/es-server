import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { WorkflowJobArchiveScopeEnum, WorkflowNotificationKindEnum } from '../workflow.constant'
import {
  WorkflowJobDto,
  WorkflowJobIdDto,
  WorkflowJobPageRequestDto,
  WorkflowNotificationItemDto,
  WorkflowNotificationListRequestDto,
} from './workflow.dto'

describe('Workflow DTO validation ownership', () => {
  it('keeps request jobId validation enabled while output jobId is documentation only', async () => {
    const requestErrors = await validate(
      plainToInstance(WorkflowJobIdDto, { jobId: 123 }),
    )
    const outputErrors = await validate(
      plainToInstance(WorkflowJobDto, { jobId: 123 }),
      { forbidUnknownValues: false },
    )

    expect(requestErrors).toEqual([
      expect.objectContaining({ property: 'jobId' }),
    ])
    expect(outputErrors).toHaveLength(0)
  })

  it('validates workflow archive scope query values', async () => {
    const validErrors = await validate(
      plainToInstance(WorkflowJobPageRequestDto, {
        archiveScope: WorkflowJobArchiveScopeEnum.ARCHIVED,
        pageIndex: 1,
        pageSize: 10,
      }),
    )
    const invalidErrors = await validate(
      plainToInstance(WorkflowJobPageRequestDto, {
        archiveScope: 'deleted',
        pageIndex: 1,
        pageSize: 10,
      }),
    )

    expect(validErrors).toHaveLength(0)
    expect(invalidErrors).toEqual([
      expect.objectContaining({ property: 'archiveScope' }),
    ])
  })

  it('validates notification list query cursors and kinds', async () => {
    const valid = plainToInstance(WorkflowNotificationListRequestDto, {
      afterId: '10',
      createdAfter: '2026-05-17T03:00:00.000Z',
      kinds: [WorkflowNotificationKindEnum.SUCCESS],
      limit: '20',
    })
    const invalid = plainToInstance(WorkflowNotificationListRequestDto, {
      afterId: -1,
      createdAfter: 'bad-date',
      kinds: ['manual_retry'],
      limit: 1000,
    })

    expect(await validate(valid)).toHaveLength(0)
    expect(valid.afterId).toBe(10)
    expect(valid.createdAfter).toBeInstanceOf(Date)
    expect(valid.limit).toBe(20)
    expect(await validate(invalid)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'afterId' }),
        expect.objectContaining({ property: 'createdAfter' }),
        expect.objectContaining({ property: 'kinds' }),
        expect.objectContaining({ property: 'limit' }),
      ]),
    )
  })

  it('keeps workflow notification output fields documentation-only', async () => {
    const errors = await validate(
      plainToInstance(WorkflowNotificationItemDto, {
        id: 'not-a-number',
        kind: 'bad-kind',
      }),
      { forbidUnknownValues: false },
    )

    expect(errors).toHaveLength(0)
  })
})
