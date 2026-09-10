import { ImageResponse } from "next/og";

/**
 * Apple touch icon (180x180) para "Agregar a la pantalla de inicio" en iOS.
 * Mismo wordmark "BF" que `app/icon.tsx`, generado en build-time.
 */
export const dynamic = "force-static";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const { width } = size;
  const pad = Math.round(width * 0.1);
  const radius = Math.round(width * 0.22);
  const fontSize = Math.round(width * 0.44);

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
            width: width - pad * 2,
            height: width - pad * 2,
            borderRadius: radius,
            border: "4px solid #10b981",
            background: "rgba(16, 185, 129, 0.08)",
            color: "#10b981",
            fontSize,
            fontWeight: 700,
            letterSpacing: -4,
          }}
        >
          BF
        </div>
      </div>
    ),
    size,
  );
}
