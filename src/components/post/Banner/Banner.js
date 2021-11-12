import React from 'react'
import deepClone from 'lodash.clonedeep'
import PageBanner from '../../page/Banner'

const Banner = data => {
  // Since we can't directly modify data
  const dataCloned = deepClone(data)
  // Let's say there's something about the normal Page banner
  // that should always be the same for a Post's banner.
  dataCloned.description = `Published on ${data.date}`
  return <PageBanner {...dataCloned} />
}

export default Banner
