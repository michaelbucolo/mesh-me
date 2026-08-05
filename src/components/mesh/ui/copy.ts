// meshCopy — every user-facing string whose meaning depends on WHOSE mesh
// you're looking at, derived in ONE place from ViewerCaps + the owner's
// identity. Kills the scattered ownership-language bugs ("Search your mesh"
// while visiting, "Your people" on someone else's list). Owner-view strings
// are kept verbatim from the old scene.

import type { ViewerCaps } from "../core/viewer";

export interface MeshOwnerIdentity {
  username: string;
  displayName: string | null;
}

export interface MeshCopy {
  /** "your mesh" / "Ana's mesh" / "the Global Mesh" */
  meshNoun: string;
  searchLabel: string;
  searchPlaceholder: string;
  listAria: string;
  listPeopleHeading: string;
  listMadeByHeading: string;
  listPlatformsHeading: string;
  /** Lens stream suffix: "3 / 12 {streamLabel}". */
  streamLabel: string;
  shareLabel: string;
  shareTitle: string;
  shareText: string;
  composeLabel: string;
  rewindHeadingSubject: string;
}

export function meshCopy(caps: ViewerCaps, owner?: MeshOwnerIdentity | null): MeshCopy {
  if (caps.isGlobal) {
    return {
      meshNoun: "the Global Mesh",
      searchLabel: "Search the Global Mesh",
      searchPlaceholder: "Find a person, post, platform…",
      listAria: "The Global Mesh as a list",
      listPeopleHeading: "People — closest first",
      listMadeByHeading: "Made here — newest first",
      listPlatformsHeading: "Platforms — the wider internet",
      streamLabel: "on the Global Mesh",
      shareLabel: "Share this mesh",
      shareTitle: "The Global Mesh on mesh.me",
      shareText: "The whole world, woven into one mesh.",
      composeLabel: "Create on your mesh",
      rewindHeadingSubject: "This mesh",
    };
  }
  if (caps.isOwner) {
    return {
      meshNoun: "your mesh",
      searchLabel: "Search your mesh",
      searchPlaceholder: "Find a person, post, platform…",
      listAria: "Your mesh as a list",
      listPeopleHeading: "Your people — closest first",
      listMadeByHeading: "Made by you — newest first",
      listPlatformsHeading: "Your platforms — the wider internet",
      streamLabel: "on your mesh",
      shareLabel: "Share your mesh",
      shareTitle: "My mesh on mesh.me",
      shareText: "Step into my world — everything I make, in one living mesh.",
      composeLabel: "Create on your mesh",
      rewindHeadingSubject: "Your mesh",
    };
  }
  const name = owner ? owner.displayName || `@${owner.username}` : "them";
  const handle = owner ? `@${owner.username}` : "them";
  return {
    meshNoun: `${name}'s mesh`,
    searchLabel: "Search this mesh",
    searchPlaceholder: "Find a person, post, platform…",
    listAria: `${name}'s mesh as a list`,
    listPeopleHeading: `${name}'s people — closest first`,
    listMadeByHeading: `Made by ${name} — newest first`,
    listPlatformsHeading: `${name}'s platforms — the wider internet`,
    streamLabel: "on this mesh",
    shareLabel: "Share this mesh",
    shareTitle: `${handle}'s mesh on mesh.me`,
    shareText: `Step into ${handle}'s world on mesh.me.`,
    composeLabel: "Create on your mesh",
    rewindHeadingSubject: "This mesh",
  };
}
