import { ImageResponse } from "next/og";

// iOS home-screen icon (apple-touch-icon). iOS ignores SVG/manifest icons here,
// so we generate a 180x180 PNG. Full-bleed fill — iOS applies its own rounding.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#059669",
          color: "#ffffff",
          fontSize: 96,
          fontWeight: 700,
          fontFamily: "sans-serif",
          letterSpacing: -4,
        }}
      >
        LL
      </div>
    ),
    size,
  );
}
