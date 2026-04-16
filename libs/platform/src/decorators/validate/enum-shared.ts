import type { EnumLike } from './types'
import { getNumberEnumValues, isNumberEnum } from '@libs/platform/utils/is'
import { IsEnum, IsIn } from 'class-validator'

export interface EnumValidationArtifacts {
  isNumericEnum: boolean
  validValues: Array<string | number>
}

export function resolveEnumValidationArtifacts(
  enumLike: EnumLike,
): EnumValidationArtifacts {
  const isNumericEnum = isNumberEnum(enumLike)

  return {
    isNumericEnum,
    validValues: isNumericEnum
      ? getNumberEnumValues(enumLike)
      : Object.values(enumLike),
  }
}

export function createEnumValueValidator(
  enumLike: EnumLike,
  artifacts: EnumValidationArtifacts,
  options: {
    each?: boolean
    message: string
  },
): PropertyDecorator {
  if (artifacts.isNumericEnum) {
    return IsIn(artifacts.validValues, {
      each: options.each,
      message: options.message,
    })
  }

  return IsEnum(enumLike, {
    each: options.each,
    message: options.message,
  })
}

export function normalizeEnumPropertyValue(
  value: string | number | null | undefined,
  artifacts: EnumValidationArtifacts,
): string | number | null | undefined {
  if (value === undefined || value === null) {
    return value
  }

  if (typeof value !== 'string') {
    return value
  }

  const trimmedValue = value.trim()

  if (artifacts.isNumericEnum) {
    if (trimmedValue === '') {
      return undefined
    }

    const numValue = Number(trimmedValue)
    return !Number.isNaN(numValue) && artifacts.validValues.includes(numValue)
      ? numValue
      : value
  }

  return trimmedValue
}

export function normalizeEnumArrayItem(
  item: string | number | boolean | null | undefined,
  artifacts: EnumValidationArtifacts,
): string | number | boolean | null | undefined {
  if (typeof item !== 'string') {
    return item
  }

  const trimmedItem = item.trim()

  if (artifacts.isNumericEnum) {
    if (trimmedItem === '') {
      return item
    }

    const numValue = Number(trimmedItem)
    return !Number.isNaN(numValue) && artifacts.validValues.includes(numValue)
      ? numValue
      : item
  }

  return trimmedItem
}
