import { Mail } from "lucide-react";
import { FaBitcoin, FaEthereum, FaLink, FaLinkedin, FaLitecoinSign } from "react-icons/fa6";
import { SiDiscord, SiFacebook, SiGithub, SiInstagram, SiKick, SiPatreon, SiPaypal, SiPinterest, SiReddit, SiRoblox, SiSnapchat, SiSolana, SiSoundcloud, SiSpotify, SiSteam, SiTelegram, SiThreads, SiTiktok, SiTwitch, SiX, SiYoutube } from "react-icons/si";
import type { IconType } from "react-icons";
import type { SocialPlatform } from "@/lib/types";

const icons: Partial<Record<SocialPlatform, IconType>> = { YouTube: SiYoutube, Discord: SiDiscord, Instagram: SiInstagram, X: SiX, TikTok: SiTiktok, Telegram: SiTelegram, Spotify: SiSpotify, SoundCloud: SiSoundcloud, GitHub: SiGithub, Reddit: SiReddit, Twitch: SiTwitch, Snapchat: SiSnapchat, Facebook: SiFacebook, LinkedIn: FaLinkedin, Steam: SiSteam, Roblox: SiRoblox, PayPal: SiPaypal, Pinterest: SiPinterest, Patreon: SiPatreon, Threads: SiThreads, Kick: SiKick, Bitcoin: FaBitcoin, Ethereum: FaEthereum, Litecoin: FaLitecoinSign, Solana: SiSolana, Email: Mail, "Custom URL": FaLink };

export function SocialIcon({ platform, size = 18 }: { platform: SocialPlatform; size?: number }) {
  const Icon = icons[platform] || FaLink;
  return <Icon size={size} aria-hidden="true" />;
}
