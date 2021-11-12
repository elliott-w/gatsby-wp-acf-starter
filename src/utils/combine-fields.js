import cloneDeep from 'lodash.clonedeep'

/**
 * Flattens a post's acf fields with its wordpress fields
 * E.g. converts
 * {
 *   title,
 *   date,
 *   post: {
 *     content
 *   }
 * }
 * into
 * {
 *   title,
 *   date,
 *   content
 * }
 */

export const combineFields = (data, acfFieldGroupNameToFlatten) => {
  // Clone data so we don't delete anything from original object
  const clonedData = cloneDeep(data)
  // Make a copy of the acf fields
  const acfFields = cloneDeep(data[acfFieldGroupNameToFlatten])
  // Delete the acf fields
  delete clonedData[acfFieldGroupNameToFlatten]

  return {
    ...clonedData,
    ...acfFields,
  }
}
