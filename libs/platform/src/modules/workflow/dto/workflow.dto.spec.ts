import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { WorkflowJobDto, WorkflowJobIdDto } from './workflow.dto'

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
})
