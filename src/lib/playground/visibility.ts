export type Visibility = "private" | "unlisted" | "public";

export interface LayoutGate {
  visibility: Visibility;
  owner_token: string;
}

export function canViewLayout(layout: LayoutGate, viewer: string | null): boolean {
  if (layout.visibility !== "private") return true;
  return viewer !== null && viewer === layout.owner_token;
}

export function canMutateLayout(layout: LayoutGate, viewer: string | null): boolean {
  return viewer !== null && viewer === layout.owner_token;
}
