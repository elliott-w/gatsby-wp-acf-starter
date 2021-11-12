const path = require('path')

module.exports = async gatsbyUtilities => {
  const posts = await getPosts(gatsbyUtilities)
  await createPosts(posts, gatsbyUtilities)
}
const getPosts = async ({ graphql }) => {
  const graphqlResult = await graphql(`
    query Posts {
      allWpPost(sort: { order: DESC, fields: [date] }) {
        nodes {
          id
          uri
        }
      }
    }
  `)
  if (graphqlResult.errors) {
    console.error(graphqlResult.errors)
    throw new Error('GraphQL query failed')
  }
  return graphqlResult.data.allWpPost.nodes
}

const createPosts = async (posts, gatsbyUtilities) => {
  return Promise.all(
    posts.map(post => {
      return gatsbyUtilities.actions.createPage({
        path: post.uri,
        component: path.resolve('./src/templates/post.js'),
        context: {
          id: post.id,
        },
      })
    })
  )
}
