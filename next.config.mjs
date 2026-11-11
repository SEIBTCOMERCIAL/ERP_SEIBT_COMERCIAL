/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Envio de fotos e documentos: a hospedagem recusa requisições acima de ~4,5 MB (limite de arquivo na tela: 4 MB).
    serverActions: { bodySizeLimit: "4.5mb" },
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
