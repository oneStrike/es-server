import { AuditActionTypeEnum, AuditActionTypeLabels } from '@libs/platform/modules/audit/audit-action.constant'

const AUDIT_ACTION_TYPES = new Set<AuditActionTypeEnum>(
  Object.values(AuditActionTypeEnum).filter(
    (value): value is AuditActionTypeEnum => typeof value === 'number',
  ),
)

export function normalizeAuditActionType(
  actionType?: AuditActionTypeEnum | number | null,
): AuditActionTypeEnum | null {
  if (!actionType) {
    return null
  }

  if (typeof actionType === 'number' && AUDIT_ACTION_TYPES.has(actionType)) {
    return actionType
  }
  return null
}

export function getAuditActionTypeLabel(
  actionType?: AuditActionTypeEnum | number | null,
): string | null {
  const normalizedActionType = normalizeAuditActionType(actionType)
  if (normalizedActionType) {
    return AuditActionTypeLabels[normalizedActionType]
  }

  return null
}

export function resolveAuditActionTypeSearchTerms(
  actionType: AuditActionTypeEnum,
): number[] {
  return [actionType]
}
