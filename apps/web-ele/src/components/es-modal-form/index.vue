<script lang="ts" setup>
import type { EsModalFormProps } from './types';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { useBitMask } from '#/hooks/useBitmask';

defineOptions({
  name: 'EsModalForm',
});

const props = withDefaults(defineProps<EsModalFormProps>(), {
  record: () => ({}),
});

const sharedData = ref<Partial<EsModalFormProps>>({
  title: '',
});

const modalTitle = computed(() => {
  return Object.keys(sharedData.value).length > 0
    ? `编辑${sharedData.value?.title ?? ''}`
    : `新增${sharedData.value?.title ?? ''}`;
});

const [Modal, modalApi] = useVbenModal({
  onConfirm: () => formApi.submitForm(),
  onOpenChange(isOpen: boolean) {
    if (isOpen) {
      sharedData.value = modalApi.getData<EsModalFormProps>();
      sharedData.value.width = sharedData.value?.width || 900;
      if (sharedData.value?.record) {
        if (Array.isArray(sharedData.value?.bitMaskField)) {
          sharedData.value.bitMaskField.forEach((field) => {
            if (sharedData.value.record) {
              sharedData.value.record[field] = sharedData.value.record[field]
                ? useBitMask.split(sharedData.value.record[field])
                : [];
            }
          });
        }
        formApi.setValues(sharedData.value.record);
      }
    }
  },
});

// 根据弹窗宽度动态计算网格列数
const dynamicWrapperClass = computed(() => {
  return `grid-cols-${sharedData.value.cols || 2} gap-x-4`;
});

const [BaseForm, formApi] = useVbenForm({
  layout: 'vertical',
  showDefaultActions: false,
  wrapperClass: dynamicWrapperClass as unknown as string,
  fieldMappingTime: props.fieldMappingTime,

  handleSubmit: async (values) => {
    modalApi.lock();

    try {
      if (Array.isArray(sharedData.value.bitMaskField)) {
        sharedData.value.bitMaskField.forEach((field) => {
          if (values[field]) {
            values[field] = useBitMask.set(values[field]);
          }
        });
      }

      await props.onSubmit?.({
        ...values,
        id: sharedData.value?.record?.id,
      });
    } catch {}
    modalApi.unlock();
  },
  schema: props.schema,
});
</script>
<template>
  <Modal
    :title="modalTitle"
    :class="sharedData.cols === 1 ? 'w-[500px]' : 'w-[900px]'"
  >
    <template #prepend-footer>
      <el-button @click="formApi.resetForm()">重置</el-button>
    </template>
    <BaseForm />
  </Modal>
</template>
