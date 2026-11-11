// Reduz fotos grandes no navegador antes do envio (a hospedagem recusa requisições acima de ~4,5 MB).
import { LIMITE_UPLOAD_BYTES } from "@/lib/produtos/regras";

const MARGEM = 256 * 1024;
const LADO_MAXIMO = 2400;

function carregar(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("imagem ilegível")); };
    img.src = url;
  });
}

/** Devolve o mesmo arquivo se já cabe no limite; senão, uma cópia em JPEG redimensionada. Sem suporte do navegador: o original. */
export async function prepararImagem(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= LIMITE_UPLOAD_BYTES - MARGEM) return file;
  try {
    const img = await carregar(file);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * escala));
    canvas.height = Math.max(1, Math.round(img.height * escala));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const qualidade of [0.88, 0.8, 0.7, 0.6, 0.5]) {
      const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", qualidade));
      if (blob && blob.size <= LIMITE_UPLOAD_BYTES - MARGEM) {
        return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      }
    }
    return file;
  } catch {
    return file;
  }
}
