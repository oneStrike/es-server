import { normalizeWorkflowRequiredText } from './workflow-runtime-policy'

export function normalizeWorkflowConflictKeys(keys: string[]) {
  const normalizedKeys: string[] = []
  const seenKeys = new Set<string>()
  for (const key of keys) {
    const normalizedKey = normalizeWorkflowRequiredText(key, '工作流冲突键')
    if (seenKeys.has(normalizedKey)) {
      continue
    }
    seenKeys.add(normalizedKey)
    normalizedKeys.push(normalizedKey)
  }
  return normalizedKeys
}
