import React from "react";
import logoImg from "./logo.png";

export function WayToIASLogo({ className = "h-9 w-auto" }: { className?: string }) {
  return (
    <img
      src={logoImg.src}
      alt="WayToIAS Logo"
      className={className}
      style={{ display: "block", objectFit: "contain" }}
    />
  );
}
