"use client";

import { ProfileRenderer } from "@/components/profile/ProfileRenderer";
import type { LayoutViewport } from "@/lib/element-layout";
import type { ProfileConfig } from "@/lib/types";

type LayoutSettingsPatch = Partial<ProfileConfig["settings"]>;

/** The shared, real public-profile renderer used by Customize and the dashboard Overview. */
export function LiveProfilePreview({
  config,
  layoutViewport,
  manualPositioning = false,
  onLayoutChange,
  className,
}: {
  config: ProfileConfig;
  layoutViewport?: LayoutViewport;
  manualPositioning?: boolean;
  onLayoutChange?: (patch: LayoutSettingsPatch) => void;
  className?: string;
}) {
  return (
    <ProfileRenderer
      config={config}
      preview
      fitViewport
      layoutViewport={layoutViewport}
      manualPositioning={manualPositioning}
      onLayoutChange={onLayoutChange}
      className={className}
    />
  );
}
