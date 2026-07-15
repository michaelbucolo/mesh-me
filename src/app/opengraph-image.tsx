import { ImageResponse } from "next/og";
import { meshBrand } from "@/lib/brand";

export const runtime = "edge";
export const alt = `${meshBrand.name} - ${meshBrand.motto}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const colors = meshBrand.colors;

function MeshiMark() {
  return (
    <div
      style={{
        width: 172,
        height: 172,
        borderRadius: 48,
        background: colors.ink,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 28px 80px rgba(0,0,0,0.28)",
      }}
    >
      <div
        style={{
          width: 112,
          height: 112,
          borderRadius: 999,
          background: `radial-gradient(circle at 34% 24%, #ffffff 0, #b9dcff 38%, ${colors.meshBlue} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 33,
            top: 48,
            width: 16,
            height: 16,
            display: "flex",
            borderRadius: 999,
            background: colors.ink,
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 33,
            top: 48,
            width: 16,
            height: 16,
            display: "flex",
            borderRadius: 999,
            background: colors.ink,
          }}
        />
      </div>
    </div>
  );
}

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 72,
          background: colors.ink,
          color: colors.white,
          fontFamily: "Arial, Helvetica, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "radial-gradient(circle at 18% 20%, rgba(88,166,255,0.26), transparent 28%), radial-gradient(circle at 82% 72%, rgba(34,197,94,0.12), transparent 26%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 34,
            display: "flex",
            border: "1px solid rgba(154,167,184,0.18)",
            borderRadius: 40,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 28, width: 720, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 18, height: 18, display: "flex", borderRadius: 999, background: colors.meshBlue }} />
            <div style={{ display: "flex", fontSize: 30, fontWeight: 800 }}>{meshBrand.name}</div>
          </div>
          <div style={{ display: "flex", fontSize: 74, lineHeight: 0.96, fontWeight: 900, letterSpacing: 0 }}>
            {meshBrand.motto}
          </div>
          <div style={{ display: "flex", fontSize: 28, lineHeight: 1.32, color: "#c4ccd8", maxWidth: 680 }}>
            {meshBrand.openGraphDescription}
          </div>
          <div style={{ display: "flex", gap: 12, color: "#dbeafe", fontSize: 22, fontWeight: 700 }}>
            <span>Private</span>
            <span style={{ color: colors.muted }}>-</span>
            <span>Secure</span>
            <span style={{ color: colors.muted }}>-</span>
            <span>No ads</span>
          </div>
        </div>
        <div style={{ position: "relative", display: "flex" }}>
          <MeshiMark />
        </div>
      </div>
    ),
    size
  );
}
