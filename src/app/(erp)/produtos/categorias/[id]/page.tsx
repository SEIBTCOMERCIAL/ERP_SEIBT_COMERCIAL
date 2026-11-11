import { redirect } from "next/navigation";

// As peças de uma categoria agora ficam na aba Peças da página de Produtos.
export default function CategoriaPage({ params }: { params: { id: string } }) {
  redirect(`/produtos?aba=pecas&escopo=${encodeURIComponent(params.id)}`);
}
