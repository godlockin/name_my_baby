/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  distDir: ".vercel/output/static",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
