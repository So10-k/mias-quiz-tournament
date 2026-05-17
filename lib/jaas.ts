// Server-side JWT signing for Jitsi-as-a-Service (JaaS / 8x8 cloud
// Jitsi). The 8x8 endpoint requires every iframe load to carry a
// signed JWT identifying who's joining and at what role
// (moderator vs participant). We sign with the RSA private key
// JaaS generated when the API key was created.
//
// Spec: https://developer.8x8.com/jaas/docs/api-keys-jwt
//
// Env required (set in Vercel):
//   JAAS_APP_ID         — vpaas-magic-cookie-...
//   JAAS_KID            — <app id>/<random suffix>
//   JAAS_PRIVATE_KEY    — full PEM of the private key (multi-line)

import { SignJWT, importPKCS8 } from "jose";

export type JaasTokenInput = {
  // Room name — within the JaaS tenant, scoped to your app id.
  // We use a stable name like "finals-room" so links are
  // shareable.
  roomName: string;
  // Identifies the joining user. Pass "*" to grant access to ALL
  // rooms in your app — only used for hosts who switch rooms.
  user: {
    id: string;
    name: string;
    email?: string;
    avatar?: string;
    // True = host (can mute others, kick, end meeting). False =
    // regular participant.
    moderator: boolean;
  };
  // Token TTL in seconds. JaaS recommends 2 hours.
  ttlSeconds?: number;
};

let cachedKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const pem = process.env.JAAS_PRIVATE_KEY;
  if (!pem) throw new Error("JAAS_PRIVATE_KEY not set");
  cachedKey = await importPKCS8(pem, "RS256");
  return cachedKey;
}

export async function signJaasToken(
  input: JaasTokenInput
): Promise<string> {
  const appId = process.env.JAAS_APP_ID;
  const kid = process.env.JAAS_KID;
  if (!appId || !kid) throw new Error("JAAS_APP_ID / JAAS_KID not set");
  const ttl = input.ttlSeconds ?? 60 * 60 * 2; // 2h default
  const now = Math.floor(Date.now() / 1000);

  const key = await getKey();
  const jwt = await new SignJWT({
    aud: "jitsi",
    iss: "chat",
    sub: appId,
    room: input.roomName,
    context: {
      user: {
        id: input.user.id,
        name: input.user.name,
        email: input.user.email,
        avatar: input.user.avatar,
        moderator: input.user.moderator ? "true" : "false",
      },
      features: {
        livestreaming: input.user.moderator ? "true" : "false",
        "outbound-call": "false",
        transcription: "true",
        recording: input.user.moderator ? "true" : "false",
      },
    },
  })
    .setProtectedHeader({ alg: "RS256", kid, typ: "JWT" })
    .setIssuedAt(now)
    .setNotBefore(now - 10) // small clock skew tolerance
    .setExpirationTime(now + ttl)
    .sign(key);

  return jwt;
}

// Build the full JaaS room name (tenant-scoped) for the iframe API.
// Format: <appId>/<roomName>
export function jaasRoomFullName(roomName: string): string {
  const appId = process.env.JAAS_APP_ID;
  if (!appId) return roomName;
  return `${appId}/${roomName}`;
}
