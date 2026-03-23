import {
  BaseTaskAssignmentDto,
  BaseTaskDto,
} from '@libs/growth/task'
import { IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class CreateTaskDto extends OmitType(BaseTaskDto, [
  ...OMIT_BASE_FIELDS,
  'createdById',
  'updatedById',
  'deletedAt',
] as const) {}

export class UpdateTaskDto extends IntersectionType(
  PartialType(CreateTaskDto),
  IdDto,
) {}

export class UpdateTaskStatusDto extends IntersectionType(
  IdDto,
  PartialType(PickType(BaseTaskDto, ['status', 'isEnabled'] as const)),
) {}

export class QueryTaskDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseTaskDto, ['title', 'status', 'type', 'isEnabled'] as const),
  ),
) {}

export class QueryTaskAssignmentDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseTaskAssignmentDto, ['taskId', 'userId', 'status'] as const),
  ),
) {}
