import agoraToken from "agora-token";
import { config } from "../config.js";

const { RtcRole, RtcTokenBuilder } = agoraToken;

export type AgoraRtcRole = "host" | "audience";

const TOKEN_EXPIRE_SECONDS = 60 * 60 * 4; // 4 hours -- comfortably covers one live session

export function isAgoraConfigured(): boolean {
  return Boolean(config.AGORA_APP_ID && config.AGORA_APP_CERTIFICATE);
}

/** Mints a real, signed Agora RTC token for one user joining one channel.
 * Falls back to a null token (Agora's own testing/no-auth mode) when no
 * certificate is configured, matching Agora's documented behavior for
 * projects still in App-ID-only testing mode. */
export function generateAgoraRtcToken(
  channelName: string,
  uid: number,
  role: AgoraRtcRole
): { appId: string; token: string | null; uid: number; channelName: string; expiresInSeconds: number } {
  const appId = config.AGORA_APP_ID ?? "";

  if (!isAgoraConfigured()) {
    return { appId, token: null, uid, channelName, expiresInSeconds: TOKEN_EXPIRE_SECONDS };
  }

  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    config.AGORA_APP_CERTIFICATE as string,
    channelName,
    uid,
    role === "host" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER,
    TOKEN_EXPIRE_SECONDS,
    TOKEN_EXPIRE_SECONDS
  );

  return { appId, token, uid, channelName, expiresInSeconds: TOKEN_EXPIRE_SECONDS };
}
