
const createPages = require('./create/createPages')

module.exports.createPagesStatefully = async gatsbyUtilities => {
  // Assuming in your wordpress site you are registering a post type with
  // graphql_single_name = project
  await createPages({ postTypes: ['Page', 'Project'], gatsbyUtilities, })
}

