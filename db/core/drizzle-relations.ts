import { appContentRelations } from '../relations/app-content'
import { baseRelations } from '../relations/base'
import { commerceRelations } from '../relations/commerce'
import { configurationRelations } from '../relations/configuration'
import { contentRelations } from '../relations/content'
import { eventingRelations } from '../relations/eventing'
import { forumRelations } from '../relations/forum'
import { growthRelations } from '../relations/growth'
import { identityRelations } from '../relations/identity'
import { interactionRelations } from '../relations/interaction'
import { messageRelations } from '../relations/message'
import { observabilityRelations } from '../relations/observability'
import { workflowRelations } from '../relations/workflow'

export const relations = {
  ...baseRelations,
  ...appContentRelations,
  ...commerceRelations,
  ...configurationRelations,
  ...contentRelations,
  ...eventingRelations,
  ...forumRelations,
  ...growthRelations,
  ...identityRelations,
  ...interactionRelations,
  ...messageRelations,
  ...observabilityRelations,
  ...workflowRelations,
}
