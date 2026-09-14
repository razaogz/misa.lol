import hashlib
import json
from html import escape

from fastapi import Request

from app.core.discord_live import safe_discord_img
from app.core.og_card import share_copy
from app.core.public_origin import public_origin_for
from app.core.markdown import render_safe_markdown
from app.core.profile_sanitize import PAGE_ENTERS, PROFILE_FONTS, USERNAME_EFFECTS, css_hex_color, has_public_asset, is_safe_social_icon, public_playlist, public_social_href, sanitize_profile_config
from app.core.sections import parse_lyrics, section_has_content
from app.core.widgets import safe_widget_url
from app.core.social_icons import social_icon_markup
from app.core.social_prefixes import DEFAULT_ICON_COLOR, resolve_icon_color

def _color_with_alpha(value: str, alpha: float) -> str:
    raw = (value or "#ffffff").lstrip("#")
    if len(raw) == 3:
        raw = "".join(part * 2 for part in raw)
    raw = raw[:6]
    if len(raw) != 6 or any(character not in "0123456789abcdefABCDEF" for character in raw):
        return f"rgba(255,255,255,{max(0.0, min(1.0, alpha)):.3f})"
    red = int(raw[0:2], 16)
    green = int(raw[2:4], 16)
    blue = int(raw[4:6], 16)
    return f"rgba({red},{green},{blue},{max(0.0, min(1.0, alpha)):.3f})"


PUBLIC_ANALYTICS_SCRIPT = """<script>
(() => {
  const username = document.body.dataset.profileUser || "";
  if (!username) return;
  const device = /iPad|Tablet/i.test(navigator.userAgent) ? "tablet" : /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop";
  const send = (kind, socialId, socialLabel) => {
    const body = JSON.stringify({
      username,
      kind,
      socialId: socialId || "",
      socialLabel: socialLabel || "",
      referrer: document.referrer || "",
      device,
    });
    fetch("/api/v1/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {});
  };
  send("view");
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-social-id]");
    if (!target) return;
    send("click", target.getAttribute("data-social-id") || "", target.getAttribute("data-social-platform") || "");
  });
})();
</script>
"""

PUBLIC_COPY_SCRIPT = """<div id="copy-toast" hidden>Copied</div>
<script>
(() => {
  const toast = document.getElementById("copy-toast");
  const audio = document.getElementById("profile-audio");
  const player = document.getElementById("profile-player");
  const playBtn = document.getElementById("audio-play");
  const muteBtn = document.getElementById("audio-mute");
  const prevBtn = document.getElementById("audio-prev");
  const nextBtn = document.getElementById("audio-next");
  const shuffleBtn = document.getElementById("audio-shuffle");
  const repeatBtn = document.getElementById("audio-repeat");
  const seek = document.getElementById("audio-seek");
  const volumeInput = document.getElementById("audio-volume");
  const titleEl = document.getElementById("audio-title");
  const countEl = document.getElementById("audio-count");
  const artEl = document.getElementById("audio-art");
  const nowEl = document.getElementById("audio-now");
  const durEl = document.getElementById("audio-dur");
  const video = document.querySelector(".bg-video");
  const enabled = document.body.dataset.audioEnabled === "1";
  const volume = Math.min(1, Math.max(0, Number(document.body.dataset.volume || "0.65")));
  let tracks = [];
  try { tracks = JSON.parse(document.getElementById("playlist-data")?.textContent || "[]"); } catch {}
  let index = 0;
  let shuffle = false;
  let repeat = "all";
  let order = tracks.map((_, i) => i);
  const keepOnCard = (event) => { event.stopPropagation(); };
  const bindClick = (event) => { event.preventDefault(); event.stopPropagation(); };
  const fmt = (value) => {
    if (!Number.isFinite(value) || value <= 0) return "0:00";
    const m = Math.floor(value / 60);
    const s = Math.floor(value % 60);
    return m + ":" + String(s).padStart(2, "0");
  };
  const paint = (i) => {
    const track = tracks[i];
    if (!track) return;
    if (titleEl) titleEl.textContent = track.title || "Track";
    if (countEl) countEl.textContent = (i + 1) + " / " + tracks.length;
    if (artEl && track.artwork && artEl.getAttribute("src") !== track.artwork) artEl.src = track.artwork;
  };
  const load = (i, play) => {
    if (!audio || !tracks[i] || !tracks[i].audio) return;
    index = i;
    paint(i);
    const next = tracks[i].audio;
    const current = audio.getAttribute("data-track-src") || "";
    if (current === next) {
      audio.currentTime = 0;
    } else {
      audio.setAttribute("data-track-src", next);
      audio.preload = "metadata";
      audio.src = next;
    }
    if (play) audio.play().catch(() => {});
  };
  const step = (dir) => {
    if (!tracks.length) return;
    const pos = order.indexOf(index);
    load(order[(pos + dir + order.length) % order.length], true);
  };
  if (audio) audio.volume = volume;
  const startMedia = () => {
    if (video) video.play().catch(() => {});
    if (audio && enabled && tracks[0]) load(0, true);
  };

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-copy]");
    if (!button || (player && player.contains(button))) return;
    event.preventDefault();
    event.stopPropagation();
    const value = button.getAttribute("data-copy") || "";
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const field = document.createElement("textarea");
      field.value = value;
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    if (!toast) return;
    toast.hidden = false;
    window.setTimeout(() => { toast.hidden = true; }, 1600);
  });

  const entry = document.getElementById("entry");
  const card = document.getElementById("profile-card");

  if (player) {
    player.addEventListener("click", keepOnCard);
    player.addEventListener("pointerdown", keepOnCard);
  }
  const bind = (el, handler) => {
    if (!el) return;
    el.addEventListener("click", (event) => { bindClick(event); handler(event); });
  };
  const togglePlay = () => {
    if (!audio) return;
    if (!audio.getAttribute("data-track-src") && tracks[0]) load(0, true);
    else if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  };
  if (playBtn && audio) {
    bind(playBtn, togglePlay);
    audio.addEventListener("play", () => { playBtn.dataset.playing = "1"; });
    audio.addEventListener("pause", () => { playBtn.dataset.playing = "0"; });
    audio.addEventListener("timeupdate", () => {
      if (seek && audio.duration) seek.value = String(Math.floor(audio.currentTime));
      if (nowEl) nowEl.textContent = fmt(audio.currentTime);
    });
    audio.addEventListener("loadedmetadata", () => {
      if (seek) seek.max = String(Math.floor(audio.duration || 1));
      if (durEl) durEl.textContent = fmt(audio.duration);
    });
    audio.addEventListener("ended", () => {
      if (repeat === "one") { audio.currentTime = 0; audio.play().catch(() => {}); return; }
      const last = order.indexOf(index) === order.length - 1;
      if (last && repeat === "off") return;
      step(1);
    });
  }
  bind(prevBtn, () => step(-1));
  bind(nextBtn, () => step(1));
  bind(shuffleBtn, () => {
    shuffle = !shuffle;
    if (shuffleBtn) shuffleBtn.dataset.on = shuffle ? "1" : "0";
    order = tracks.map((_, i) => i);
    if (shuffle) order = order.map((v, i) => [v, (i * 17 + 11) % order.length]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
  });
  bind(repeatBtn, () => {
    repeat = repeat === "off" ? "all" : repeat === "all" ? "one" : "off";
    if (repeatBtn) repeatBtn.dataset.mode = repeat;
  });
  bind(muteBtn, () => {
    if (!audio) return;
    audio.muted = !audio.muted;
    if (muteBtn) muteBtn.dataset.muted = audio.muted ? "1" : "0";
  });
  if (volumeInput && audio) {
    volumeInput.addEventListener("input", (event) => {
      event.stopPropagation();
      audio.volume = Math.min(1, Math.max(0, Number(volumeInput.value || "0") / 100));
    });
  }
  if (seek && audio) {
    seek.addEventListener("input", (event) => {
      event.stopPropagation();
      audio.currentTime = Number(seek.value || "0");
    });
  }
  if (tracks[0]) paint(0);

  const cursorSrc = document.body.dataset.cursor || "";
  if (cursorSrc) {
    const apply = (url) => {
      document.documentElement.style.setProperty("--cursor", `url("${url}") 16 16, auto`);
    };
    apply(cursorSrc);
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth <= 128 && image.naturalHeight <= 128) return;
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(image, 0, 0, 32, 32);
      apply(canvas.toDataURL("image/png"));
    };
    image.src = cursorSrc;
  }

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pageEnter = document.body.dataset.pageEnter || "Fade";
  const playClick = () => {
    if (document.body.dataset.clickSound !== "1") return;
    const src = document.body.dataset.clickSrc || "";
    if (src) {
      const tap = new Audio(src);
      tap.volume = 0.35;
      tap.play().catch(() => {});
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    osc.stop(ctx.currentTime + 0.09);
  };
  const reveal = () => {
    if (!card) return;
    card.hidden = false;
    if (!reduced && pageEnter !== "None") card.classList.add("enter-" + pageEnter.toLowerCase());
    startMedia();
  };
  if (entry && card) {
    card.hidden = true;
    entry.addEventListener("click", () => {
      entry.hidden = true;
      reveal();
    });
  } else {
    reveal();
  }
  document.addEventListener("click", (event) => {
    const hit = event.target.closest(".social, #entry, [data-copy], .audio-btn");
    if (hit) playClick();
  });
  if (card && document.body.dataset.tilt === "1" && !reduced) {
    card.addEventListener("pointermove", (event) => {
      const box = card.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - 0.5;
      const y = (event.clientY - box.top) / box.height - 0.5;
      card.style.transform = "rotateX(" + (-y * 7).toFixed(2) + "deg) rotateY(" + (x * 9).toFixed(2) + "deg)";
    });
    card.addEventListener("pointerleave", () => { card.style.transform = ""; });
  }
  const nameEl = document.getElementById("display-name");
  const nameEffect = document.body.dataset.nameEffect || "";
  if (nameEl && (document.body.dataset.typewriter === "1" || nameEffect === "Typewriter")) {
    const full = nameEl.textContent || "";
    nameEl.textContent = "";
    let i = 0;
    const tick = () => {
      nameEl.textContent = full.slice(0, ++i);
      if (i < full.length) window.setTimeout(tick, 38);
    };
    tick();
  }
  if (nameEl && nameEffect === "Shuffle") {
    const full = nameEl.textContent || "";
    const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let step = 0;
    const timer = window.setInterval(() => {
      step += 1;
      nameEl.textContent = full.split("").map((ch, index) => {
        if (ch === " " || index < Math.floor(step / 2)) return full[index] || "";
        return glyphs[Math.floor(Math.random() * glyphs.length)];
      }).join("");
      if (step > full.length * 2 + 4) window.clearInterval(timer);
    }, 40);
  }
  const bioEl = document.getElementById("profile-bio");
  const bioNode = document.getElementById("bio-lines");
  if (bioEl && bioNode) {
    let lines = [];
    try { lines = JSON.parse(bioNode.textContent || "[]"); } catch (error) { lines = []; }
    if (lines.length) {
      let line = 0;
      let index = 0;
      let deleting = false;
      const typeSpeed = Math.max(20, Math.min(160, Number(document.body.dataset.bioTypeMs || "55")));
      const deleteSpeed = Math.max(20, Math.min(160, Number(document.body.dataset.bioDeleteMs || "35")));
      const pause = Math.max(400, Math.min(4000, Number(document.body.dataset.bioPauseMs || "1200")));
      const tick = () => {
        const current = lines[line] || "";
        if (!deleting) {
          index += 1;
          bioEl.textContent = current.slice(0, index);
          if (index >= current.length) {
            deleting = lines.length > 1;
            window.setTimeout(tick, lines.length > 1 ? pause : 999999);
            return;
          }
          window.setTimeout(tick, typeSpeed);
          return;
        }
        index -= 1;
        bioEl.textContent = current.slice(0, Math.max(0, index));
        if (index <= 0) {
          deleting = false;
          line = (line + 1) % lines.length;
          window.setTimeout(tick, typeSpeed);
          return;
        }
        window.setTimeout(tick, deleteSpeed);
      };
      tick();
    }
  }
  if (document.body.dataset.tabTitle === "1" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const titleNode = document.getElementById("page-title-data");
    let base = document.title;
    try { base = JSON.parse(titleNode && titleNode.textContent ? titleNode.textContent : JSON.stringify(document.title)); } catch (error) {}
    const pad = base + "   ";
    let offset = 0;
    window.setInterval(() => {
      document.title = pad.slice(offset) + pad.slice(0, offset);
      offset = (offset + 1) % pad.length;
    }, 180);
  }
})();
</script>"""


