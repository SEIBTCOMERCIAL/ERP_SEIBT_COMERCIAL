/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Modelos de Word das propostas, lidos em tempo de execução pela rota de .docx.
    outputFileTracingIncludes: {
      "/api/docx/[propostaId]": ["./templates/**/*"],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
