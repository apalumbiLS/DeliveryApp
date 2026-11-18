import { ImageResponse } from "next/og";

/**
 * The home-screen icon: the brand tile (accent blue, `--color-blue-700`) with
 * the white `TruckIcon`, full bleed. iOS and Android round the corners
 * themselves, so the image is square.
 */
export function appIcon(size: number): ImageResponse {
  const truck = Math.round(size * 0.6);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1d4ed8",
      }}
    >
      {/* The same paths as TruckIcon in components/ui/icons.tsx. */}
      <svg
        width={truck}
        height={truck}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
        <path d="M15 18H9" />
        <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
        <circle cx="17" cy="18" r="2" />
        <circle cx="7" cy="18" r="2" />
      </svg>
    </div>,
    { width: size, height: size },
  );
}