PUBLIC_WIDGET_SCRIPT = """<script>
(() => {
  const cards = document.querySelectorAll("[data-timezone]");
  if (!cards.length) return;
  const tick = () => {
    cards.forEach((el) => {
      const zone = el.getAttribute("data-timezone");
      const title = el.querySelector("strong");
      if (!zone || !title) return;
      try {
        title.textContent = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: zone }).format(new Date());
      } catch (error) {}
    });
  };
  tick();
  setInterval(tick, 15000);
})();
</script>"""

PUBLIC_LYRICS_SCRIPT = """<script>
(() => {
  const boxes = document.querySelectorAll("[data-lyrics]");
  const audio = document.getElementById("profile-audio");
  if (!boxes.length) return;
  const paint = (time) => {
    boxes.forEach((box) => {
      const lines = [...box.querySelectorAll("[data-t]")];
      if (!lines.length) return;
      let active = -1;
      lines.forEach((line, index) => {
        const at = Number(line.getAttribute("data-t"));
        line.classList.toggle("is-active", false);
        if (Number.isFinite(at) && time >= at) active = index;
      });
      if (active < 0) return;
      lines[active].classList.add("is-active");
      const root = box.querySelector(".lyrics");
      const line = lines[active];
      if (root && line) root.scrollTop = Math.max(0, line.offsetTop - root.clientHeight / 2);
    });
  };
  if (audio) audio.addEventListener("timeupdate", () => paint(audio.currentTime));
})();
</script>"""


