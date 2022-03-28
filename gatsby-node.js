/**
 * Implement Gatsby's Node APIs in this file.
 *
 * See: https://www.gatsbyjs.org/docs/node-apis/
 * Based on: https://github.com/gatsbyjs/gatsby/blob/master/examples/using-wordpress/gatsby-node.js
 */
const { createPages } = require('./create/createPages')

module.exports.createPages = async gatsbyUtilities => {
  await createPages(gatsbyUtilities)
}
