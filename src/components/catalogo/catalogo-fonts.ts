import { Archivo, IBM_Plex_Sans } from "next/font/google";

/**
 * Fontes do visual aprovado do catálogo. Carregadas só para essa área do
 * ERP (não afeta o resto do sistema, que usa a fonte padrão Geist).
 */
export const archivo = Archivo({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

export const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});
