import { createPickItIconResponse } from "@/lib/brand/pickit-icon";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

/** Apple touch icon for Safari / iOS home screen. */
export default function AppleIcon() {
  return createPickItIconResponse(180, { padded: true });
}
