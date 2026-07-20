import { adminRelations } from '../relations/admin'
import { appContentRelations } from '../relations/app-content'
import { baseRelations } from '../relations/base'
import { commerceRelations } from '../relations/commerce'
import { configurationRelations } from '../relations/configuration'
import { contentRelations } from '../relations/content'
import { eventingRelations } from '../relations/eventing'
import { forumRelations } from '../relations/forum'
import { growthRelations } from '../relations/growth'
import { interactionRelations } from '../relations/interaction'
import { messageRelations } from '../relations/message'
import { observabilityRelations } from '../relations/observability'
import { userRelations } from '../relations/user'
import { workflowRelations } from '../relations/workflow'

export const relations = {
  ...baseRelations,
  ...adminRelations,
  ...appContentRelations,
  ...commerceRelations,
  ...configurationRelations,
  ...contentRelations,
  ...eventingRelations,
  ...forumRelations,
  ...growthRelations,
  ...interactionRelations,
  ...messageRelations,
  ...observabilityRelations,
  ...userRelations,
  ...workflowRelations,
}
