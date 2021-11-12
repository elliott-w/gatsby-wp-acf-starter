# Advanced Gatsby Wordpress ACF Starter

This is a bare-bones repository to help you get started building pages in gatsby in a component-like fashion with Wordpress using the Advanced Custom Field (ACF) plugin's Flexible Content field on multiple post types.
<br/>

Heavily inspired by Henrik Wirth's [gatsby-starter-wordpress-advanced](https://github.com/henrikwirth/gatsby-starter-wordpress-advanced/tree/tutorial/part-7)
<br/>

## How it works

1. Generates a file for every post of every post type (you specify) and stores these files in `.cache/page-templates`
2. Each of these page files imports **only** the components that are stored in the Flexible Content field in the Wordpress database
3. You only need to write one graphQL query for every component in a `fragment.js` file, for example:
```
components
└── page
      └── Banner
            ├── Banner.js
            └── fragment.js
            └── index.js
```
And the `create/createPages` file will stitch all those fragments together and store them in `src/fragments/components.js`
## Notes

Required plugins for your wordpress installation:
- Advanced Custom Fields PRO (or the standard version)
- WP Gatsby
- WP GraphQL
- [WPGraphQL for Advanced Custom Fields](https://github.com/wp-graphql/wp-graphql-acf/archive/master.zip)

I've included the `acf-json` folder which contains the field groups used in the example components. You can copy/paste this folder into your Wordpress theme folder and import the field groups to test for yourself.

I've also inserted some personal preference when it comes to the folder structure of components. That is, using the post type name as the parent folder for all the components related to that post type. And using global for everything not related to a post type. For example:
```
components
└── global
|     ├── Header
|     ├── Layout
│     └── Modal
└── page
│     ├── Banner
│     ├── GenericContent
│     └── ImageGallery
└── post
      ├── Banner
      └── Content
```

I've also included an example of how a specific component (e.g. `post/Banner`) can re-use a more generic component (e.g. `page/Banner`). Although I couldn't figure out a way to query the data a component needs inside the component itself (e.g. querying for post `title` and `date` in `post/Banner`), so I've just queried all the data a page might need (e.g. in `templates/post.js`) and lazily passed all that data to every child component (e.g. `post/Banner`).

Make sure you ignore `src/fragments/components.js` in your `.gitignore` file. I can't store this generated file in the `.cache` folder because otherwise Gatsby won't detect changes in it and hot-reloads won't refresh the queried data.

## Common Errors and Fixes
```
Cannot read properties of null (reading 'id')
```
This is might be because the page has a flexible content field with no layouts inside. Something about the cache messes things up. Run `npm run clean` to fix.
