import { ImageResponse } from "next/og";

/**
 * Ícono de la app generado en build-time (sin red, sin fuentes externas):
 * wordmark "BF" en esmeralda neón sobre un gradiente oscuro.
 *
 * `generateImageMetadata` emite dos tamaños (192 y 512) que el manifest y el
 * `<head>` usan para instalar la PWA. Al ser estático funciona con
 * `output: "export"`.
 */
export const dynamic = "force-static";
export const contentType = "image/png";

export function generateImageMetadata() {
  return [
    { id: "192", size: { width: 192, height: 192 }, contentType },
    { id: "512", size: { width: 512, height: 512 }, contentType },
  ];
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const size = (await id) === "512" ? 512 : 192;
  const pad = Math.round(size * 0.11);
  const radius = Math.round(size * 0.22);
  const fontSize = Math.round(size * 0.44);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #09090b 0%, #022c22 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: size - pad * 2,
            height: size - pad * 2,
            borderRadius: radius,
            border: `${Math.max(2, Math.round(size * 0.02))}px solid #10b981`,
            background: "rgba(16, 185, 129, 0.08)",
            color: "#10b981",
            fontSize,
            fontWeight: 700,
            letterSpacing: -Math.round(size * 0.02),
          }}
        >
          BF
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
