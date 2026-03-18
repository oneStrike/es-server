import { AuditActionTypeEnum, AuditActionTypeLabels } from './audit.constant'

const AUDIT_ACTION_TYPES = new Set<AuditActionTypeEnum>(
  Object.values(AuditActionTypeEnum) as AuditActionTypeEnum[],
)

const AUDIT_ACTION_TYPE_LABEL_TO_ENUM_MAP = Object.entries(
  AuditActionTypeLabels,
).reduce(
  (result, [actionType, label]) => {
    result[label] = actionType as AuditActionTypeEnum
    return result
  },
  {} as Record<string, AuditActionTypeEnum>,
)

export function normalizeAuditActionType(
  actionType?: AuditActionTypeEnum | string | null,
): AuditActionTypeEnum | null {
  if (!actionType) {
    return null
  }

  if (AUDIT_ACTION_TYPES.has(actionType as AuditActionTypeEnum)) {
    return actionType as AuditActionTypeEnum
  }

  return AUDIT_ACTION_TYPE_LABEL_TO_ENUM_MAP[actionType] ?? null
}

export function getAuditActionTypeLabel(
  actionType?: AuditActionTypeEnum | string | null,
): string | null {
  const normalizedActionType = normalizeAuditActionType(actionType)
  if (normalizedActionType) {
    return AuditActionTypeLabels[normalizedActionType]
  }

  if (typeof actionType === 'string' && actionType.length > 0) {
    return actionType
  }

  return null
}

export function resolveAuditActionTypeSearchTerms(
  actionType: AuditActionTypeEnum,
): string[] {
  return [...new Set([actionType, AuditActionTypeLabels[actionType]])]
}
