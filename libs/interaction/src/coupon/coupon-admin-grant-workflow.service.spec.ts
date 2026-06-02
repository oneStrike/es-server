/// <reference types="jest" />

import { createHash } from 'node:crypto'
import { BusinessException } from '@libs/platform/exceptions'
import {
  WorkflowJobStatusEnum,
  WorkflowOperatorTypeEnum,
} from '@libs/platform/modules/workflow/workflow.constant'
import {
  CouponTargetScopeEnum,
  CouponTypeEnum,
  CouponWorkflowType,
} from './coupon.constant'
import { CouponAdminGrantWorkflowService } from './coupon-admin-grant-workflow.service'

describe('CouponAdminGrantWorkflowService', () => {
  it('returns an existing idempotent job before validating mutable coupon or user state', async () => {
    const payloadHash = hashPayload({
      couponDefinitionId: 7,
      quantity: 2,
      remark: '补发',
      userIds: [33, 44],
    })
    const workflowJob = buildWorkflowJob()
    const db = {
      select: jest.fn(() =>
        createSelectChain([{ grantJob: { payloadHash }, workflowJob }]),
      ),
    }
    const workflowService = {
      confirmDraft: jest.fn(),
      createDraftWithResources: jest.fn(),
    }
    const service = buildService({ db }, workflowService)

    await expect(
      service.createWorkflow(
        {
          couponDefinitionId: 7,
          operationId: 'op-1',
          quantity: 2,
          remark: '补发',
          userIds: [44, 33],
        },
        9,
      ),
    ).resolves.toEqual(expect.objectContaining({ jobId: 'job-1' }))

    expect(db.select).toHaveBeenCalledTimes(1)
    expect(workflowService.createDraftWithResources).not.toHaveBeenCalled()
  })

  it('rejects operation id reuse with a different payload without creating a draft', async () => {
    const db = {
      select: jest.fn(() =>
        createSelectChain([
          {
            grantJob: { payloadHash: hashPayload({ couponDefinitionId: 8 }) },
            workflowJob: buildWorkflowJob(),
          },
        ]),
      ),
    }
    const workflowService = {
      confirmDraft: jest.fn(),
      createDraftWithResources: jest.fn(),
    }
    const service = buildService({ db }, workflowService)

    await expect(
      service.createWorkflow(
        {
          couponDefinitionId: 7,
          operationId: 'op-1',
          quantity: 1,
          userIds: [33],
        },
        9,
      ),
    ).rejects.toBeInstanceOf(BusinessException)

    expect(db.select).toHaveBeenCalledTimes(1)
    expect(workflowService.createDraftWithResources).not.toHaveBeenCalled()
  })

  it('creates the workflow draft and grant rows atomically with bounded inserts', async () => {
    const userIds = Array.from({ length: 501 }, (_, index) => index + 1)
    const selectResults = [
      [],
      [buildCouponDefinition()],
      userIds.slice(0, 500).map((id) => ({ id })),
      userIds.slice(500).map((id) => ({ id })),
    ]
    const db = {
      select: jest.fn(() => createSelectChain(selectResults.shift() ?? [])),
    }
    const txInsertValues: unknown[] = []
    const tx = {
      insert: jest.fn((table) => ({
        values: jest.fn((value) => {
          txInsertValues.push(value)
          if (table === schema.couponAdminGrantJob) {
            return { returning: jest.fn(async () => [{ id: 10 }]) }
          }
          return Promise.resolve()
        }),
      })),
    }
    const workflowService = {
      confirmDraft: jest.fn(async () => ({ jobId: 'job-1' })),
      createDraftWithResources: jest.fn(async (input, initializer) => {
        await initializer({
          tx,
          workflowJob: {
            id: 100n,
            jobId: 'job-1',
            workflowType: input.workflowType,
          },
        })
        return { jobId: 'job-1' }
      }),
    }
    const service = buildService({ db }, workflowService)

    await expect(
      service.createWorkflow(
        {
          couponDefinitionId: 7,
          operationId: 'bulk-op',
          quantity: 3,
          userIds,
        },
        9,
      ),
    ).resolves.toEqual({ jobId: 'job-1' })

    expect(workflowService.createDraftWithResources).toHaveBeenCalledWith(
      expect.objectContaining({
        conflictKeys: [expect.stringMatching(/^coupon-admin-grant:operation:/)],
        selectedItemCount: 501,
        workflowType: CouponWorkflowType.ADMIN_GRANT_BATCH,
      }),
      expect.any(Function),
    )
    expect(workflowService.confirmDraft).toHaveBeenCalledWith({ jobId: 'job-1' })
    expect(txInsertValues[0]).toEqual(
      expect.objectContaining({
        couponDefinitionId: 7,
        perUserQuantity: 3,
        requestedGrantCount: 1503,
        selectedUserCount: 501,
      }),
    )
    expect((txInsertValues[1] as unknown[])).toHaveLength(500)
    expect((txInsertValues[2] as unknown[])).toHaveLength(1)
  })
})

