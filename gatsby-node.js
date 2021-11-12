/**
 * Implement Gatsby's Node APIs in this file.
 *
 * See: https://www.gatsbyjs.org/docs/node-apis/
 * Based on: https://github.com/gatsbyjs/gatsby/blob/master/examples/using-wordpress/gatsby-node.js
 */
const createPosts = require('./create/createPosts')
const { setOptions, createPages } = require('./create/createPages')

setOptions({
  postTypes: ['Page'],
  graphQLFieldGroupName: 'pageComponents',
  graphQLFieldName: 'pageComponents',
})

module.exports.createPages = async gatsbyUtilities => {
  await createPages(gatsbyUtilities)
  await createPosts(gatsbyUtilities)
}
