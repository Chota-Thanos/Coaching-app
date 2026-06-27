"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./auth-context";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    google?: any;
  }
}

export function GoogleSignInButton({ nextPath }: { nextPath: string }) {
  const { loginWithGoogle } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.warn("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured in environmental variables.");
      return;
    }

    if (scriptLoaded && typeof window !== "undefined" && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: any) => {
            try {
              setError(null);
              await loginWithGoogle(response.credential);
              router.push(nextPath);
            } catch (err: any) {
              console.error("Google sign-in API login failed:", err);
              setError(err.message || "Authentication failed. Please try again.");
            }
          }
        });

        if (buttonRef.current) {
          window.google.accounts.id.renderButton(buttonRef.current, {
            theme: "outline",
            size: "large",
            width: "320",
            text: "signin_with",
            shape: "rectangular"
          });
        }
      } catch (err) {
        console.error("Error initializing Google Accounts ID API:", err);
      }
    }
  }, [scriptLoaded, loginWithGoogle, router, nextPath]);

  return (
    <div className="flex flex-col items-center justify-center w-full gap-2 mt-4">
      <Script
        src="https://accounts.google.com/gsi/client"
        onLoad={() => setScriptLoaded(true)}
        strategy="lazyOnload"
      />
      
      {!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? (
        <button
          type="button"
          onClick={() => {
            alert(
              "Google Client ID is not configured.\n\nTo configure Google Login:\n1. Create OAuth 2.0 credentials in Google Cloud Developer Console.\n2. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID inside apps/web/.env file."
            );
          }}
          className="flex h-11 w-full max-w-[320px] items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-slate-350 hover:bg-slate-50 transition-all focus:outline-none"
        >
          {/* Simple SVG Google Icon */}
          <svg className="h-5 w-5" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
            <g transform="matrix(1, 0, 0, 1, 0, 0)">
              <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.58h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.38c0,-0.67 -0.06,-1.33 -0.18,-1.98z" fill="#4285F4" />
              <path d="M12,20.7c2.62,0 4.82,-0.87 6.42,-2.37l-3.3,-2.58c-0.91,0.61 -2.08,0.98 -3.12,0.98c-2.4,0 -4.43,-1.63 -5.16,-3.82H3.45v2.66c1.64,3.26 5.01,5.13 8.55,5.13z" fill="#34A853" />
              <path d="M6.84,12.91c-0.19,-0.57 -0.3,-1.18 -0.3,-1.8c0,-0.62 0.11,-1.23 0.3,-1.8V6.65H3.45C2.81,7.92 2.45,9.36 2.45,10.9c0,1.54 0.36,2.98 1.0,4.25l3.39,-2.66c-0.19,-0.58 -0.3,-1.19 -0.3,-1.82z" fill="#FBBC05" />
              <path d="M12,5.7c1.42,0 2.7,0.49 3.7,1.44l2.77,-2.77C16.8,2.77 14.6,1.8 12,1.8C8.46,1.8 5.09,3.67 3.45,6.93l3.39,2.66c0.73,-2.19 2.76,-3.89 5.16,-3.89z" fill="#EA4335" />
            </g>
          </svg>
          Configure Google Sign-In
        </button>
      ) : (
        <div ref={buttonRef} className="w-full flex justify-center min-h-[44px]" />
      )}

      {error && <p className="mt-2 text-xs font-semibold text-berry">{error}</p>}
    </div>
  );
}
