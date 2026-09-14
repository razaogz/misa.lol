"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ar } from "./ar";
import { de } from "./de";
import { en, type Messages } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { detectLocale, localeMeta, LOCALE_STORAGE_KEY, type LocaleId } from "./locales";
import { ptBR } from "./pt-BR";
import { ru } from "./ru";
import { tr } from "./tr";

const catalogs: Record<LocaleId, Messages> = {
  en,
  es,
  "pt-BR": ptBR,
  de,
  fr,
  ru,
  tr,
  ar,
};

type Vars = Record<string, string | number>;

function lookup(messages: Messages, path: string): string | undefined {
  let current: unknown = messages;
  for (const part of path.split(".")) {
    if (!current || typeof current !== "object" || !(part in current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

function interpolate(template: string, vars?: Vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => (vars[key] == null ? `{${key}}` : String(vars[key])));
}

export function translate(locale: LocaleId, path: string, vars?: Vars, fallback?: string) {
  const found = lookup(catalogs[locale], path) ?? lookup(en, path) ?? fallback ?? path;
  return interpolate(found, vars);
}

interface I18nValue {
  locale: LocaleId;
  dir: "ltr" | "rtl";
  setLocale: (next: LocaleId) => void;
  t: (path: string, vars?: Vars, fallback?: string) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleId>("en");

  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  const setLocale = useCallback((next: LocaleId) => {
    setLocaleState(next);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
  }, []);

  const value = useMemo<I18nValue>(() => ({
    locale,
    dir: localeMeta(locale).dir,
    setLocale,
    t: (path, vars, fallback) => translate(locale, path, vars, fallback),
  }), [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}

export function useT() {
  return useI18n().t;
}

export { LOCALES, localeMeta, type LocaleId } from "./locales";
