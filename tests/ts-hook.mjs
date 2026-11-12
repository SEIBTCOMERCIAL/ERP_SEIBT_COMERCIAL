// Permite que os testes importem arquivos .ts do projeto: aceita imports sem extensão e o atalho "@/".
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as caminho } from "node:path";

const raiz = caminho(dirname(fileURLToPath(import.meta.url)), "..");

export async function resolve(especificador, contexto, proximo) {
  let alvo = null;
  if (especificador.startsWith("@/")) alvo = caminho(raiz, "src", especificador.slice(2));
  else if (especificador.startsWith(".") && contexto.parentURL) alvo = caminho(dirname(fileURLToPath(contexto.parentURL)), especificador);
  if (alvo && !/\.[cm]?[jt]sx?$/.test(alvo)) {
    for (const ext of [".ts", ".tsx", "/index.ts"]) {
      if (existsSync(alvo + ext)) return proximo(pathToFileURL(alvo + ext).href, contexto);
    }
  }
  if (especificador === "next/headers" || especificador === "next/cache") return proximo(especificador + ".js", contexto);
  return proximo(especificador, contexto);
}
