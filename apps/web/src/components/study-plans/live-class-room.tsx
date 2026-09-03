"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Mic, MicOff, PhoneOff, Radio, Users, Video as VideoIcon, VideoOff } from "lucide-react";
import { authenticatedGet, authenticatedPost, useAuth } from "../auth/auth-context";
import { studyPlanHref } from "../../lib/study-plans";
import { HostStage, type StageMode } from "./live-class-stage";
import { LiveClassChat } from "./live-class-chat";

/**
 * The web room for a study-plan live class.
 *
 * The backend has minted Agora tokens for these classes since migration 045,
 * and the Flutter app has joined them since — but the web app never had a room
 * to join, so a class scheduled from the admin builder could only be attended
 * on a phone. (The admin screen said as much: "Join from the mobile app to
 * broadcast.") This is the missing half, plus the teaching tools that make a
 * class more than a video call: screen sharing, a whiteboard, live annotation,
 * chat, and hands.
 *
 * Roles are decided by the server, not here: `/token` returns "host" or
 * "audience" after checking ownership/enrolment, and this component only
 * mirrors that answer into Agora's own client role. A viewer cannot promote
 * themselves by editing anything client-side — the token itself is minted for
 * SUBSCRIBER and Agora rejects publishing with it.
 *
 * The host publishes ONE video track for the whole class: a canvas that
 * composites camera, screen share and annotations (see live-class-stage). That
 * keeps every switch between them invisible to viewers, and means students on
 * the existing Flutter app see annotations without a line of mobile code.
 */

type LiveClassCredentials = {
  appId: string;
  /** Null when the project is still in Agora's App-ID-only testing mode. */
  token: string | null;
  uid: number;
  channelName: string;
  role: "host" | "audience";
  expiresInSeconds: number;
};

type LiveClassRoomProps = {
  liveClassId: number;
  /** Where "Leave" returns to — the plan, or the admin builder for a host. */
  returnHref?: string;
  title?: string;
};

