const path = require('path')
const unique = require('lodash.uniq')
const {
  readdirSync,
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
} = require('fs')
const chokidar = require('chokidar')
const http = require('http')

const pageTemplateFile = path.join(process.cwd(), 'src', 'templates', 'page.js')
const componentsFolder = path.join(process.cwd(), 'src', 'components', 'page')
const cacheFolder = path.join(process.cwd(), '.cache', 'page-templates')
const fragmentsFolder = path.join(process.cwd(), 'src', 'fragments')
const fragmentsFile = path.join(fragmentsFolder, 'components.js')

const dev = process.env.NODE_ENV !== 'production'
if (dev) {
  // Needed for the watchPageTemplateFile() function
}

const options = {
  postTypes: ['Page'],
  graphQLFieldGroupName: 'pageComponents',
  graphQLFieldName: 'pageComponents',
}

module.exports.setOptions = theOptions => {
  if (typeof theOptions === 'undefined') {
    theOptions = {}
  }
  for (const [option, value] of Object.entries(theOptions)) {
    options[option] = value
  }
}

module.exports.createPages = async gatsbyUtilities => {
  // Create the folder for storing temporary page templates
  if (!existsSync(cacheFolder)) {
    mkdirSync(cacheFolder, { recursive: true })
  }
  const pages = await getPages(gatsbyUtilities)
  await createPages(pages, gatsbyUtilities)
}

/**
 * Uses graphql to get all wordpress pages
 */
const getPages = async ({ graphql }) => {
  const query = `
    query GetAllPagesWithComponents {
      ${options.postTypes
        .map(postType => {
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
        })
        .join()}
    }
  `
  const graphqlResult = await graphql(query)
  if (graphqlResult.errors) {
    console.error(graphqlResult.errors)
    throw new Error('GraphQL query failed')
  }

  // Combine the different post type queries into a single array of nodes (pages)
  let pages = []
  options.postTypes.forEach(postType => {
    pages = pages.concat(graphqlResult.data[`allWp${postType}`].nodes)
  })

  return pages
}

const createPages = async (pages, gatsbyUtilities) => {
  return Promise.all(
    pages.map(page => {
      // If page has no components yet, initialise as empty array rather than null
      const components =
        page[options.graphQLFieldGroupName][options.graphQLFieldName] || []

      // Removes all duplicates, as we only need to import each component once
      // Also need to sort otherwise mini-css-extract has problems with chunk ordering
      const uniqueComponentNames = unique(
        components.map(component => {
          return component.__typename.split('_').pop()
        })
      ).sort()

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
        // const templateSlug = template.toLowerCase().replace(/\s/g, '-')
        // const pageTemplate = path.resolve(`./src/templates/${templateSlug}.js`)
        // return gatsbyUtilities.actions.createPage({
        //   path: page.uri,
        //   component: pageTemplate,
        //   context: {
        //     title: page.title,
        //     id: page.id,
        //   },
        // })
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
const createTemporaryPageTemplateFile = (
  databaseId,
  postType,
  slug,
  componentNames
) => {
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

  // Create the string which sets the components variable
  const componentsVariableString = `
    components = pageProps.data.wp${postType}['${options.graphQLFieldGroupName}']['${options.graphQLFieldName}'] || []
  `

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
          ${getComponentsQuery(postType, true, componentNames)}
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
    new RegExp('^.*COMPONENTS VARIABLE.*$', 'mg'),
    componentsVariableString
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
  const tempPageTemplateFile = path.join(
    cacheFolder,
    `${slug}-${databaseId}.js`
  )
  writeFileSync(tempPageTemplateFile, pageTemplateString)
  return tempPageTemplateFile
}

const getComponentsQuery = (
  postType,
  withFragments = false,
  componentNames = undefined
) => {
  return `
    ${options.graphQLFieldGroupName} {
      ${options.graphQLFieldName} {
        __typename
        ${
          withFragments
            ? getComponentFragments(postType, componentNames, true)
            : ''
        }
      }
    }
  `
}

/**
 * Crawls through all the fragment.js files in the components folders
 * and combines the graphql fragments into a single query
 */
const getComponentFragments = (
  postType,
  componentNames = undefined,
  referenceFragment = false
) => {
  if (!componentNames) {
    componentNames = getDirectories(componentsFolder)
  }

  let componentFragments = ''
  componentNames.forEach(componentName => {
    const componentFragmentFile = path.join(
      componentsFolder,
      componentName,
      `fragment.js`
    )

    // The fragment file is cached when initially required on `npm run dev`, so if we udpate
    // the file later during development, it triggers an update in gatsby and we need to clear
    // it from the cache to get the latest version
    if (componentFragmentFile in require.cache) {
      delete require.cache[componentFragmentFile]
    }
    const query = require(componentFragmentFile)

    const graphQLFieldGroupName = capitalizeFirstLetter(
      options.graphQLFieldGroupName.toLowerCase()
    )

    const fieldName = capitalizeFirstLetter(options.graphQLFieldName)

    const fragmentName = `${postType}_${componentName}`
    let fragment
    if (referenceFragment) {
      fragment = `
      ... on Wp${postType}_${graphQLFieldGroupName}_${fieldName}_${componentName} {
        ...${fragmentName}
      }
    `
    } else {
      fragment = `
      fragment ${fragmentName} on Wp${postType}_${graphQLFieldGroupName}_${fieldName}_${componentName} {
        ${query()}
      }
    `
    }
    componentFragments += ' \n ' + fragment
  })

  return componentFragments
}

/**
 * Returns an array of all the folder names within a given folder
 */
const getDirectories = source => {
  return readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
}

const capitalizeFirstLetter = string => {
  return string[0].toUpperCase() + string.slice(1)
}

// This creates a file which contains all the possible combinations of
// of graphql fragments for post types and components
const createFragments = () => {
  if (!existsSync(fragmentsFolder)) {
    mkdirSync(fragmentsFolder, { recursive: true })
  }
  const fragments = options.postTypes
    .map(postType => {
      return getComponentFragments(postType)
    })
    .join('')

  writeFileSync(
    fragmentsFile,
    `
    import { graphql } from 'gatsby'
  
    export const componentFragments = graphql\`
      ${fragments}
    \`
    `
  )
}

/**
 * Watches all the fragment.js files for changes and updates the fragments file
 * that Gatsby is watching, which then triggers Gatsby to refresh its queries
 */
const watchFragments = () => {
  const fragmentGlob = path.join(componentsFolder, '*', 'fragment.js')
  const watcher = chokidar.watch(fragmentGlob)
  watcher.on('change', () => {
    createFragments()
  })
}

const watchPageTemplateFile = () => {
  const watcher = chokidar.watch(pageTemplateFile)
  watcher.on('change', () => {
    // This is required to enable the __refresh endpoint
    // Has to be set here because f it's set too early,
    // gatsby won't listen to changes from wordpress
    process.env.ENABLE_GATSBY_REFRESH_ENDPOINT = true
    const req = http.request('http://localhost:8000/__refresh', {
      method: 'POST',
    })
    req.end()
  })
}

createFragments()
if (dev) {
  watchFragments()
  watchPageTemplateFile()
}
