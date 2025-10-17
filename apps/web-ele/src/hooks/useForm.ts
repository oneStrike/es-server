import type { EsFormSchema } from '#/types';

const setOptions = (
  schema: EsFormSchema,
  options: Record<any, { label: string; value: number | string }[]>,
) => {
  for (const key in options) {
    schema.forEach((item) => {
      if (item.fieldName === key) {
        // @ts-expect-error ignore
        item.componentProps.options = options[key];
      }
    });
  }
};

export const useForm = {
  setOptions,
};
