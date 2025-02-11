import '@fontsource/recursive'
import Head from 'next/head'
import type React from 'react'
import '~styles/globals.css'
const APP_NAME = 'Quickpose'
const APP_DESCRIPTION = 'Version Control for Processing'
const APP_URL = 'https://quickpose.ericrawn.media'
const IMAGE = 'https://github.com/erawn/Quickpose/blob/ab4f533c0e6f3f2c45337b2157b81a9e43fff7bc/assets/quickpose-social.png?raw=true'

function MyApp({ Component, pageProps }: any) {

  return (
    <>
      <Head>
        <meta name="application-name" content={APP_NAME} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />
        <meta name="description" content={APP_DESCRIPTION} />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#fafafa" />

        <meta name="twitter:url" content={APP_URL} />
        <meta name="twitter:title" content={APP_NAME} />
        <meta name="twitter:description" content={APP_DESCRIPTION} />
        <meta name="twitter:card" content={IMAGE} />
        <meta name="twitter:creator" content="@erawn" />
        <meta name="twitter:site" content="@erawn" />
        <meta name="twitter:image" content={IMAGE} />

        <meta property="og:type" content="website" />
        <meta property="og:title" content={APP_NAME} />
        <meta property="og:description" content={APP_DESCRIPTION} />
        <meta property="og:site_name" content={APP_NAME} />
        <meta property="og:url" content={APP_URL} />
        <meta property="og:image" content={IMAGE} />

        <meta httpEquiv='cache-control' content='no-cache'/>
        <meta httpEquiv='expires' content='0'/>
        <meta httpEquiv='pragma' content='no-cache'/>

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no"
        />

        <link rel="manifest" href="/manifest.json" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />

        <title>Quickpose</title>
      </Head>
      <Component {...pageProps} />
    </>
  )
}

export default MyApp
