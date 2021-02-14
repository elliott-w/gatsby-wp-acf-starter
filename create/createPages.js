const path = require('path')
const unique = require('lodash.uniq')
const {
  readdirSync,
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
} = require('fs')

const pageTemplateFile = path.join(process.cwd(), 'src', 'templates', 'page.js')
const componentsFolder = path.join(process.cwd(), 'src', 'components', 'page')
const templateFolder = path.join(process.cwd(), '.cache', 'page-templates')
const dev = process.env.NODE_ENV !== 'production'

module.exports = async ({ postTypes = ['Page'], gatsbyUtilities }) => {
  // Create the folder for storing temporary page templates
  if (!existsSync(templateFolder)) {
    mkdirSync(templateFolder, { recursive: true })
  }
  const pages = await getPages(postTypes, gatsbyUtilities)
  await createPages(pages, gatsbyUtilities)
}

/**
 * Uses graphql to get all wordpress pages
 */
const getPages = async (postTypes, { graphql }) => {
  const graphqlResult = await graphql(`
    query GetAllPagesWithComponents {
      ${postTypes.map(postType => {
        return `
          allWp${postType} {
            nodes {
              id
              databaseId
              nodeType
              slug
              uri
              template {
                templateName
              }
              ${getComponentsQuery(postType)}
            }
          }
        `
      }).join()}
    }
  `)
  if (graphqlResult.errors) {
    console.error(graphqlResult.errors)
    throw new Error('GraphQL query failed')
  }

  // Combine the different post type queries into a single array of nodes (pages)
  let pages = []
  postTypes.forEach(postType => {
    pages = pages.concat(graphqlResult.data[`allWp${postType}`].nodes)
  })

  return pages
}

const createPages = async (pages, gatsbyUtilities) => {
  return Promise.all(
    pages.map(page => {

      // If page has no components yet, initialise as empty array rather than null
      const components = page.page_components.components || []

      // Removes all duplicates, as we only need to import each component once
      const uniqueComponentNames = unique(
        components.map(component => {
          return component.__typename.split('_').pop()
        })
      )

      const template = page.template.templateName
      // Since the page builder field only shows when page template = Default
      if (template === 'Default') {
        const pageTemplate = createTemporaryPageTemplateFile(
          page.databaseId,
          page.nodeType,
          page.slug,
          uniqueComponentNames
        )
        return gatsbyUtilities.actions.createPage({
          path: page.uri,
          component: pageTemplate,
          context: {
            id: page.id,
          },
        })
      } else {
        // Assume there exists a js template file corresponding to the
        // slug-inated (definitely did not make that word up) version
        // of the template name
        const templateSlug = template.toLowerCase().replace(/\s/g, '-')
        const pageTemplate = path.resolve(`./src/templates/${templateSlug}.js`)
        return gatsbyUtilities.actions.createPage({
          path: page.uri,
          component: pageTemplate,
          context: {
            title: page.title,
            id: page.id,
          },
          data
        })
      }
    })
  )
}

/**
 * Problem: If we use the same page template file for every individual page,
 * then every page has to import every component in the flexible content field (page builder),
 * regardless of whether that page actually uses every component. This increases the file size
 * of every page generated.
 *
 * Solution: Create a template file for every individual page which only imports the components
 * it requires.
 */
const createTemporaryPageTemplateFile = (databaseId, postType, slug, componentNames) => {

  // In development mode, just import all the components so components can be
  // added/removed from a page in the CMS without restarting the dev server
  if (dev) {
    componentNames = getDirectories(componentsFolder)
  }

  // Use page.js as the base template to work from
  let pageTemplateString = readFileSync(pageTemplateFile, 'utf8')

  // Since this temporary page template will be stored in .cache/page-templates
  // instead of src/templates, all the normal import paths need to be adjusted
  pageTemplateString = pageTemplateString.replace(
    new RegExp("from '../", 'mg'),
    "from '../../src/"
  )

  // Create the string which will import all the components this page needs
  const componentImportString = componentNames
  .map(componentName => {
    return `import ${componentName} from '../../src/components/page/${componentName}'`
  })
  .join('\n')

  // Create the string which set the data variable
  const dataVariableString = `data = pageProps.data.wp${postType}`

  // Create the string which will conditionally render all the components this page needs
  const componentRenderString = componentNames
  .map(componentName => {
    return `
      if (component.name == '${componentName}') {
        return <${componentName} {...component.data} key={index} />
      }
    `
  })
  .join('\n')

  // Create the string which will query the data the page needs
  const pageQueryString = `
    export const query = graphql\`
      query PageQuery${databaseId}($id: String!) {
        wp${postType}(id: {eq: $id}) {
          title
          ${getComponentsQuery(postType)}
        }
      }
    \`
  `

  // Inject the component imports
  pageTemplateString = pageTemplateString.replace(
    new RegExp('^.*COMPONENT IMPORTS.*$', 'mg'),
    componentImportString
  )

  // Inject the data variable
  pageTemplateString = pageTemplateString.replace(
    new RegExp('^.*DATA VARIABLE.*$', 'mg'),
    dataVariableString
  )

  // Inject the conditional component rendering
  pageTemplateString = pageTemplateString.replace(
    new RegExp('^.*COMPONENT RENDERING.*$', 'mg'),
    componentRenderString
  )

  // Inject the page query
  pageTemplateString = pageTemplateString.replace(
    new RegExp('^.*PAGE QUERY.*$', 'mg'),
    pageQueryString
  )

  // Use slug for readability/debugging these files later.
  // Need id as well, since slugs do not determine uniqueness in page hierarchies
  const tempPageTemplateFile = path.join(templateFolder, `${slug}-${databaseId}.js`)
  writeFileSync(tempPageTemplateFile, pageTemplateString)
  return tempPageTemplateFile
}

const getComponentsQuery = postType => {
  return `
    page_components {
      components {
        __typename
        ${getAllComponentFragments(postType)}
      }
    }
  `
}

/**
 * Crawls through all the *.data.js files in the components folders
 * and combines the graphql fragments into a single query
 */
const getAllComponentFragments = postType => {
  const componentNames = getDirectories(componentsFolder)

  let allComponentFragments = ''
  componentNames.forEach(componentName => {
    const componentDataFile = path.join(
      componentsFolder,
      componentName,
      `${componentName}.data.js`
    )
    const query = require(componentDataFile)
    
    // This assumes your:
    // 1. ACF Field Group's GraphQL Field Name = page_components
    // 2. Flexible Content Field Name = components
    const fragment = `
      ... on Wp${postType}_PageComponents_Components_${componentName} {
        ${query()}
      }
    `
    allComponentFragments += ' \n ' + fragment
  })

  return allComponentFragments
}

/**
 * Returns an array of all the folder names within a given folder
 */
const getDirectories = source => {
  return readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
}
