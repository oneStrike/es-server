import { defineRelationsPart } from 'drizzle-orm'
import * as schema from '../schema'

export const systemRelations = defineRelationsPart(schema, r => ({
  domainEvent: {
    dispatches: r.many.domainEventDispatch(),
  },
  domainEventDispatch: {
    event: r.one.domainEvent({
      from: r.domainEventDispatch.eventId,
      to: r.domainEvent.id,
    }),
  },
  dictionary: {
    dictionaryItems: r.many.dictionaryItem(),
  },
  dictionaryItem: {
    parentDictionary: r.one.dictionary({
      from: r.dictionaryItem.dictionaryCode,
      to: r.dictionary.code,
    }),
  },
  systemConfig: {
    updatedBy: r.one.adminUser({
      from: r.systemConfig.updatedById,
      to: r.adminUser.id,
      alias: 'SystemConfigUpdater',
    }),
  },
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
    contentImportLink: r.one.contentImportEventLink({
      from: r.workflowEvent.id,
      to: r.contentImportEventLink.workflowEventId,
    }),
  },
  workflowConflictKey: {
    job: r.one.workflowJob({
      from: r.workflowConflictKey.workflowJobId,
      to: r.workflowJob.id,
    }),
  },
}))
