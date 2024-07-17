import { Html, Head, Main, NextScript } from "next/document";

const meta = {
  title: 'Raydium Market Platform',
  description: '',
  icons: "../favicon.ico",
  image: "../Og.png",
  type: "website",
};

export default function Document() {
  return (
    <Html lang="en">
      <Head>
      <title>{meta.title}</title>
        {/* <title>{meta.title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="follow, index" />
        <meta content={meta.description} name="description" />
        <meta property="og:url" content={`https://dashboard.theruneguardians.com`} />
        <link rel="canonical" href={`https://dashboard.theruneguardians.com`} />
        <link rel="icon" href={meta.icons} sizes="any" />
        <meta property="og:type" content={meta.type} />
        <meta property="og:site_name" content="The Rune Guardians" />
        <meta property="og:description" content={meta.description} />
        <meta property="og:title" content={meta.title} />
        <meta property="og:image" content={`https://dashboard.theruneguardians.com/Og.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@RuneGuardians" />
        <meta name="twitter:title" content={meta.title} />
        <meta name="twitter:description" content={meta.description} />
        <meta name="twitter:image" content={`https://dashboard.theruneguardians.com/Og.png`} /> */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
