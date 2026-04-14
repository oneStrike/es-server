import { AuditActionTypeEnum } from '../../../common/audit/audit-action.constant'
import {
  getAuditActionTypeLabel,
  normalizeAuditActionType,
  resolveAuditActionTypeSearchTerms,
} from './audit.helpers'

describe('audit action compatibility', () => {
  it('only accepts numeric standard action codes', () => {
    expect(normalizeAuditActionType(AuditActionTypeEnum.CREATE)).toBe(
      AuditActionTypeEnum.CREATE,
    )
    expect(normalizeAuditActionType('3' as never)).toBeNull()
    expect(normalizeAuditActionType('CREATE' as never)).toBeNull()
  })

  it('does not preserve custom action labels', () => {
    expect(getAuditActionTypeLabel('TASK_CREATE' as never)).toBeNull()
  })

  it('queries only the standardized numeric action code', () => {
    expect(resolveAuditActionTypeSearchTerms(AuditActionTypeEnum.CREATE)).toEqual(
      [AuditActionTypeEnum.CREATE],
    )
  })
})
