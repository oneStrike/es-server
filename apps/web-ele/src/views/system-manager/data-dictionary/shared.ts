import type { DictionaryDto, DictionaryItemDto } from '#/apis/types/dictionary';
import type { EsFormSchema } from '#/types';

import { cloneDeep } from 'lodash-es';

import { formSchemaTransform } from '#/utils';

export const formSchema: EsFormSchema = [
  {
    component: 'Upload',
    componentProps: {
      placeholder: '请上传字典封面',
    },
    fieldName: 'cover',
    label: '封面',
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入字典名称',
    },
    fieldName: 'name',
    label: '字典名称',
    rules: 'required',
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入字典编码',
    },
    fieldName: 'code',
    label: '字典编码',
    rules: 'required',
  },
  {
    component: 'Input',
    componentProps: {
      type: 'textarea',
      placeholder: '请输入备注信息...',
      rows: 4,
    },
    fieldName: 'description',
    label: '备注',
  },
];

export const itemFormSchema = cloneDeep(formSchema);
itemFormSchema.splice(3, 0, {
  component: 'Input',
  componentProps: {
    type: 'number',
    placeholder: '请输入字典项排序',
  },
  fieldName: 'order',
  label: '排序',
});
export const dictionaryColumns =
  formSchemaTransform.toTableColumns<DictionaryDto>(formSchema, {
    actions: {
      show: true,
    },
    name: {
      cellRender: { name: 'CellLink' },
    },
    code: {
      width: 300,
    },
    cover: {
      width: 150,
      cellRender: {
        name: 'CellImage',
      },
    },
    isEnabled: {
      show: true,
      width: 100,
      title: '状态',
      sort: 99,
      slots: { default: 'isEnabled' },
    },
    description: {
      formatter: ({ cellValue }: any) => {
        return cellValue || '-';
      },
    },
  });

export const dictionaryItemColumns =
  formSchemaTransform.toTableColumns<DictionaryItemDto>(itemFormSchema, {
    actions: {
      show: true,
    },
    name: {
      width: 200,
    },
    code: {
      width: 200,
    },
    cover: {
      cellRender: {
        name: 'CellImage',
      },
    },
    order: {
      width: 100,
    },
    isEnabled: {
      show: true,
      width: 100,
      title: '状态',
      sort: 99,
      slots: { default: 'isEnabled' },
    },
    description: {
      formatter: ({ cellValue }: any) => {
        return cellValue || '-';
      },
    },
  });

export const dictionarySearchSchema = formSchemaTransform.toSearchSchema(
  formSchema,
  {
    name: {
      show: true,
    },
    code: {
      show: true,
    },
  },
);