const schema = {
  appUser: {
    deletedAt: 'app_user.deleted_at',
    id: 'app_user.id',
    isEnabled: 'app_user.is_enabled',
    status: 'app_user.status',
  },
  couponAdminGrantItem: {
    couponAdminGrantJobId: 'coupon_admin_grant_item.coupon_admin_grant_job_id',
  },
  couponAdminGrantJob: {
    id: 'coupon_admin_grant_job.id',
    operationId: 'coupon_admin_grant_job.operation_id',
    workflowJobId: 'coupon_admin_grant_job.workflow_job_id',
  },
  couponDefinition: {
    id: 'coupon_definition.id',
    isEnabled: 'coupon_definition.is_enabled',
  },
  workflowJob: {
    id: 'workflow_job.id',
    jobId: 'workflow_job.job_id',
  },
}

function buildService(
  drizzle: Record<string, unknown>,
  workflowService: Record<string, unknown>,
) {
  return new CouponAdminGrantWorkflowService(
    {
      ...drizzle,
      buildPage: jest.fn(),
      buildOrderBy: jest.fn(),
      schema,
    } as never,
    workflowService as never,
  )
}

function createSelectChain(result: unknown[]) {
  const afterWhere = {
    limit: jest.fn(async () => result),
    then: (resolve: (value: unknown[]) => void) => Promise.resolve(result).then(resolve),
  }
  const chain = {
    from: jest.fn(() => chain),
    innerJoin: jest.fn(() => chain),
    limit: jest.fn(async () => result),
    where: jest.fn(() => afterWhere),
  }
  return chain
}

function buildCouponDefinition() {
  return {
    benefitCount: 0,
    benefitDays: 0,
    couponType: CouponTypeEnum.READING,
    discountAmount: 0,
    discountRateBps: 10000,
    id: 7,
    isEnabled: true,
    name: '阅读券',
    targetScope: CouponTargetScopeEnum.CHAPTER,
    usageLimit: 1,
    validDays: 7,
  }
}

function buildWorkflowJob() {
  const now = new Date('2026-06-02T00:00:00.000Z')
  return {
    archivedAt: null,
    cancelRequestedAt: null,
    createdAt: now,
    displayName: '批量发券',
    expiresAt: null,
    failedItemCount: 0,
    finishedAt: null,
    id: 1n,
    jobId: 'job-1',
    operatorType: WorkflowOperatorTypeEnum.ADMIN,
    operatorUserId: 9,
    progressCode: null,
    progressContext: null,
    progressDetail: null,
    progressPercent: 0,
    selectedItemCount: 2,
    skippedItemCount: 0,
    startedAt: null,
    status: WorkflowJobStatusEnum.PENDING,
    successItemCount: 0,
    summary: null,
    updatedAt: now,
    workflowType: CouponWorkflowType.ADMIN_GRANT_BATCH,
  }
}

function hashPayload(payload: {
  couponDefinitionId: number
  quantity?: number
  remark?: string | null
  userIds?: number[]
}) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        couponDefinitionId: payload.couponDefinitionId,
        quantity: payload.quantity ?? 1,
        remark: payload.remark ?? null,
        userIds: payload.userIds ?? [33],
      }),
    )
    .digest('hex')
}
