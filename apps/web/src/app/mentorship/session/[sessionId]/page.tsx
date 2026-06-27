"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth, authenticatedGet } from "../../../../components/auth/auth-context";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2, AlertCircle, ShieldAlert, User, Radio } from "lucide-react";
import Link from "next/link";

type AgoraCredentials = {
  appId: string;
  token: string;
  channelName: string;
  uid: number;
};

export default function MentorshipSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const resolvedParams = use(params);
  const sessionId = Number(resolvedParams.sessionId);
  const router = useRouter();
  const { user, token, isInitialized } = useAuth();

  const [loading, setLoading] = useState(true);
  const [credentials, setCredentials] = useState<AgoraCredentials | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [micActive, setMicActive] = useState(true);
  const [videoActive, setVideoActive] = useState(true);

  // Agora states
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);

  // Refs for video elements
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Agora SDK Instances
  const clientRef = useRef<any>(null);
  const localAudioTrackRef = useRef<any>(null);
  const localVideoTrackRef = useRef<any>(null);

  useEffect(() => {
    if (isInitialized && !user) {
      router.push("/login");
    }
  }, [isInitialized, user, router]);

  const fetchToken = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await authenticatedGet<AgoraCredentials>(
        `/api/v1/mentorship/sessions/${sessionId}/agora-token`,
        token
      );
      setCredentials(res);
      setErrorMsg(null);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to authorize session credentials.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && sessionId) {
      void fetchToken();
    }
  }, [token, sessionId]);

  // Main Agora Setup Effect
  useEffect(() => {
    if (!credentials || joined) return;

    let destroyed = false;

    const initAgora = async () => {
      try {
        const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
        
        // Create client
        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        clientRef.current = client;

        // Register event listeners
        client.on("user-published", async (remoteUser: any, mediaType: "audio" | "video") => {
          await client.subscribe(remoteUser, mediaType);
          
          if (mediaType === "video") {
            setRemoteUsers((prev) => {
              if (prev.find((u) => u.uid === remoteUser.uid)) return prev;
              return [...prev, remoteUser];
            });
          }
          if (mediaType === "audio") {
            remoteUser.audioTrack?.play();
          }
        });

        client.on("user-unpublished", (remoteUser: any, mediaType: "audio" | "video") => {
          if (mediaType === "video") {
            setRemoteUsers((prev) => prev.filter((u) => u.uid !== remoteUser.uid));
          }
        });

        client.on("user-left", (remoteUser: any) => {
          setRemoteUsers((prev) => prev.filter((u) => u.uid !== remoteUser.uid));
        });

        // Join room
        await client.join(
          credentials.appId,
          credentials.channelName,
          credentials.token === "mock-agora-token" ? null : credentials.token,
          credentials.uid
        );

        if (destroyed) return;

        // Create local tracks
        try {
          const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
          localAudioTrackRef.current = audioTrack;
          localVideoTrackRef.current = videoTrack;

          // Play local video
          if (localVideoRef.current) {
            videoTrack.play(localVideoRef.current);
          }

          // Publish tracks
          await client.publish([audioTrack, videoTrack]);
        } catch (mediaErr) {
          console.warn("Failed to capture local media devices: ", mediaErr);
          alert("Could not access camera/microphone. You will join the call in listener-only mode.");
        }

        setJoined(true);
      } catch (err: any) {
        console.error("Agora Init Error: ", err);
        setErrorMsg("Failed to connect to Agora session channels: " + err.message);
      }
    };

    void initAgora();

    return () => {
      destroyed = true;
      void leaveCall();
    };
  }, [credentials]);

  // Play remote videos when user list updates
  useEffect(() => {
    remoteUsers.forEach((remoteUser) => {
      const container = remoteVideoRefs.current[String(remoteUser.uid)];
      if (container && remoteUser.videoTrack) {
        container.innerHTML = ""; // Clear
        remoteUser.videoTrack.play(container);
      }
    });
  }, [remoteUsers]);

  const toggleMic = async () => {
    if (localAudioTrackRef.current) {
      const active = !micActive;
      await localAudioTrackRef.current.setEnabled(active);
      setMicActive(active);
    }
  };

  const toggleVideo = async () => {
    if (localVideoTrackRef.current) {
      const active = !videoActive;
      await localVideoTrackRef.current.setEnabled(active);
      setVideoActive(active);
      if (active && localVideoRef.current) {
        localVideoTrackRef.current.play(localVideoRef.current);
      }
    }
  };

  const leaveCall = async () => {
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.close();
      localAudioTrackRef.current = null;
    }
    if (localVideoTrackRef.current) {
      localVideoTrackRef.current.close();
      localVideoTrackRef.current = null;
    }
    if (clientRef.current) {
      try {
        await clientRef.current.leave();
      } catch (e) {
        // Already left
      }
      clientRef.current = null;
    }
    setJoined(false);
    setRemoteUsers([]);
  };

  const handleDisconnect = async () => {
    await leaveCall();
    router.push(user?.role === "mentor" ? "/mentor/workspace" : "/dashboard/mentorship");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-white">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm font-semibold tracking-wide">Authorizing meeting token...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white px-6">
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 text-center max-w-md w-full">
          <ShieldAlert className="mx-auto h-12 w-12 text-rose-500 mb-4 animate-bounce" />
          <h2 className="text-xl font-bold">Session Authorization Failed</h2>
          <p className="text-slate-400 text-xs mt-2 leading-relaxed">{errorMsg}</p>
          <button
            onClick={() => router.push("/")}
            className="mt-6 rounded-2xl bg-white px-6 py-3 text-xs font-bold text-slate-950 hover:bg-slate-100 transition"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between overflow-hidden">
      {/* Video Call Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between bg-black/40 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
          </span>
          <div>
            <h1 className="text-sm font-black tracking-tight">Mentorship Meeting #{sessionId}</h1>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Channel: {credentials?.channelName}</p>
          </div>
        </div>
        
        <span className="rounded-full bg-indigo-500/20 border border-indigo-500/30 px-3.5 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-300 flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5 animate-pulse" />
          Agora Live
        </span>
      </header>

      {/* Video Tile Space */}
      <main className="flex-1 p-6 flex items-center justify-center min-h-0 relative">
        <div className="grid gap-6 w-full max-w-5xl h-[520px] md:grid-cols-2">
          
          {/* Local Feed */}
          <article className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/60 shadow-lg flex items-center justify-center group">
            <div ref={localVideoRef} className="absolute inset-0 w-full h-full object-cover" />
            
            {(!videoActive || !joined) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.2),_rgba(15,23,42,0.95))]">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-xl font-bold">
                  {user?.username.charAt(0).toUpperCase()}
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold">{user?.username} (You)</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Camera off</p>
                </div>
              </div>
            )}

            <div className="absolute bottom-4 left-4 rounded-xl bg-black/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm border border-white/5">
              You
            </div>
          </article>

          {/* Remote Feed */}
          {remoteUsers.length > 0 ? (
            remoteUsers.map((remoteUser) => (
              <article
                key={remoteUser.uid}
                className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/60 shadow-lg flex items-center justify-center"
              >
                <div
                  ref={(el) => {
                    remoteVideoRefs.current[String(remoteUser.uid)] = el;
                  }}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                
                <div className="absolute bottom-4 left-4 rounded-xl bg-black/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm border border-white/5">
                  Participant #{remoteUser.uid}
                </div>
              </article>
            ))
          ) : (
            <article className="relative overflow-hidden rounded-[32px] border border-dashed border-white/10 bg-white/5 flex items-center justify-center text-center p-8">
              <div className="max-w-xs space-y-2">
                <Loader2 className="h-8 w-8 text-indigo-500 animate-spin mx-auto mb-2" />
                <h3 className="text-sm font-bold">Waiting for participant...</h3>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Send the instant session link or invite your student/mentor to join. This tile will activate once they join the channel.
                </p>
              </div>
            </article>
          )}

        </div>
      </main>

      {/* Call Controls bar */}
      <footer className="border-t border-white/10 bg-black/40 backdrop-blur-md px-6 py-5 flex items-center justify-center gap-4 z-10">
        <button
          onClick={toggleMic}
          className={`flex h-12 w-12 items-center justify-center rounded-2xl transition shadow-md ${
            micActive ? "bg-white/10 hover:bg-white/20 text-white" : "bg-rose-600 hover:bg-rose-700 text-white animate-pulse"
          }`}
          title={micActive ? "Mute Mic" : "Unmute Mic"}
        >
          {micActive ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>

        <button
          onClick={toggleVideo}
          className={`flex h-12 w-12 items-center justify-center rounded-2xl transition shadow-md ${
            videoActive ? "bg-white/10 hover:bg-white/20 text-white" : "bg-rose-600 hover:bg-rose-700 text-white animate-pulse"
          }`}
          title={videoActive ? "Stop Video" : "Start Video"}
        >
          {videoActive ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </button>

        <button
          onClick={handleDisconnect}
          className="flex h-12 px-6 items-center justify-center rounded-2xl bg-rose-600 hover:bg-rose-700 font-bold text-xs gap-1.5 transition shadow-lg shadow-rose-600/10"
          title="Leave Session"
        >
          <PhoneOff className="h-4 w-4" />
          End Consultation
        </button>
      </footer>
    </div>
  );
}