def render_public_profile(config: dict, request: Request | None = None, widgets: list | None = None, default_fonts: list[dict] | None = None) -> str:
    incoming = config if isinstance(config, dict) else {}
    discord_live = incoming.get("discord") if isinstance(incoming.get("discord"), dict) else {}
    config = sanitize_profile_config(incoming)
    if discord_live:
        config["discord"] = discord_live
    profile = config.get("profile") or {}
    settings = config.get("settings") or {}
    assets = config.get("assets") or {}
    username_raw = str(profile.get("username") or "user")
    username = escape(username_raw)
    display_name = escape(str(profile.get("displayName") or username))
    share = share_copy(profile, settings, username_raw)
    page_title = escape(share["title"])
    share_description = escape(share["description"])
    public_origin = public_origin_for(request)
    page_url = escape(f"{public_origin}/{username_raw}", quote=True)
    og_image_url = escape(f"{public_origin}/api/v1/profile/{username_raw}/og.jpg?v={_share_version(config)}", quote=True)
    favicon_url = escape(f"{public_origin}/api/v1/profile/{username_raw}/assets/favicon", quote=True)
    asset_src = lambda kind: f"/api/v1/profile/{escape(username_raw, quote=True)}/assets/{kind}"
    raw_description = str(profile.get("description") or "")
    description = escape(raw_description)
    bio_lines = [line.strip() for line in raw_description.splitlines() if line.strip()][:8]
    location = escape(str(profile.get("location") or ""))
    accent = css_hex_color(settings.get("accentColor"), "#9b87f5")
    username_color = css_hex_color(settings.get("usernameColor"), "#ffffff")
    username_effect_color = css_hex_color(settings.get("usernameEffectColor"), accent)
    text_color = css_hex_color(settings.get("textColor"), "#ffffff")
    background = css_hex_color(settings.get("backgroundColor"), "#08080d")
    icon_color = css_hex_color(settings.get("iconColor"), DEFAULT_ICON_COLOR)
    profile_opacity = _clamp(settings.get("profileOpacity"), 10, 0, 80) / 100
    background_opacity = _clamp(settings.get("backgroundOpacity"), 88, 20, 100) / 100
    profile_blur = _clamp(settings.get("profileBlur"), 24, 0, 40)
    profile_radius = _clamp(settings.get("profileRadius"), 24, 0, 40)
    profile_frame_opacity = _clamp(settings.get("profileFrameOpacity"), 100, 0, 100) / 100
    username_effect = settings.get("usernameEffect") if settings.get("usernameEffect") in USERNAME_EFFECTS else "Glow"
    background_effect = settings.get("backgroundEffect") if settings.get("backgroundEffect") in {"None", "Particles", "Stars", "Glow", "Aurora", "Waves", "Embers", "Rain"} else "Glow"
    layout = settings.get("layout") if settings.get("layout") in {"Modern", "Simplistic", "Sleek"} else "Modern"
    avatar_shape = settings.get("avatarShape") if settings.get("avatarShape") in {"circle", "rounded", "square"} else "circle"
    banner_shape = settings.get("bannerShape") if settings.get("bannerShape") in {"rounded", "square", "pill"} else "rounded"
    button_style = settings.get("buttonStyle") if settings.get("buttonStyle") in {"glass", "solid", "outline"} else "glass"
    profile_font = settings.get("profileFont") if settings.get("profileFont") in PROFILE_FONTS else "Inter"
    font_size = _clamp(settings.get("fontSize"), 16, 12, 22)
    letter_spacing = _clamp(settings.get("letterSpacing"), 0, -2, 8)
    bio_typewriter = bool(settings.get("bioTypewriter")) and bool(bio_lines)
    tab_title_on = 1 if settings.get("tabTitleAnimate") else 0
    bio_type_ms = _clamp(settings.get("bioTypeMs"), 55, 20, 160)
    bio_delete_ms = _clamp(settings.get("bioDeleteMs"), 35, 20, 160)
    bio_pause_ms = _clamp(settings.get("bioPauseMs"), 1200, 400, 4000)
    card_align = settings.get("cardAlign") if settings.get("cardAlign") in {"left", "center", "right"} else "center"
    show_frame = bool(settings.get("showProfileFrame", True))
    frame_visible = show_frame and profile_frame_opacity > 0
    show_avatar = bool(settings.get("showAvatar", True))
    show_avatar_border = bool(settings.get("showAvatarBorder", True))
    show_display_name = bool(settings.get("showDisplayName", True))
    frame_scale = _clamp(settings.get("profileFrameScale"), 100, 50, 150) / 100
    frame_x = _clamp(settings.get("profileFrameX"), 0, -45, 45)
    frame_y = _clamp(settings.get("profileFrameY"), 0, -45, 45)
    border_color = css_hex_color(settings.get("borderColor"), "#ffffff")
    border_width = _clamp(settings.get("borderWidth"), 1, 0, 8)
    widget_swap = bool(settings.get("widgetColorSwap"))
    card_tilt = 1 if settings.get("cardTilt") else 0
    page_enter = settings.get("pageEnter") if settings.get("pageEnter") in PAGE_ENTERS else "Fade"
    click_sound_on = 1 if settings.get("clickSound") else 0
    has_click = has_public_asset(assets, "clickSound", "audio")
    entry_on = bool(settings.get("entryScreen"))
    entry_text = escape(str(settings.get("entryText") or "click to enter..."))
    avatar_radius = {"square": "12px", "rounded": "22px"}.get(avatar_shape, "50%")
    banner_radius = {"square": "0", "pill": "999px"}.get(banner_shape, "18px")
    content_align = settings.get("socialAlign") if settings.get("socialAlign") in {"left", "center", "right"} else "center"
    managed_font = next((item for item in (default_fonts or []) if isinstance(item, dict) and item.get("id") == profile_font), None)
    managed_font_url = str(managed_font.get("url") or "") if managed_font else ""
    font_stack = "MisaDefaultFont,Inter,system-ui,sans-serif" if managed_font_url.startswith("data:") else "Inter,system-ui,sans-serif"
    has_font = has_public_asset(assets, "customFont", "font")
    if has_font:
        font_stack = f"MisaProfile,{font_stack}"
    page_place = {"left": "flex-start", "right": "flex-end"}.get(card_align, "center")
    has_banner = has_public_asset(assets, "banner", "image")
    username_glow = bool(settings.get("usernameGlow")) or username_effect == "Glow"
    name_class = "name"
    if username_effect in {"Gradient", "Typewriter"}:
        name_class += " name-gradient"
    elif username_effect == "Shimmer":
        name_class += " name-shimmer"
    elif username_effect == "Rainbow":
        name_class += " name-rainbow"
    elif username_effect == "Fuzzy":
        name_class += " name-fuzzy"
    elif username_effect == "Sparkle":
        name_class += " name-sparkle"
    elif username_effect == "Glitch":
        name_class += " name-glitch"
    elif username_effect == "Pulse":
        name_class += " name-pulse"
    elif username_effect == "Outline":
        name_class += " name-outline"
    elif username_effect == "Neon":
        name_class += " name-neon"
    elif username_effect == "Wave":
        name_class += " name-wave"
    elif username_effect == "Shadow":
        name_class += " name-shadow"
    name_style = f"font-size:{font_size + 8}px;letter-spacing:{letter_spacing}px;color:{username_color};"
    if username_effect in {"Gradient", "Typewriter", "Shimmer"}:
        name_style += f"background:linear-gradient(90deg,{username_color},{username_effect_color},{username_color});-webkit-background-clip:text;background-clip:text;color:transparent;"
    if username_effect == "Outline":
        name_style += f"color:transparent;text-shadow:-1px -1px 0 {username_effect_color},1px -1px 0 {username_effect_color},-1px 1px 0 {username_effect_color},1px 1px 0 {username_effect_color};"
    elif username_glow or username_effect == "Neon":
        name_style += f"text-shadow:0 0 24px {username_effect_color}aa;"
    else:
        name_style += "text-shadow:none;"
    has_avatar = has_public_asset(assets, "avatar", "image")
    has_background = has_public_asset(assets, "background", "image")
    has_video = has_public_asset(assets, "backgroundVideo", "video")
    has_cursor = has_public_asset(assets, "cursor", "image")
    audio_source = str(assets.get("audioSource") or "").strip().lower()
    if audio_source not in {"video", "standalone", "tracks"}:
        audio_source = "tracks" if assets.get("tracks") else "standalone" if (assets.get("audio") or {}).get("url") else "video"
    audio_enabled = audio_source in {"standalone", "tracks"} or bool(assets.get("audioEnabled", True)) and audio_source == "video"
    volume = _clamp(assets.get("volume"), 65, 0, 100)
    volume_ratio = volume / 100
    audio_title = escape(str(assets.get("audioTitle") or "").strip() or str((assets.get("audio") or {}).get("name") or "").rsplit(".", 1)[0] or "Profile audio")
    discord = config.get("discord") if isinstance(config.get("discord"), dict) else {}
    discord_avatar = safe_discord_img(discord.get("avatar"))
    discord_deco = safe_discord_img(discord.get("decoration"))
    guild = discord.get("guildTag") if isinstance(discord.get("guildTag"), dict) else {}
    guild_badge = safe_discord_img(guild.get("badge"))
    guild_tag_text = escape(str(guild.get("tag") or "")[:4])
    avatar_face = (
        f'<img class="avatar" src="{discord_avatar or asset_src("avatar")}" alt="{display_name}">'
        if discord_avatar or has_avatar
        else f'<div class="avatar avatar-placeholder">{escape((str(profile.get("displayName") or username)[:1]) or "*")}</div>'
    )
    deco_tag = f'<img class="avatar-deco" src="{discord_deco}" alt="" onerror="this.remove()">' if discord_deco else ""
    avatar_border_class = "" if show_avatar_border else " no-border"
    avatar_tag = f'<div class="avatar-ring{avatar_border_class}"><div class="avatar-inner{avatar_border_class}">{avatar_face}</div>{deco_tag}</div>' if show_avatar else ""
    guild_img = f'<img src="{guild_badge}" alt="" onerror="this.remove()">' if guild_badge else ""
    guild_tag = f'<span class="guild-tag">{guild_img}{guild_tag_text}</span>' if guild_tag_text else ""
    video_muted = " muted" if audio_source != "video" else ""
    video_tag = (
        f'<video class="bg-video" autoplay{video_muted} loop playsinline src="{asset_src("backgroundVideo")}"></video>'
        if has_video
        else ""
    )
    playlist = public_playlist(username_raw, assets) if audio_source == "tracks" else []
    if audio_source == "standalone" and asset_src("audio"):
        playlist = [{
            "id": "standalone",
            "title": audio_title,
            "audio": asset_src("audio"),
            "artwork": asset_src("audioArtwork") or (asset_src("avatar") if has_avatar else ""),
        }]
    first = playlist[0] if playlist else None
    art_src = (first or {}).get("artwork") or (asset_src("avatar") if has_avatar else "")
    art_tag = f'<img id="audio-art" class="player-art" src="{escape(art_src, quote=True)}" alt="">' if art_src else '<img id="audio-art" class="player-art player-art-empty" alt="">'
    audio_tag = '<audio id="profile-audio" preload="none"></audio>' if playlist else ""
    playlist_data = (
        f'<script type="application/json" id="playlist-data">{json.dumps(playlist, separators=(",", ":")).replace("<", "\\u003c")}</script>'
        if playlist
        else ""
    )
    audio_controls = (
        f'<div class="player" id="profile-player">'
        f'<div class="player-top">{art_tag}<div class="player-meta"><strong id="audio-title">{escape((first or {}).get("title") or audio_title)}</strong><span id="audio-count">1 / {len(playlist)}</span></div></div>'
        f'<input id="audio-seek" type="range" min="0" max="1" value="0" aria-label="Seek">'
        f'<div class="player-times"><span id="audio-now">0:00</span><span id="audio-dur">0:00</span></div>'
        f'<div class="player-controls">'
        f'<button type="button" id="audio-shuffle" class="audio-btn" data-on="0" aria-label="Shuffle"></button>'
        f'<button type="button" id="audio-prev" class="audio-btn" aria-label="Previous track"></button>'
        f'<button type="button" id="audio-play" class="audio-btn play" data-playing="0" aria-label="Play or pause"></button>'
        f'<button type="button" id="audio-next" class="audio-btn" aria-label="Next track"></button>'
        f'<button type="button" id="audio-repeat" class="audio-btn" data-mode="all" aria-label="Repeat"></button>'
        f'</div>'
        f'<div class="player-volume"><button type="button" id="audio-mute" class="audio-btn" data-muted="0" aria-label="Mute"></button>'
        f'<input id="audio-volume" type="range" min="0" max="100" value="{volume}" aria-label="Volume"></div>'
        f"</div>"
        if playlist
        else ""
    )
    wash_style = (
        f"background-image:radial-gradient(circle at 19% 10%,{accent}4d,transparent 28%),"
        f"radial-gradient(circle at 80% 75%,{accent}26,transparent 32%),"
        f"linear-gradient(135deg,{background},{background} 48%,#07070a);"
    )
    background_tag = (
        f'<img class="bg-image" src="{asset_src("background")}" alt="">'
        if has_background
        else f'<div class="bg-wash" style="{wash_style}"></div>'
    )
    cursor_attr = f' data-cursor="{asset_src("cursor")}"' if has_cursor else ""
    body_classes = [cls for cls in ("has-cursor" if has_cursor else "", "widget-swap" if widget_swap else "", f"align-{card_align}", f"content-{content_align}", f"layout-{layout.lower()}") if cls]
    body_class = f' class="{" ".join(body_classes)}"' if body_classes else ""
    cursor_css = f'html{{--cursor:url("{asset_src("cursor")}") 16 16, auto}}' if has_cursor else ""
    card_opacity = (min(profile_opacity + 0.08, 0.80) if layout == "Simplistic" else profile_opacity) * profile_frame_opacity
    card_blur = max(profile_blur - 10, 0) if layout == "Simplistic" else profile_blur
    use_gradient = bool(settings.get("profileGradient") is not False) and layout != "Simplistic"
    card_background = (
        f"linear-gradient(145deg,{_color_with_alpha(accent, 0.07 * profile_frame_opacity)},transparent 40%),rgba(8,8,13,{card_opacity})"
        if use_gradient
        else f"rgba(8,8,13,{card_opacity})"
    )
    border_css = _color_with_alpha(border_color, profile_frame_opacity)
    card_shadow = (
        f"0 12px 40px rgba(0,0,0,{0.22 * profile_frame_opacity:.3f})"
        if layout == "Simplistic"
        else f"0 25px 90px rgba(0,0,0,{0.36 * profile_frame_opacity:.3f}),0 0 70px {_color_with_alpha(accent, 0.09 * profile_frame_opacity)}"
    )
    card_padding = "0" if layout == "Sleek" else ("24px 28px" if layout == "Simplistic" else "36px 28px")
    links, justify = _public_social_markup(config, icon_color)
    location_tag = (
        f'<p class="location"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></svg>{location}</p>'
        if location
        else ""
    )
    if bio_typewriter:
        description_tag = '<p class="description" id="profile-bio"></p>'
    elif raw_description.strip():
        description_tag = f'<p class="description">{"<br>".join(escape(line) for line in raw_description.splitlines())}</p>'
    else:
        description_tag = ""
    bio_data = (
        f'<script type="application/json" id="bio-lines">{json.dumps(bio_lines, separators=(",", ":")).replace("<", "\\u003c")}</script>'
        if bio_typewriter
        else ""
    )
    title_data = (
        f'<script type="application/json" id="page-title-data">{json.dumps(share["title"], separators=(",", ":")).replace("<", "\\u003c")}</script>'
        if tab_title_on
        else ""
    )
    font_face = f'@font-face{{font-family:MisaProfile;src:url("{asset_src("customFont")}");font-display:swap}}' if has_font else ""
    if managed_font_url.startswith("data:"):
        font_face += f'@font-face{{font-family:MisaDefaultFont;src:url("{managed_font_url}");font-display:swap}}'
    badges_tag = _public_badges(config, settings)
    views = _clamp((config.get("profile") or {}).get("views"), 0, 0, 1_000_000_000)
    views_tag = (
        f'<span class="views"><span class="eye" aria-hidden="true"></span>{views:,} profile views</span>'
        if settings.get("showViews")
        else ""
    )
    joined = _join_label(profile.get("joinedAt"))
    join_tag = f'<span class="views">{joined}</span>' if settings.get("showJoinDate") and joined else ""
    meta_tag = f'<div class="meta">{views_tag}{join_tag}</div>' if views_tag or join_tag else ""
    banner_tag = (
        f'<div class="banner"><img src="{asset_src("banner")}" alt=""></div>'
        if has_banner
        else ('<div class="banner banner-fallback"></div>' if layout == "Sleek" else "")
    )
    effects = _effect_markup(background_effect)
    verified = (
        '<span class="verified" title="Verified"><svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true"><path d="M12 2 9.2 4.1 5.7 4.6 4.6 8 2.2 10.6 3.5 14l.1 3.6 3.3 1.4L9.2 22 12 20.7 14.8 22l2.3-2.9 3.3-1.4.1-3.6L21.8 10.6 19.4 8 18.3 4.6 14.8 4.1 12 2Zm-1.2 12.7-2.8-2.8 1.2-1.2 1.6 1.6 3.8-3.8 1.2 1.2-5 5Z"/></svg></span>'
        if any(isinstance(item, dict) and item.get("id") == "verified" and item.get("owned") for item in config.get("badges") or [])
        else ""
    )
    display_name_tag = f'<h1 id="display-name" class="{name_class}" style="{name_style}">{display_name}</h1>' if show_display_name else ""
    identity = (
        f'<div class="name-row">{display_name_tag}{guild_tag}{verified}</div>'
        f'<p class="handle">@{username}</p>{description_tag}{location_tag}{badges_tag}'
        f'<div class="socials">{links}</div>{_public_widgets_markup(widgets)}{_public_sections_markup(config, username_raw)}{audio_controls}{meta_tag}'
    )
    if layout == "Sleek":
        card_inner = f'<div class="sleek-hero">{banner_tag}{avatar_tag}</div><div class="sleek-body">{identity}</div>'
    elif layout == "Simplistic":
        card_inner = f'{avatar_tag}{identity}'
    else:
        card_inner = f'{banner_tag}<div class="{"card-body after-banner" if has_banner else "card-body"}">{avatar_tag}{identity}<div class="brand">misa.lol</div></div>'
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{page_title}</title>
<meta name="description" content="{share_description}">
<meta name="theme-color" content="{accent}">
<link rel="canonical" href="{page_url}">
<link rel="icon" href="{favicon_url}">
<link rel="apple-touch-icon" href="{favicon_url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="misa.lol">
<meta property="og:title" content="{page_title}">
<meta property="og:description" content="{share_description}">
<meta property="og:url" content="{page_url}">
<meta property="og:image" content="{og_image_url}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{page_title}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{page_title}">
<meta name="twitter:description" content="{share_description}">
<meta name="twitter:image" content="{og_image_url}">
<style>
{font_face}
*{{box-sizing:border-box}}html,body{{margin:0;min-height:100vh;min-height:100dvh;background:{background};color:{text_color};font-family:{font_stack};font-size:{font_size}px;scrollbar-width:none;-ms-overflow-style:none}}
html::-webkit-scrollbar,body::-webkit-scrollbar,.lyrics::-webkit-scrollbar{{display:none}}
{cursor_css}
.has-cursor,.has-cursor *{{cursor:var(--cursor, auto)}}
body{{position:relative;display:flex;align-items:center;justify-content:{page_place};padding:32px 16px;overflow:auto{";perspective:900px" if card_tilt else ""}}}
.card-stage{{position:relative;z-index:2;width:min(92vw,430px);transform:translate({frame_x}vw,{frame_y}vh) scale({frame_scale});transform-origin:center;}}
#profile-audio{{position:absolute;width:0;height:0;opacity:0;pointer-events:none}}
.bg-wash,.bg-image,.bg-video,.fx,.backdrop{{position:fixed;inset:0;pointer-events:none}}
.fx *,.fx::before,.fx::after,.fx-glow::before,.fx-glow::after,.fx-aurora span,.dot{{pointer-events:none}}
.bg-wash{{z-index:0;opacity:{background_opacity};background-size:cover;background-position:center;animation:drift 18s ease-in-out infinite}}
.bg-image,.bg-video{{z-index:0;width:100%;height:100%;object-fit:cover;opacity:{background_opacity}}}
.backdrop{{z-index:1;background:rgba(0,0,0,.35)}}
.fx{{z-index:1}}
.fx-glow{{background:radial-gradient(ellipse at center,transparent 15%,rgba(0,0,0,.45) 78%)}}
.fx-glow::before,.fx-glow::after{{content:"";position:absolute;border-radius:50%;filter:blur(40px);animation:pulse 4.8s ease-in-out infinite}}
.fx-glow::before{{width:280px;height:280px;left:12%;top:8%;background:{accent}55}}
.fx-glow::after{{width:240px;height:240px;right:10%;bottom:12%;background:{accent}40;animation-delay:-2s}}
.fx-stars{{opacity:.6;background-image:radial-gradient(circle,rgba(255,255,255,.8) 1px,transparent 1px);background-size:67px 67px}}
.fx-stars{{animation:background-stars 5s ease-in-out infinite}}
.fx-waves{{background:repeating-linear-gradient(115deg,transparent 0 46px,{accent}22 47px 49px,transparent 50px 94px);background-size:180px 180px;opacity:.35;animation:background-waves 15s ease-in-out infinite}}
.ember{{position:absolute;border-radius:50%;background:{accent};box-shadow:0 0 12px {accent};animation:background-ember 6s ease-in-out infinite}}
.rain{{position:absolute;top:-15%;width:1px;background:#ffffff40;animation:background-rain 3s linear infinite}}

.dot{{position:absolute;border-radius:50%;background:#fff6;animation:drift 8s ease-in-out infinite}}
.card{{position:relative;width:100%;margin:0;padding:{card_padding};border:{border_width}px solid {border_css};border-radius:{profile_radius}px;background:{card_background};backdrop-filter:blur({card_blur}px);box-shadow:{card_shadow};text-align:{content_align};overflow:hidden;pointer-events:auto{";transform-style:preserve-3d" if card_tilt else ""}}}
.card.no-frame{{border-color:transparent;background:transparent;backdrop-filter:none;box-shadow:none}}
.card.no-frame::before{{display:none}}
.card-body.after-banner{{padding-top:20px}}
.layout-sleek .card{{overflow:hidden}}
.card::before{{content:"";position:absolute;inset:0 32px auto;height:1px;background:linear-gradient(90deg,transparent,{accent}aa,transparent)}}
.layout-simplistic .card::before,.layout-sleek .card::before{{display:none}}
.banner{{height:112px;overflow:hidden;border-radius:{banner_radius}}}
.layout-sleek .banner{{height:148px;border-radius:0}}
.layout-sleek .banner-fallback{{height:112px}}
.banner img,.banner-fallback{{width:100%;height:100%;object-fit:cover;display:block}}
.banner-fallback{{background:linear-gradient(135deg,{accent}55,transparent)}}
.sleek-hero{{position:relative}}
.sleek-body{{padding:48px 20px 24px}}
.avatar-ring{{position:relative;width:96px;height:96px;margin:0 auto 20px;padding:4px;border-radius:{avatar_radius};background:linear-gradient(135deg,{accent},#ffffff55,{accent}22)}}
.avatar-ring.no-border{{padding:0;background:transparent}}
.avatar-inner{{width:100%;height:100%;overflow:hidden;border-radius:{avatar_radius};border:4px solid #15151d;background:linear-gradient(135deg,#6358a3,#282442,#0d0d13)}}
.avatar-inner.no-border{{border:0;background:transparent}}
.avatar-ring .avatar{{width:100%;height:100%;object-fit:cover;border:0;border-radius:0;display:block;box-shadow:none}}
.avatar-deco{{position:absolute;left:-18%;top:-18%;width:136%;height:136%;pointer-events:none;z-index:3}}
.layout-sleek .avatar-ring{{position:absolute;left:20px;bottom:-32px;width:72px;height:72px;margin:0;z-index:2}}
.layout-simplistic .avatar-ring{{width:80px;height:80px;margin-bottom:16px}}
.avatar-placeholder{{display:grid;place-items:center;color:#fff;font-size:28px;font-weight:600}}
.name-row{{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap}}
.content-left .name-row,.content-left .location,.content-left .meta{{justify-content:flex-start}}
.content-right .name-row,.content-right .location,.content-right .meta{{justify-content:flex-end}}
.content-center .location,.content-center .meta{{justify-content:center}}
.verified{{display:inline-flex;color:#a99bff}}
.verified svg{{display:block}}
.guild-tag{{display:inline-flex;align-items:center;gap:5px;padding:2px 6px;border-radius:6px;border:1px solid #ffffff26;background:#ffffff1a;color:#ffffffe6;font-size:11px;letter-spacing:.04em;font-weight:600}}
.guild-tag img{{width:16px;height:16px;border-radius:4px;object-fit:cover}}
h1{{margin:0;font-size:24px;font-weight:600;letter-spacing:-.04em;color:#fff}}
.name-gradient,.name-shimmer{{background:linear-gradient(90deg,#fff,#c5baff,#8d7df0);-webkit-background-clip:text;background-clip:text;color:transparent}}
.name-shimmer{{background-size:200% 100%;animation:shimmer 2.8s linear infinite}}
.name-rainbow{{background-image:linear-gradient(90deg,#ff5c7a,#ffd36a,#6dffb0,#6db7ff,#c58bff,#ff5c7a);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:name-rainbow 2.4s linear infinite}}
.name-fuzzy{{animation:name-fuzzy 1.8s ease-in-out infinite}}
.name-sparkle{{animation:name-sparkle 1.4s ease-in-out infinite}}
.name-glitch{{animation:name-glitch .65s steps(2,end) infinite}}
.name-pulse{{animation:name-pulse 1.8s ease-in-out infinite}}
.name-outline{{background:none!important}}
.name-neon{{animation:name-pulse 1.8s ease-in-out infinite}}
.name-wave{{animation:name-wave 1.4s ease-in-out infinite;transform-origin:center}}
.name-shadow{{animation:name-shadow 1.8s ease-in-out infinite}}
@keyframes name-rainbow{{0%{{background-position:0 50%}}100%{{background-position:200% 50%}}}}
@keyframes name-fuzzy{{0%,100%{{filter:blur(0)}}50%{{filter:blur(1.6px)}}}}
@keyframes name-sparkle{{0%,100%{{text-shadow:0 0 6px #fff8}}50%{{text-shadow:0 0 14px #fff,-10px -8px 0 #fff8,12px 4px 0 #ffe9}}}}
@keyframes name-glitch{{0%,100%{{transform:translate(0)}}20%{{transform:translate(-1px,1px)}}40%{{transform:translate(1px,-1px)}}60%{{transform:translate(-1px,0)}}80%{{transform:translate(1px,1px)}}}}
@keyframes name-pulse{{0%,100%{{opacity:1;transform:scale(1)}}50%{{opacity:.72;transform:scale(1.035)}}}}
@keyframes name-wave{{0%,100%{{transform:skewX(0)}}50%{{transform:skewX(-5px) translateY(-2px)}}}}
@keyframes name-shadow{{0%,100%{{text-shadow:4px 4px 0 #0008}}50%{{text-shadow:8px 6px 0 #0008}}}}
.handle{{margin:4px 0 0;color:#ffffff;opacity:.35;font-size:12px}}
.description{{margin:12px 0 0;max-width:none;color:#ffffff;opacity:.65;font-size:14px;line-height:1.5}}
.location{{display:flex;align-items:center;justify-content:center;gap:6px;margin:12px 0 0;color:#ffffff;opacity:.4;font-size:12px}}
.location svg{{flex-shrink:0}}
.meta{{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px 12px;margin-top:28px}}
.views{{display:inline-flex;align-items:center;gap:8px;margin:0;color:#ffffff;opacity:.35;font-size:12px}}
.eye{{position:relative;display:inline-flex;width:20px;height:14px;border:1px solid currentColor;border-radius:50%}}
.eye::after{{content:"";position:absolute;left:50%;top:50%;width:6px;height:6px;border-radius:50%;background:currentColor;transform:translate(-50%,-50%)}}
.badges{{display:flex;flex-wrap:wrap;justify-content:{justify};gap:8px;margin-top:24px}}
.badge{{display:grid;place-items:center;width:32px;height:32px;border-radius:999px;border:1px solid #ffffff1a;background:#ffffff12;color:inherit}}
.badge img{{display:block;width:15px;height:15px;object-fit:contain}}
.badge svg{{display:block}}
.socials{{display:flex;flex-wrap:wrap;justify-content:{justify};gap:10px;margin-top:28px;width:100%}}
.social{{display:grid;place-items:center;width:40px;height:40px;padding:0;border:1px solid #ffffff17;border-radius:12px;background:#ffffff0e;color:inherit;text-decoration:none;cursor:pointer;font:inherit}}
.social img{{width:18px;height:18px;object-fit:contain;border-radius:4px}}
.social-glyph{{display:block;width:18px;height:18px;background:currentColor;-webkit-mask:var(--glyph) center/contain no-repeat;mask:var(--glyph) center/contain no-repeat}}
.social svg{{display:block}}
.social svg:not([fill="none"]){{fill:currentColor}}
.social:hover{{border-color:{accent};background:{accent}22}}
.entry{{position:fixed;inset:0;z-index:4;display:grid;place-items:center;align-content:center;gap:14px;border:0;background:rgba(0,0,0,.6);color:#fff;cursor:pointer;font:inherit}}
.entry-play{{width:48px;height:48px;border-radius:16px;border:1px solid #ffffff29;background:#ffffff12}}
.entry small{{color:#ffffff66;font-size:12px}}
#copy-toast{{position:fixed;bottom:24px;left:50%;z-index:5;transform:translateX(-50%);padding:8px 12px;border-radius:999px;background:#111118ee;color:#fff;font-size:12px}}
#copy-toast[hidden],.card[hidden],.entry[hidden]{{display:none}}
.brand{{display:block;margin-top:28px;color:#ffffff33;font-size:10px;letter-spacing:.23em;text-transform:uppercase}}
.player{{position:relative;z-index:5;margin-top:24px;padding:12px;border:1px solid #ffffff1a;border-radius:18px;background:#00000040;text-align:left;pointer-events:auto;isolation:isolate}}
.player-top{{display:flex;align-items:center;gap:12px}}
.player-art{{width:56px;height:56px;border-radius:12px;object-fit:cover;background:#ffffff10}}
.player-art-empty{{display:grid;place-items:center;color:#ffffff88}}
.player-meta{{min-width:0;flex:1}}
.player-meta strong{{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}}
.player-meta span{{display:block;margin-top:4px;color:#ffffff66;font-size:11px}}
.player-times{{display:flex;justify-content:space-between;margin:4px 0 8px;color:#ffffff55;font-size:10px;font-family:ui-monospace,monospace}}
.player-controls{{display:flex;justify-content:center;align-items:center;gap:6px;flex-wrap:wrap}}
.player-volume{{display:flex;align-items:center;gap:8px;margin-top:10px}}
#audio-seek,#audio-volume{{width:100%;accent-color:{accent};pointer-events:auto;cursor:pointer}}
#audio-seek{{margin-top:10px}}
.audio-btn{{position:relative;z-index:1;width:36px;height:36px;border:0;border-radius:999px;background:#ffffff14;color:#fff;cursor:pointer;pointer-events:auto;-webkit-tap-highlight-color:transparent}}
.audio-btn.play{{width:42px;height:42px}}
.audio-btn::before,.audio-btn::after{{pointer-events:none}}
#audio-play::before{{content:"▶"}}#audio-play[data-playing="1"]::before{{content:"❚❚"}}
#audio-prev::before{{content:"⏮"}}#audio-next::before{{content:"⏭"}}
#audio-shuffle::before{{content:"↝"}}#audio-shuffle[data-on="1"]{{background:#9b87f533}}
#audio-repeat::before{{content:"🔁"}}#audio-repeat[data-mode="off"]{{opacity:.45}}#audio-repeat[data-mode="one"]::after{{content:"1";font-size:9px}}
#audio-mute::before{{content:"♪"}}#audio-mute[data-muted="1"]::before{{content:"ø"}}
.widget-swap .player{{background:{accent};color:{background};border-color:{background}33}}
.widget-swap .player-meta span,.widget-swap .player-times{{color:{background};opacity:.66}}
.widget-swap .player-art-empty{{background:{background}22;color:{background}}}
.widget-swap .audio-btn{{background:{background}22;color:{background}}}
.widget-swap .audio-btn.play,.widget-swap #audio-shuffle[data-on="1"]{{background:{background}33}}
.widget-swap #audio-seek,.widget-swap #audio-volume{{accent-color:{background}}}
.widgets{{display:flex;flex-direction:column;gap:10px;margin-top:24px}}
.widget{{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid #ffffff1a;border-radius:18px;background:#00000040;color:inherit;text-decoration:none}}
.widget-art{{width:56px;height:56px;border-radius:12px;object-fit:cover;background:#ffffff10;flex-shrink:0}}
.widget-art-empty{{display:grid;place-items:center;color:#ffffff66;font-size:10px;text-transform:uppercase;letter-spacing:.06em}}
.widget-meta{{min-width:0;flex:1;text-align:left}}
.widget-meta strong{{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}}
.widget-meta span{{display:block;margin-top:4px;color:#ffffff66;font-size:11px}}
.widget.is-error{{opacity:.85}}
.widget-swap .widget{{background:{accent};color:{background};border-color:{background}33}}
.widget-swap .widget-meta span{{color:{background};opacity:.66}}
.widget-swap .widget-art-empty{{background:{background}22;color:{background}}}
.sections{{display:flex;flex-direction:column;gap:10px;margin-top:24px}}
.section{{padding:12px;border:1px solid #ffffff1a;border-radius:18px;background:#00000040;text-align:left}}
.section h2,.section h3,.section h4{{margin:0 0 8px;font-size:13px;font-weight:600}}
.section p,.section li{{margin:0 0 8px;color:#ffffffa8;font-size:13px;line-height:1.5}}
.section ul,.section ol{{margin:0 0 8px;padding-left:18px}}
.section a{{color:inherit}}
.section code{{padding:1px 5px;border-radius:6px;background:#ffffff14;font-size:12px}}
.section-project{{display:flex;gap:12px;align-items:flex-start}}
.section-cover{{width:64px;height:64px;border-radius:12px;object-fit:cover;background:#ffffff10;flex-shrink:0}}
.section-tags{{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}}
.section-tag{{padding:3px 8px;border-radius:999px;background:#ffffff14;color:#ffffffcc;font-size:10px}}
.lyrics{{max-height:160px;overflow:auto;margin-top:8px;scrollbar-width:none;-ms-overflow-style:none}}
.lyrics p{{margin:0;padding:3px 0;color:#ffffff66;font-size:13px}}
.lyrics p.is-active{{color:#fff;font-weight:600}}
.widget-swap .section{{background:{accent};color:{background};border-color:{background}33}}
.widget-swap .section p,.widget-swap .section li,.widget-swap .lyrics p{{color:{background};opacity:.7}}
.widget-swap .lyrics p.is-active{{color:{background};opacity:1}}
.widget-swap .section-tag,.widget-swap .section code{{background:{background}22;color:{background}}}
@keyframes drift{{0%,100%{{transform:translate3d(0,0,0)}}50%{{transform:translate3d(12px,-18px,0)}}}}
@keyframes shimmer{{0%{{background-position:0 50%}}100%{{background-position:100% 50%}}}}
@keyframes pulse{{0%,100%{{opacity:.42;transform:scale(1)}}50%{{opacity:.9;transform:scale(1.08)}}}}
@keyframes aurora{{0%,100%{{transform:translate3d(-6%,-3%,0) scale(1)}}50%{{transform:translate3d(7%,5%,0) scale(1.12)}}}}
@keyframes background-stars{{0%,100%{{opacity:.35}}50%{{opacity:.8}}}}
@keyframes background-waves{{0%{{transform:translate3d(-4%,-2%,0) rotate(0deg);background-position:0 0}}50%{{transform:translate3d(4%,2%,0) rotate(3deg);background-position:120px 80px}}100%{{transform:translate3d(-4%,-2%,0) rotate(0deg);background-position:240px 0}}}}
@keyframes background-ember{{0%,100%{{transform:translate3d(0,18px,0) scale(.65);opacity:.2}}50%{{transform:translate3d(-12px,-28px,0) scale(1.3);opacity:.95}}}}
@keyframes background-rain{{0%{{transform:translate3d(0,-20vh,0);opacity:0}}15%{{opacity:.7}}100%{{transform:translate3d(18px,130vh,0);opacity:0}}}}

.fx-aurora span{{position:absolute;border-radius:50%;filter:blur(48px);animation:aurora 9s ease-in-out infinite}}
.fx-aurora span:first-child{{left:-15%;top:-8%;width:70%;height:55%;background:{accent}55}}
.fx-aurora span:last-child{{right:-12%;bottom:-6%;width:65%;height:50%;background:#5eead455;animation-delay:-2.4s}}
@keyframes enter-fade{{from{{opacity:0}}to{{opacity:1}}}}
@keyframes enter-unfold{{from{{opacity:0;transform:scaleY(.12)}}to{{opacity:1;transform:none}}}}
@keyframes enter-pop{{from{{opacity:0;transform:scale(.86)}}to{{opacity:1;transform:none}}}}
.enter-fade{{animation:enter-fade .55s ease both}}
.enter-unfold{{transform-origin:top center;animation:enter-unfold .55s ease both}}
.enter-pop{{animation:enter-pop .45s cubic-bezier(.22,1,.36,1) both}}
@media (prefers-reduced-motion:reduce){{.enter-fade,.enter-unfold,.enter-pop{{animation:none}}}}
</style></head>
<body{body_class}{cursor_attr} data-profile-user="{username}" data-audio-enabled="{1 if audio_enabled else 0}" data-volume="{volume_ratio}" data-tilt="{card_tilt}" data-typewriter="{1 if username_effect == "Typewriter" else 0}" data-name-effect="{escape(username_effect, quote=True)}" data-tab-title="{tab_title_on}" data-bio-type-ms="{bio_type_ms}" data-bio-delete-ms="{bio_delete_ms}" data-bio-pause-ms="{bio_pause_ms}" data-page-enter="{escape(page_enter, quote=True)}" data-click-sound="{click_sound_on}"{f' data-click-src="{asset_src("clickSound")}"' if has_click else ""}>
{background_tag}{video_tag}{effects}<div class="backdrop"></div>
{f'<button type="button" id="entry" class="entry"><span class="entry-play"></span><small>{entry_text}</small></button>' if entry_on else ""}
<div class="card-stage"><main class="card{' no-frame' if not frame_visible else ""}" id="profile-card"{' hidden' if entry_on else ""}>{card_inner}</main></div>
{audio_tag}
{playlist_data}
{bio_data}
{title_data}
{PUBLIC_COPY_SCRIPT}
{PUBLIC_ANALYTICS_SCRIPT}
{PUBLIC_WIDGET_SCRIPT}
{PUBLIC_LYRICS_SCRIPT}
</body></html>"""


def _public_sections_markup(config: dict, username: str) -> str:
    cards: list[str] = []
    for item in config.get("sections") or []:
        if not isinstance(item, dict) or not item.get("enabled") or not section_has_content(item):
            continue
        kind = str(item.get("type") or "")
        title = escape(str(item.get("title") or "")[:80])
        heading = f"<h2>{title}</h2>" if title else ""
        if kind in {"about", "text"}:
            body = render_safe_markdown(str(item.get("body") or ""))
            if not body and not title:
                continue
            cards.append(f'<section class="section">{heading}{body}</section>')
            continue
        if kind == "skills":
            tags = "".join(f'<span class="section-tag">{escape(str(tag)[:24])}</span>' for tag in item.get("tags") or [])
            if not tags:
                continue
            cards.append(f'<section class="section">{heading}<div class="section-tags">{tags}</div></section>')
            continue
        if kind == "project":
            href = public_social_href(str(item.get("href") or ""), "Custom URL")
            cover = ""
            if (item.get("cover") or {}).get("url"):
                src = escape(f"/api/v1/profile/{username}/sections/{item.get('id')}/cover", quote=True)
                cover = f'<img class="section-cover" src="{src}" alt="">'
            body = render_safe_markdown(str(item.get("body") or ""))
            tags = "".join(f'<span class="section-tag">{escape(str(tag)[:24])}</span>' for tag in item.get("tags") or [])
            tag_row = f'<div class="section-tags">{tags}</div>' if tags else ""
            inner = f'{cover}<div class="section-copy">{heading}{body}{tag_row}</div>'
            if href:
                cards.append(f'<a class="section section-project" href="{escape(href, quote=True)}" target="_blank" rel="noopener noreferrer">{inner}</a>')
            else:
                cards.append(f'<section class="section section-project">{inner}</section>')
            continue
        if kind == "lyrics":
            lines = parse_lyrics(str(item.get("body") or ""))
            if not lines:
                continue
            rows = []
            for line in lines:
                text = escape(str(line.get("text") or ""))
                stamp = line.get("t")
                attr = f' data-t="{stamp}"' if isinstance(stamp, (int, float)) else ""
                rows.append(f"<p{attr}>{text}</p>")
            cards.append(f'<section class="section" data-lyrics="1">{heading}<div class="lyrics">{"".join(rows)}</div></section>')
    if not cards:
        return ""
    return f'<div class="sections">{"".join(cards)}</div>'


def _public_widgets_markup(widgets: list | None) -> str:
    cards: list[str] = []
    for item in widgets or []:
        if not isinstance(item, dict):
            continue
        status = str(item.get("status") or "empty")
        title = escape(str(item.get("title") or item.get("type") or "Widget")[:80])
        subtitle = escape(str(item.get("subtitle") or "")[:80])
        image = safe_widget_url(item.get("image"))
        href = safe_widget_url(item.get("href"))
        meta = item.get("meta") if isinstance(item.get("meta"), dict) else {}
        zone = escape(str(meta.get("timezone") or ""), quote=True) if item.get("type") == "timezone" else ""
        kind = escape(str(item.get("type") or "widget")[:10])
        art = (
            f'<img class="widget-art" src="{escape(image, quote=True)}" alt="">'
            if image
            else f'<div class="widget-art widget-art-empty">{kind}</div>'
        )
        inner = f'{art}<div class="widget-meta"><strong>{title}</strong><span>{subtitle}</span></div>'
        cls = "widget" + (" is-error" if status != "ok" else "")
        extra = f' data-timezone="{zone}"' if zone else ""
        if href and status == "ok":
            cards.append(f'<a class="{cls}" href="{escape(href, quote=True)}" target="_blank" rel="noopener noreferrer"{extra}>{inner}</a>')
        else:
            cards.append(f'<div class="{cls}"{extra}>{inner}</div>')
    if not cards:
        return ""
    return f'<div class="widgets">{"".join(cards)}</div>'


def _public_social_markup(config: dict, global_icon_color: str) -> tuple[str, str]:
    settings = config.get("settings") or {}
    button_style = settings.get("buttonStyle") if settings.get("buttonStyle") in {"glass", "solid", "outline"} else "glass"
    if settings.get("showSocials") is False:
        return "", "center"
    align = settings.get("socialAlign") if settings.get("socialAlign") in {"left", "center", "right"} else "center"
    justify = {"left": "flex-start", "right": "flex-end"}.get(align, "center")
    monochrome = bool(settings.get("monochromeIcons"))
    buttons: list[str] = []
    for social in config.get("socials") or []:
        if not social.get("enabled"):
            continue
        social_id = escape(str(social.get("id") or ""), quote=True)
        label = escape(str(social.get("label") or social.get("platform") or "Link"), quote=True)
        value = str(social.get("value") or "")
        platform = str(social.get("platform") or "Custom URL")
        href = public_social_href(value, platform)
        action = social.get("action")
        if action not in {"open", "copy"}:
            action = "copy" if social.get("displayMode") == "text" else "open"
        icon = social.get("customIcon") or {}
        icon_url = str(icon.get("url") or "")
        if is_safe_social_icon(icon_url) and monochrome:
            inner = f'<span class="social-glyph" style="--glyph:url(&quot;{escape(icon_url, quote=True)}&quot;)"></span>'
        elif is_safe_social_icon(icon_url):
            inner = f'<img src="{escape(icon_url, quote=True)}" alt="">'
        else:
            inner = social_icon_markup(platform)
        color = resolve_icon_color(platform, social.get("iconColor"), global_icon_color, monochrome)
        glow = social.get("iconGlow") if isinstance(social.get("iconGlow"), bool) else bool(settings.get("socialGlow"))
        glow_style = f"filter:drop-shadow(0 0 6px {color}) drop-shadow(0 0 16px {color});" if glow else "filter:none;"
        if button_style == "solid":
            style = f"color:#0b0b10;fill:#0b0b10;background:{color};border:0;{glow_style}"
        elif button_style == "outline":
            style = f"color:{color};fill:{color};background:transparent;border:2px solid {color};{glow_style}"
        else:
            style = f"color:{color};fill:{color};{glow_style}"
        if action == "open" and href:
            buttons.append(
                f'<a class="social" href="{escape(href, quote=True)}" target="_blank" rel="noopener noreferrer" '
                f'data-social-id="{social_id}" data-social-platform="{escape(platform, quote=True)}" data-social-action="open" aria-label="Open {label}" title="{escape(value, quote=True)}" style="{style}">{inner}</a>'
            )
        else:
            buttons.append(
                f'<button type="button" class="social" data-social-id="{social_id}" data-social-platform="{escape(platform, quote=True)}" data-social-action="copy" '
                f'data-copy="{escape(value, quote=True)}" aria-label="Copy {label}" title="{escape(value, quote=True)}" style="{style}">{inner}</button>'
            )
    return "".join(buttons), justify


def _public_badges(config: dict, settings: dict) -> str:
    if settings.get("showBadges") is False:
        return ""
    items: list[str] = []
    for badge in config.get("badges") or []:
        if not badge.get("owned") or not badge.get("enabled"):
            continue
        color = css_hex_color(settings.get("iconColor") if badge.get("monochrome") else badge.get("color"), "#d8d3ff")
        glow = f"box-shadow:0 0 18px {color}4d;" if settings.get("badgeGlow") else ""
        paint = f"color:{color};background:{color}22;border-color:{color}66;{glow}"
        name = escape(str(badge.get("name") or "Badge"), quote=True)
        icon_src = str(badge.get("icon") or "")
        mark = (
            f'<img src="{escape(icon_src, quote=True)}" alt="" width="15" height="15">'
            if icon_src.startswith("/api/v1/badges/") and icon_src.endswith("/icon")
            else _badge_icon_markup(str(badge.get("name") or ""))
        )
        items.append(f'<span class="badge" title="{name}" style="{paint}">{mark}</span>')
    return f'<div class="badges">{"".join(items)}</div>' if items else ""


def _badge_icon_markup(name: str) -> str:
    if name == "Premium":
        return '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M12 3 9.5 8.5 3 9.2l4.8 4.2L6.5 20 12 16.8 17.5 20l-1.3-6.6L21 9.2 14.5 8.5 12 3Z"/></svg>'
    if name == "OG":
        return '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 10-14h-7l0-6Z"/></svg>'
    return '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M12 2 9.2 4.1 5.7 4.6 4.6 8 2.2 10.6 3.5 14l.1 3.6 3.3 1.4L9.2 22 12 20.7 14.8 22l2.3-2.9 3.3-1.4.1-3.6L21.8 10.6 19.4 8 18.3 4.6 14.8 4.1 12 2Zm-1.2 12.7-2.8-2.8 1.2-1.2 1.6 1.6 3.8-3.8 1.2 1.2-5 5Z"/></svg>'


def _effect_markup(effect: str) -> str:
    if effect == "Particles":
        dots = []
        for index in range(22):
            left = (index * 37) % 100
            top = (index * 61) % 100
            delay = (index % 7) * 0.5
            size = 2 + (index % 3)
            dots.append(
                f'<span class="dot" style="left:{left}%;top:{top}%;width:{size}px;height:{size}px;animation-delay:{delay}s"></span>'
            )
        return f'<div class="fx fx-particles">{"".join(dots)}</div>'
    if effect == "Stars":
        return '<div class="fx fx-stars"></div>'
    if effect == "Glow":
        return '<div class="fx fx-glow"></div>'
    if effect == "Aurora":
        return '<div class="fx fx-aurora"><span></span><span></span></div>'
    if effect == "Waves":
        return '<div class="fx fx-waves"></div>'
    if effect == "Embers":
        embers = []
        for index in range(22):
            left = (index * 37) % 100
            top = (index * 61) % 100
            delay = (index % 7) * 0.5
            size = 3 + (index % 3)
            embers.append(
                f'<span class="ember" style="left:{left}%;top:{top}%;width:{size}px;height:{size}px;animation-delay:{delay}s"></span>'
            )
        return f'<div class="fx fx-embers">{"".join(embers)}</div>'
    if effect == "Rain":
        drops = []
        for index in range(22):
            left = (index * 37) % 100
            delay = (index % 7) * 0.5
            height = 70 + (index % 5) * 24
            drops.append(
                f'<span class="rain" style="left:{left}%;height:{height}px;animation-delay:{delay}s"></span>'
            )
        return f'<div class="fx fx-rain">{"".join(drops)}</div>'
    return ""


def _join_label(value: object) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    try:
        from datetime import datetime
        stamp = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return f"Joined {stamp.strftime('%b %Y')}"
    except ValueError:
        return ""


def _share_version(config: dict) -> str:
    settings = config.get("settings") if isinstance(config.get("settings"), dict) else {}
    assets = config.get("assets") if isinstance(config.get("assets"), dict) else {}
    parts: list[str] = []
    for key in ("ogTitle", "ogDescription", "ogOverlayAvatar", "ogOverlayName", "ogOverlayAddress", "accentColor", "backgroundColor"):
        parts.append(str(settings.get(key) or ""))
    for key in ("ogImage", "favicon", "avatar", "background"):
        item = assets.get(key)
        url = str((item or {}).get("url") or "") if isinstance(item, dict) else ""
        parts.append(f"{len(url)}:{url[:96]}")
    return hashlib.sha256("|".join(parts).encode()).hexdigest()[:12]


def _clamp(value: object, default: int, low: int, high: int) -> int:
    try:
        number = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        number = default
    return max(low, min(high, number))
