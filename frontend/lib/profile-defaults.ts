import type { ProfileConfig, SocialLink } from "./types";

export const createDefaultProfile = (username = "", displayName = ""): ProfileConfig => ({
  profile: { username, displayName, description: "", location: "", views: 0, uid: "" },
  settings: {
    language: "en-US",
    accentColor: "#9b87f5", textColor: "#ffffff", backgroundColor: "#08080d", iconColor: "#d8d3ff",
    profileOpacity: 10, backgroundOpacity: 88, profileBlur: 24, profileRadius: 24, profileGradient: true, showViews: true, showBadges: true, showSocials: true,
    entryScreen: true, entryText: "click to enter...", backgroundEffect: "Glow", usernameEffect: "Glow",
    usernameGlow: true, socialGlow: true, badgeGlow: true,
  },
  assets: { avatar: { url: null }, background: { url: null }, backgroundVideo: { url: null }, audio: { url: null }, cursor: { url: null }, audioEnabled: true, volume: 65 },
  socials: [] as SocialLink[],
  badges: [],
});

export const platformOptions: ProfileConfig["socials"][number]["platform"][] = [
  "YouTube", "Discord", "Instagram", "X", "TikTok", "Telegram", "Spotify", "SoundCloud", "GitHub", "Reddit", "Twitch", "Snapchat", "Facebook", "LinkedIn", "Steam", "Roblox", "PayPal", "Pinterest", "Patreon", "Threads", "Kick", "Bitcoin", "Ethereum", "Litecoin", "Solana", "Email", "Custom URL",
];
