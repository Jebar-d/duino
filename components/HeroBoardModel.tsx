"use client";

import "@google/model-viewer";
import type { ComponentType, CSSProperties, HTMLAttributes } from "react";

type ModelViewerProps = HTMLAttributes<HTMLElement> & {
  src: string;
  alt: string;
  cameraControls?: boolean;
  "camera-orbit"?: string;
  "field-of-view"?: string;
  "interaction-prompt"?: string;
  "shadow-intensity"?: string;
  "shadow-softness"?: string;
  exposure?: string;
  loading?: string;
  "disable-zoom"?: boolean;
  style?: CSSProperties;
};

const ModelViewer = "model-viewer" as unknown as ComponentType<ModelViewerProps>;

export default function HeroBoardModel({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  return (
    <div className="hero-acab-model-shell">
      <ModelViewer
        className="hero-acab-model-viewer"
        src={src}
        alt={alt}
        cameraControls
        camera-orbit="-30deg 55deg auto"
        field-of-view="30deg"
        interaction-prompt="none"
        shadow-intensity="0"
        shadow-softness="0"
        exposure="1"
        loading="eager"
        disable-zoom
        style={{
          background: "transparent",
          touchAction: "pan-y",
        }}
      />
    </div>
  );
}
