// See .cache/page-templates after running dev/build
// to understand how this file ends up looking

import React from 'react'
import SEO from '../components/structural/seo'
import { graphql } from 'gatsby'


// ### COMPONENT IMPORTS ### DO NOT MODIFY OR MOVE THIS COMMENT ###

const PageTemplate = pageProps => {
  let data
  // ### DATA VARIABLE ### DO NOT MODIFY OR MOVE THIS COMMENT ###
  const componentsArray = data.page_components.components || []
  const components = componentsArray.map(component => {
    return {
      name: component.__typename.split('_').pop(),
      data: component,
    }
  })
  return (
    <>
      <SEO title={data.title}/>
      {components.map((component, index) => {
        // ### COMPONENT RENDERING ### DO NOT MODIFY OR MOVE THIS COMMENT ###
        return <div>Error: The component {component.name} was not found</div>
      })}
    </>
  )
}

export default PageTemplate

// ### PAGE QUERY ### DO NOT MODIFY OR MOVE THIS COMMENT ###