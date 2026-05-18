import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { WorkflowJobArchiveScopeEnum } from '../workflow.constant'
import {
  WorkflowJobDto,
  WorkflowJobIdDto,
  WorkflowJobPageRequestDto,
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
})
