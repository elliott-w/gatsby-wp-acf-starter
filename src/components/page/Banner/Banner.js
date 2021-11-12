import React from 'react'

const Banner = ({ title, description }) => {
  return (
    <section id="banner">
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  )
}

export default Banner
