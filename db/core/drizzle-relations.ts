import { adminRelations } from '../relations/admin'
import { appRelations } from '../relations/app'
import { baseRelations } from '../relations/base'
import { forumRelations } from '../relations/forum'
import { messageRelations } from '../relations/message'
import { systemRelations } from '../relations/system'
import { workRelations } from '../relations/work'

export const relations = {
  ...baseRelations,
  ...adminRelations,
  ...appRelations,
  ...forumRelations,
  ...messageRelations,
  ...systemRelations,
  ...workRelations,
}
