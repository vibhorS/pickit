import { ImageResponse } from "next/og";

/** PickIt brand colors from app/globals.css */
export const PICKIT_RED = "#e50914";
export const PICKIT_BLACK = "#141414";
export const PICKIT_WHITE = "#ffffff";

type PickItIconOptions = {
  /** Extra inset for maskable / home-screen safe zone */
  padded?: boolean;
};

/**
 * Shared PickIt mark for App Router icon generation.
 * Red rounded tile + bold “P” + brand period.
 */
export function PickItIconMark({
  size,
  padded = false,
}: {
  size: number;
} & PickItIconOptions) {
  const inset = padded ? Math.round(size * 0.12) : 0;
  const inner = size - inset * 2;
  const radius = Math.round(inner * 0.22);
  const fontSize = Math.round(inner * 0.56);
  const dot = Math.max(2, Math.round(inner * 0.11));

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: PICKIT_BLACK,
      }}
    >
      <div
        style={{
          width: inner,
          height: inner,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: PICKIT_RED,
          borderRadius: radius,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            color: PICKIT_WHITE,
            fontSize,
            fontWeight: 800,
            fontFamily:
              "ui-sans-serif, system-ui, Helvetica, Arial, sans-serif",
            letterSpacing: "-0.06em",
            lineHeight: 1,
            paddingBottom: Math.round(inner * 0.04),
          }}
        >
          P
          <div
            style={{
              width: dot,
              height: dot,
              borderRadius: 999,
              background: PICKIT_BLACK,
              marginLeft: Math.max(1, Math.round(inner * 0.02)),
              marginBottom: Math.round(inner * 0.06),
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function createPickItIconResponse(
  size: number,
  options?: PickItIconOptions,
) {
  return new ImageResponse(
    <PickItIconMark size={size} padded={options?.padded} />,
    {
      width: size,
      height: size,
    },
  );
}
