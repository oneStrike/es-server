import * as schema from '@db/schema'
import { defineRelationsPart } from 'drizzle-orm'

export const workflowRelations = defineRelationsPart(schema, (r) => ({
  workflowJob: {
    attempts: r.many.workflowAttempt({
      from: r.workflowJob.id,
      to: r.workflowAttempt.workflowJobId,
    }),
    events: r.many.workflowEvent({
      from: r.workflowJob.id,
      to: r.workflowEvent.workflowJobId,
    }),
    conflictKeys: r.many.workflowConflictKey({
      from: r.workflowJob.id,
      to: r.workflowConflictKey.workflowJobId,
    }),
    contentImportJob: r.one.contentImportJob({
      from: r.workflowJob.id,
      to: r.contentImportJob.workflowJobId,
    }),
    contentImportResidues: r.many.contentImportResidue({
      from: r.workflowJob.id,
      to: r.contentImportResidue.workflowJobId,
    }),
    couponAdminGrantJob: r.one.couponAdminGrantJob({
      from: r.workflowJob.id,
      to: r.couponAdminGrantJob.workflowJobId,
    }),
  },
  workflowAttempt: {
    job: r.one.workflowJob({
      from: r.workflowAttempt.workflowJobId,
      to: r.workflowJob.id,
    }),
    events: r.many.workflowEvent({
      from: r.workflowAttempt.id,
      to: r.workflowEvent.workflowAttemptId,
    }),
    contentImportItemAttempts: r.many.contentImportItemAttempt({
      from: r.workflowAttempt.id,
      to: r.contentImportItemAttempt.workflowAttemptId,
    }),
    contentImportResidues: r.many.contentImportResidue({
      from: r.workflowAttempt.id,
      to: r.contentImportResidue.workflowAttemptId,
    }),
  },
  workflowEvent: {
    job: r.one.workflowJob({
      from: r.workflowEvent.workflowJobId,
      to: r.workflowJob.id,
    }),
    attempt: r.one.workflowAttempt({
      from: r.workflowEvent.workflowAttemptId,
      to: r.workflowAttempt.id,
    }),
  },
  workflowConflictKey: {
    job: r.one.workflowJob({
      from: r.workflowConflictKey.workflowJobId,
      to: r.workflowJob.id,
    }),
  },
}))
