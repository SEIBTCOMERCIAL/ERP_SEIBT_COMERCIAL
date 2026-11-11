import { redirect } from "next/navigation";

// A lista da linha agora é a própria página de Produtos (navegação lateral por família/linha).
export default function LinhaPage({ params }: { params: { id: string } }) {
  redirect(`/produtos?escopo=${encodeURIComponent(params.id)}`);
}
