import type { VxeGridPropTypes } from '#/adapter/vxe-table';
import type { EsFormSchema } from '#/types';

import { cloneDeep } from 'lodash-es';

type ColumnItemExtra<T> = Partial<
  Record<
    EsFormSchema[number]['fieldName'],
    Partial<T> & { hide?: boolean; show?: boolean; sort?: number }
  >
>;

type FilterItemExtra = Partial<
  Record<
    EsFormSchema[number]['fieldName'],
    Partial<EsFormSchema[number]> & {
      show?: boolean;
      sort?: number;
    }
  >
>;

interface FormSchemaTransform {
  toTableColumns: <T extends Record<string, any> = any>(
    schema: EsFormSchema,
    extra?: ColumnItemExtra<T>,
  ) => VxeGridPropTypes.Columns<T>;
  toSearchSchema: (
    schema: EsFormSchema,
    extra?: FilterItemExtra,
  ) => EsFormSchema;
}

const filterComponentProps = {
  RangePicker: {
    placeholder: ['开始时间', '结束时间'],
  },
} as const;

// 通用排序函数
function sortItemsWithSortValue<
  T extends { originalIndex: number; sortValue?: number },
>(items: T[]): T[] {
  return items.sort((a, b) => {
    // 如果两个都有 sort 值，按 sort 值排序
    if (a.sortValue !== undefined && b.sortValue !== undefined) {
      return a.sortValue - b.sortValue;
    }
    // 如果两个都没有 sort 值，按原有位置排序
    if (a.sortValue === undefined && b.sortValue === undefined) {
      return a.originalIndex - b.originalIndex;
    }
    // 如果只有一个有 sort 值，需要比较 sort 值和原始位置
    if (a.sortValue !== undefined && b.sortValue === undefined) {
      // 如果 a 的 sort 值小于等于 b 的原始位置，a 排在前面
      return a.sortValue <= b.originalIndex ? -1 : 1;
    }
    if (a.sortValue === undefined && b.sortValue !== undefined) {
      // 如果 b 的 sort 值小于等于 a 的原始位置，b 排在前面
      return b.sortValue <= a.originalIndex ? 1 : -1;
    }
    // 默认按原有位置排序
    return a.originalIndex - b.originalIndex;
  });
}

export const formSchemaTransform: FormSchemaTransform = {
  toTableColumns: (schema, extra) => {
    const innerSchema = cloneDeep(schema);

    const columnsWithSort: Array<
      VxeGridPropTypes.Columns<any>[number] & {
        originalIndex: number;
        sortValue?: number;
      }
    > = [];

    for (const [i, item] of innerSchema.entries()) {
      const itemExtra = extra?.[item.fieldName];
      delete extra?.[item.fieldName];
      if (!itemExtra?.hide) {
        columnsWithSort.push({
          title: item.label as string,
          field: item.fieldName,
          align: 'center',
          minWidth: 100,
          ...itemExtra,
          originalIndex: i,
          sortValue: itemExtra?.sort,
        });
      }
    }
    if (extra?.actions && extra.actions.show) {
      columnsWithSort.push({
        title: '操作',
        field: 'actions',
        align: 'center',
        fixed: 'right',
        originalIndex: -1,
        width: 150,
        slots: { default: 'actions' },
        ...extra?.actions,
      });
      delete extra.actions;
    }

    if (extra?.createdAt && extra.createdAt.show) {
      columnsWithSort.push({
        title: '创建时间',
        field: 'createdAt',
        align: 'center',
        originalIndex: 99,
        width: 150,
        ...extra?.actions,
        sortable: true,
        cellRender: {
          name: 'CellDate',
        },
      });
      delete extra.actions;
    }

    if (extra && Object.keys(extra).length > 0) {
      Object.values(extra).forEach((item) => {
        columnsWithSort.push({
          ...item,
          originalIndex: item?.sort ?? -1,
        });
      });
    }

    // 根据 sort 属性排序，没有 sort 的保持原有位置
    sortItemsWithSortValue(columnsWithSort);

    columnsWithSort.unshift({
      title: '序号',
      type: 'seq',
      width: 50,
      fixed: 'left',
      originalIndex: -1,
    });

    // 移除辅助属性，返回最终的列配置
    return columnsWithSort;
  },
  toSearchSchema: (schema, extra) => {
    const innerSchema = cloneDeep(schema);
    const filterListWithSort: Array<
      EsFormSchema[number] & { originalIndex: number; sortValue?: number }
    > = [];

    // 先过滤出需要的项目并添加排序信息
    for (const [i, item] of innerSchema.entries()) {
      const itemExtra = extra?.[item.fieldName];

      if (itemExtra) {
        const componentConfig =
          filterComponentProps[
            item.component as keyof typeof filterComponentProps
          ];

        // 获取原有的options（如果componentProps是对象类型）
        const existingOptions =
          item.componentProps &&
          typeof item.componentProps === 'object' &&
          !Array.isArray(item.componentProps)
            ? item.componentProps.options
            : undefined;

        item.componentProps = {
          ...item.componentProps,
          placeholder: componentConfig?.placeholder || item.label,
          class: 'w-[280px]',
          clearable: true,
          options: existingOptions ?? [],
        };
        if (item.component === 'CheckboxGroup') {
          item.component = 'Select';
          item.componentProps.multiple = true;
          item.componentProps.collapseTags = true;
          item.componentProps.collapseTagsTooltip = true;
        }
        if (item.component === 'RadioGroup') {
          item.component = 'Select';
        }
        if (item.component === 'DatePicker') {
          item.componentProps.startPlaceholder =
            item.componentProps.startPlaceholder || '开始时间';
          item.componentProps.endPlaceholder =
            item.componentProps.endPlaceholder || '结束时间';
        }
        item.label = '';
        item.rules = '';
        item.hideLabel = true;
        delete item.defaultValue;
        filterListWithSort.push({
          ...item,
          originalIndex: i,
          sortValue: itemExtra?.sort,
        });
      }
    }

    // 根据 sort 属性排序，没有 sort 的保持原有位置
    sortItemsWithSortValue(filterListWithSort);

    // 移除辅助属性，返回最终的过滤列表
    return filterListWithSort;
  },
};
