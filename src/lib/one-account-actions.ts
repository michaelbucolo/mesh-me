"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clearMeshCache } from "@/lib/mesh-cache";

function revalidateIdentitySurfaces(username: string) {
  revalidatePath("/one-account");
  revalidatePath("/connected-accounts");
  revalidatePath("/profile");
  revalidatePath(`/profile/${username}`);
}

export async function foldPersonaIntoMainIdentity(alterEgoId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const persona = await prisma.alterEgo.findFirst({
    where: { id: alterEgoId, userId: user.id, isActive: true },
  });
  if (!persona) return { error: "Persona not found" };

  await prisma.$transaction(async (tx) => {
    await tx.connectedAccount.updateMany({
      where: { userId: user.id, alterEgoId: persona.id },
      data: { alterEgoId: null },
    });
    await tx.alterEgo.update({ where: { id: persona.id }, data: { isActive: false } });

    // Adopt identity details the persona carried when the main account is missing them.
    const identityGaps: { bio?: string; avatarUrl?: string } = {};
    if (!user.bio && persona.bio) identityGaps.bio = persona.bio;
    if (!user.avatarUrl && persona.avatarUrl) identityGaps.avatarUrl = persona.avatarUrl;
    if (Object.keys(identityGaps).length > 0) {
      await tx.user.update({ where: { id: user.id }, data: identityGaps });
    }
  });

  revalidateIdentitySurfaces(user.username);
  clearMeshCache(user.id);
  return { success: true as const, personaName: persona.displayName };
}

export async function detachAccountFromPersona(connectedAccountId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const account = await prisma.connectedAccount.findFirst({
    where: { id: connectedAccountId, userId: user.id },
    select: { id: true, alterEgoId: true },
  });
  if (!account) return { error: "Account not found" };
  if (!account.alterEgoId) return { success: true as const };

  await prisma.connectedAccount.update({
    where: { id: account.id },
    data: { alterEgoId: null },
  });

  revalidateIdentitySurfaces(user.username);
  clearMeshCache(user.id);
  return { success: true as const };
}
