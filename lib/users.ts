import type { User } from "@/lib/types";

/** Local viewer — all interactive votes belong to this user. */
export const CURRENT_USER: User = {
  id: "you",
  name: "You",
};

/** Placeholder partner — votes come from mock data until auth exists. */
export const PARTNER_USER: User = {
  id: "partner",
  name: "Urvashi",
};
