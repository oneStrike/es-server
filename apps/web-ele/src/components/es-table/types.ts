import type { VxeGridPropTypes } from '#/adapter/vxe-table';
import type { AsyncFn, EsFormSchema } from '#/types';

export interface EsTableProps {
  listApi: AsyncFn;
  detailApi: AsyncFn;
  deleteApi: AsyncFn;
  updateApi: AsyncFn;
  createApi: AsyncFn;
  statusApi: AsyncFn;
  columns: VxeGridPropTypes.Columns;
  formSchema: EsFormSchema;
  searchSchema: EsFormSchema;
}
