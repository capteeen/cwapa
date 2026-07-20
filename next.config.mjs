/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Railway provides these during the production build. Declaring the public
  // values here ensures Next replaces them in client bundles instead of
  // leaving a browser-side `process.env` lookup, which is always empty.
  env: {
    NEXT_PUBLIC_INSFORGE_URL: process.env.NEXT_PUBLIC_INSFORGE_URL,
    NEXT_PUBLIC_INSFORGE_ANON_KEY: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
};

export default nextConfig;