export function LiveClassRoom({ liveClassId, returnHref, title }: LiveClassRoomProps) {
  const router = useRouter();
  const { token, user, isInitialized } = useAuth();

  const [credentials, setCredentials] = useState<LiveClassCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [micActive, setMicActive] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [stageMode, setStageMode] = useState<StageMode>("camera");
  const [remoteCount, setRemoteCount] = useState(0);
  const [ending, setEnding] = useState(false);

  const viewerStageRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const localAudioTrackRef = useRef<any>(null);
  const publishedVideoTrackRef = useRef<any>(null);
  /** The composited canvas stream, held until the client is ready to publish. */
  const canvasStreamRef = useRef<MediaStream | null>(null);

  const isHost = credentials?.role === "host";

  useEffect(() => {
    if (isInitialized && !user) router.push("/login");
  }, [isInitialized, user, router]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    void authenticatedGet<LiveClassCredentials>(`/api/v1/study-plan-live-classes/${liveClassId}/token`, token)
      .then((record) => {
        if (cancelled) return;
        setCredentials(record);
        setErrorMsg(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // The API says exactly why (not started yet, ended, not enrolled) —
        // surfacing its own words beats a generic "could not join".
        setErrorMsg(error instanceof Error ? error.message : "Could not join this class.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, liveClassId]);

  const leaveChannel = useCallback(async () => {
    localAudioTrackRef.current?.close();
    localAudioTrackRef.current = null;
    publishedVideoTrackRef.current?.close();
    publishedVideoTrackRef.current = null;
    if (clientRef.current) {
      try {
        await clientRef.current.leave();
      } catch {
        // Already gone — nothing left to release.
      }
      clientRef.current = null;
    }
    setJoined(false);
    setRemoteCount(0);
  }, []);

  useEffect(() => {
    if (!credentials || clientRef.current) return;
    let destroyed = false;

    const join = async () => {
      try {
        const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
        // "live" (not "rtc"): a class is one broadcaster to many viewers, and
        // only this profile lets audience members join without publishing.
        const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
        clientRef.current = client;
        await client.setClientRole(credentials.role === "host" ? "host" : "audience");

        client.on("user-published", async (remoteUser: any, mediaType: "audio" | "video") => {
          await client.subscribe(remoteUser, mediaType);
          if (mediaType === "audio") remoteUser.audioTrack?.play();
          if (mediaType === "video" && viewerStageRef.current) {
            viewerStageRef.current.innerHTML = "";
            remoteUser.videoTrack?.play(viewerStageRef.current);
            setRemoteCount(1);
          }
        });

        client.on("user-unpublished", (_remoteUser: any, mediaType: "audio" | "video") => {
          if (mediaType === "video") setRemoteCount(0);
        });
        client.on("user-left", () => setRemoteCount(0));

        await client.join(credentials.appId, credentials.channelName, credentials.token, credentials.uid);
        if (destroyed) return;

        if (credentials.role === "host") {
          try {
            const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
            localAudioTrackRef.current = audioTrack;
            await client.publish([audioTrack]);
          } catch {
            setErrorMsg("Your microphone could not be opened. Students will see you but not hear you.");
          }
        }

        setJoined(true);
      } catch (error) {
        setErrorMsg(error instanceof Error ? `Could not connect to the class: ${error.message}` : "Could not connect to the class.");
      }
    };

    void join();

    return () => {
      destroyed = true;
      void leaveChannel();
    };
  }, [credentials, leaveChannel]);

  /**
   * Publish the composited canvas once, and only once. Everything the host
   * switches between afterwards — camera, screen, whiteboard, annotations —
   * changes what is painted into this same track, so viewers never see a
   * renegotiation or a black frame mid-class.
   */
  const publishCanvas = useCallback(async (stream: MediaStream) => {
    canvasStreamRef.current = stream;
    const client = clientRef.current;
    if (!client || publishedVideoTrackRef.current) return;
    const [mediaStreamTrack] = stream.getVideoTracks();
    if (!mediaStreamTrack) return;
    try {
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      const videoTrack = AgoraRTC.createCustomVideoTrack({
        mediaStreamTrack,
        width: 1280,
        height: 720,
        frameRate: 30,
        // A shared screen is mostly still text. "detail" tells Agora to hold
        // resolution rather than frame rate when bandwidth tightens, which is
        // the right trade when the thing on screen is a paragraph of notes;
        // the default favours smooth motion and turns small text to mush.
        optimizationMode: "detail",
        bitrateMax: 2000
      });
      publishedVideoTrackRef.current = videoTrack;
      await client.publish([videoTrack]);
    } catch (error) {
      setErrorMsg(error instanceof Error ? `Could not start your video: ${error.message}` : "Could not start your video.");
    }
  }, []);

  // The canvas is usually ready before the channel is joined, so publishing is
  // retried the moment the join completes.
  useEffect(() => {
    if (!joined || !isHost || publishedVideoTrackRef.current) return;
    if (canvasStreamRef.current) void publishCanvas(canvasStreamRef.current);
  }, [joined, isHost, publishCanvas]);

  const toggleMic = async () => {
    const track = localAudioTrackRef.current;
    if (!track) return;
    const next = !micActive;
    await track.setEnabled(next);
    setMicActive(next);
  };

  const leave = async () => {
    await leaveChannel();
    router.push(returnHref ?? studyPlanHref());
  };

  /** Ending is the host's call and closes the class for everyone. */
  const endForEveryone = async () => {
    if (!token) return;
    const confirmed = window.confirm("End this class for everyone? Students still watching will be disconnected.");
    if (!confirmed) return;
    setEnding(true);
    try {
      await authenticatedPost(`/api/v1/study-plan-live-classes/${liveClassId}/end`, token, {});
      await leaveChannel();
      router.push(returnHref ?? studyPlanHref());
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Could not end the class.");
      setEnding(false);
    }
  };

  if (!isInitialized || loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 text-white">
        <Loader2 className="h-9 w-9 animate-spin text-indigo-400" />
        <p className="text-sm font-semibold">Checking your access to this class…</p>
      </div>
    );
  }

  if (errorMsg && !credentials) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center text-white">
        <AlertCircle className="h-10 w-10 text-rose-400" />
        <div>
          <p className="text-lg font-black">This class is not open for you right now</p>
          <p className="mt-1 max-w-md text-sm text-white/70">{errorMsg}</p>
        </div>
        <Link
          className="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
          href={returnHref ?? studyPlanHref()}
        >
          Back to the plan
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-500/15 text-rose-400">
            <Radio className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-black leading-tight">{title ?? "Live class"}</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">
              {isHost ? "You are teaching" : joined ? "Live" : "Connecting…"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-white/60">
          <Users className="h-4 w-4" />
          {isHost ? "Broadcasting to the class" : remoteCount > 0 ? "Watching live" : "Waiting for the teacher"}
        </div>
      </header>

      {errorMsg && credentials && (
        <p className="border-b border-amber-400/30 bg-amber-400/10 px-5 py-2 text-xs font-bold text-amber-200">
          {errorMsg}
        </p>
      )}

      <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {isHost ? (
            <HostStage
              cameraEnabled={cameraEnabled}
              mode={stageMode}
              onCanvasStream={publishCanvas}
              onModeChange={setStageMode}
            />
          ) : (
            <div className="relative h-full w-full overflow-hidden rounded-2xl bg-black">
              <div className="absolute inset-0" ref={viewerStageRef} />
              {remoteCount === 0 && (
                <div className="absolute inset-0 grid place-items-center px-6 text-center">
                  <div>
                    <Loader2 className="mx-auto h-7 w-7 animate-spin text-white/40" />
                    <p className="mt-3 text-sm font-bold text-white/70">Waiting for your teacher…</p>
                    <p className="mt-1 text-xs text-white/40">
                      You are in the room. Whatever they share — camera, screen or whiteboard — appears here.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {token && user && (
          <div className="h-72 shrink-0 lg:h-auto lg:w-80">
            <LiveClassChat currentUserId={user.id} isHost={Boolean(isHost)} liveClassId={liveClassId} token={token} />
          </div>
        )}
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 px-5 py-3">
        {isHost && (
          <>
            <button
              className={`inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-black ${micActive ? "bg-white/10 text-white hover:bg-white/15" : "bg-rose-500/20 text-rose-300"}`}
              onClick={toggleMic}
              type="button"
            >
              {micActive ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              {micActive ? "Mute" : "Unmute"}
            </button>
            <button
              className={`inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-black ${cameraEnabled ? "bg-white/10 text-white hover:bg-white/15" : "bg-rose-500/20 text-rose-300"}`}
              onClick={() => setCameraEnabled((current) => !current)}
              type="button"
            >
              {cameraEnabled ? <VideoIcon className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              {cameraEnabled ? "Hide camera" : "Show camera"}
            </button>
            <button
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-black text-white hover:bg-rose-500 disabled:opacity-60"
              disabled={ending}
              onClick={endForEveryone}
              type="button"
            >
              {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOff className="h-4 w-4" />}
              End class for everyone
            </button>
          </>
        )}
        <button
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 px-4 text-sm font-black text-white hover:bg-white/10"
          onClick={leave}
          type="button"
        >
          <PhoneOff className="h-4 w-4" />
          {isHost ? "Leave without ending" : "Leave class"}
        </button>
      </footer>
    </div>
  );
}
