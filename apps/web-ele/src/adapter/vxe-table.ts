import type { VxeTableGridOptions } from '@vben/plugins/vxe-table';

import { h } from 'vue';

import { setupVbenVxeTable, useVbenVxeGrid } from '@vben/plugins/vxe-table';

import { ElButton, ElImage, ElTag, ElText } from 'element-plus';

import { ImageLine } from '#/components/es-icons';
import { formatUTC } from '#/utils';

import { useVbenForm } from './form';

setupVbenVxeTable({
  configVxeTable: (vxeUI) => {
    vxeUI.setConfig({
      grid: {
        align: 'center',
        border: false,

        columnConfig: {
          resizable: true,
        },
        rowConfig: {
          isHover: true,
        },
        minHeight: 180,
        formConfig: {
          // 全局禁用vxe-table的表单配置，使用formOptions
          enabled: false,
        },
        proxyConfig: {
          autoLoad: true,
          response: {
            result: 'list',
            total: 'total',
            list: 'list',
          },
          showActiveMsg: true,
          showResponseMsg: false,
        },
        round: true,
        showOverflow: true,
        size: 'medium',
        pagerConfig: {
          pageSize: 15,
          pageSizes: [15, 30, 45, 75, 100],
        },
        toolbarConfig: {
          custom: true,
          export: false,
          refresh: true,
          zoom: false,
          search: true,
        },
        exportConfig: {},
      } as VxeTableGridOptions,
    });

    // 表格配置项可以用 cellRender: { name: 'CellImage' },
    vxeUI.renderer.add('CellImage', {
      renderTableDefault(_renderOpts, params) {
        const { column, row } = params;
        const src = row[column.field] || '';
        return h(
          ElImage,
          {
            src,
            previewSrcList: [src],
            class: 'size-8',
            fit: 'contain',
            previewTeleported: true,
          },
          { error: () => h(ImageLine, { class: 'size-8' }) },
        );
      },
    });
    // 表格配置项可以用 cellRender: { name: 'CellDate' },
    vxeUI.renderer.add('CellDate', {
      renderTableDefault(_renderOpts, params) {
        const { column, row } = params;
        const type = _renderOpts.props?.type ?? '';
        const text = row[column.field] || '';
        return h(
          ElText,
          {
            type,
          },
          { default: () => formatUTC(text) },
        );
      },
    });

    // 表格配置项可以用 cellRender: { name: 'CellLink' },
    vxeUI.renderer.add('CellLink', {
      renderTableDefault(renderOpts, params) {
        const type = renderOpts.props?.type ?? 'primary';
        const { column, row } = params;
        const text = row[column.field] || '';
        return h(
          ElButton,
          { size: 'small', link: true, class: 'line-clamp-1 w-full', type },
          { default: () => text },
        );
      },
    });

    // 表格配置项可以用 cellRender: { name: 'CellTag' },
    vxeUI.renderer.add('CellTag', {
      renderTableDefault({ props }, params) {
        const { column, row } = params;
        const tags = row[column.field] || '';

        // 处理字符串数组或字符串的情况
        if (Array.isArray(tags)) {
          return tags.map((tag, idx) =>
            h(
              ElTag,
              {
                type: props?.type || 'primary',
                size: props?.size || 'small',
                class: idx + 1 === tags.length ? '' : 'mr-1',
                ...props,
              },
              { default: () => tag },
            ),
          );
        }

        // 处理字符串情况
        return h(
          ElTag,
          {
            type: props?.type || 'primary',
            size: props?.size || 'small',
            ...props,
          },
          { default: () => tags },
        );
      },
    });

    // 这里可以自行扩展 vxe-table 的全局配置，比如自定义格式化
    // vxeUI.formats.add
  },
  useVbenForm,
});

// 表格查询参数
const queryParams = ({ page, formValues, sorts }: any) => {
  if (sorts.length > 0) {
    formValues.orderBy = {};
    sorts.forEach((item: any) => {
      formValues.orderBy[item.field] = item.order;
    });
    formValues.orderBy = JSON.stringify(formValues.orderBy);
  }
  return {
    pageIndex: --page.currentPage,
    pageSize: page.pageSize,
    ...formValues,
  };
};

export { queryParams, useVbenVxeGrid };

export type * from '@vben/plugins/vxe-table';
