import React from 'react'
import { graphql } from 'gatsby'
import { combineFields } from '../utils/combine-fields'
import Banner from '../components/post/Banner'

const NewsTemplate = pageProps => {
  const data = combineFields(pageProps.data.wpPost, 'post')
  return (
    <>
      <Banner {...data} />
    </>
  )
}

export default NewsTemplate

export const query = graphql`
  query PostQuery($id: String!) {
    wpPost(id: { eq: $id }) {
      title
      date
      post {
        content
      }
    }
  }
`
