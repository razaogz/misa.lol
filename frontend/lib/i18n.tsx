"use client";

import { Children, cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useProfile } from "./profile-store";
import { useAuth } from "./auth-store";

export const SUPPORTED_LOCALES = ["en-US", "es-ES", "pt-BR", "fr-FR", "de-DE", "tr-TR"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const LOCALE_LABELS: Record<Locale, string> = {
  "en-US": "English (United States)",
  "es-ES": "Español (España)",
  "pt-BR": "Português (Brasil)",
  "fr-FR": "Français (France)",
  "de-DE": "Deutsch (Deutschland)",
  "tr-TR": "Türkçe (Türkiye)",
};

const translations: Record<Locale, Record<string, string>> = {
  "en-US": {},
  "es-ES": {
    "Account": "Cuenta", "Overview": "Resumen", "Analytics": "Analítica", "Badges": "Insignias", "Settings": "Configuración", "Customize": "Personalizar", "Links": "Enlaces", "Account overview": "Resumen de la cuenta", "Manage your Misa.lol profile and account.": "Administra tu perfil y cuenta de Misa.lol.", "View live profile": "Ver perfil en vivo", "Account statistics": "Estadísticas de la cuenta", "Manage your account": "Administra tu cuenta", "Account Settings": "Configuración de la cuenta", "Connections": "Conexiones", "Connected": "Conectado", "Not connected": "No conectado", "Dashboard": "Panel", "Profile studio": "Estudio del perfil", "Customize your profile": "Personaliza tu perfil", "Save changes": "Guardar cambios", "Saved": "Guardado", "Reset": "Restablecer", "Live preview": "Vista previa en vivo", "Updates instantly": "Se actualiza al instante", "Assets": "Recursos", "General": "General", "Colors": "Colores", "Effects": "Efectos", "Upload": "Subir", "Replace": "Reemplazar", "Remove": "Eliminar", "Description": "Descripción", "Location": "Ubicación", "Language": "Idioma", "English (United States)": "English (Estados Unidos)", "Español (España)": "Español (España)", "Português (Brasil)": "Português (Brasil)", "Français (France)": "Français (Francia)", "Deutsch (Deutschland)": "Deutsch (Alemania)", "Türkçe (Türkiye)": "Türkçe (Turquía)", "Your badges": "Tus insignias", "Other badges": "Otras insignias", "Owned": "Obtenida", "No badges assigned yet.": "Aún no tienes insignias asignadas.", "Add social": "Añadir red social", "Active links": "Enlaces activos", "Hidden links": "Enlaces ocultos", "Cancel": "Cancelar", "Add link": "Añadir enlace", "Search features...": "Buscar funciones...", "Share Your Profile": "Compartir tu perfil", "Help Center": "Centro de ayuda", "Log out": "Cerrar sesión", "Loading your workspace…": "Cargando tu espacio de trabajo…", "Not available yet": "Aún no disponible", "No analytics data available.": "No hay datos de analítica disponibles.", "Coming soon": "Próximamente", "Search": "Buscar", "View": "Ver", "Active": "Activo", "Suspended": "Suspendido", "Delete": "Eliminar", "Create badge": "Crear insignia", "No users found.": "No se encontraron usuarios.", "No reports.": "No hay reportes.", "No audit records.": "No hay registros de auditoría.", "Sign in to Misa.lol": "Inicia sesión en Misa.lol", "Sign in": "Iniciar sesión", "Create account": "Crear cuenta", "Email address": "Dirección de correo", "Password": "Contraseña", "Confirm password": "Confirmar contraseña"
  },
  "pt-BR": {
    "Account": "Conta", "Overview": "Visão geral", "Analytics": "Análises", "Badges": "Distintivos", "Settings": "Configurações", "Customize": "Personalizar", "Links": "Links", "Account overview": "Visão geral da conta", "Manage your Misa.lol profile and account.": "Gerencie seu perfil e sua conta Misa.lol.", "View live profile": "Ver perfil ao vivo", "Account statistics": "Estatísticas da conta", "Manage your account": "Gerenciar sua conta", "Account Settings": "Configurações da conta", "Connections": "Conexões", "Connected": "Conectado", "Not connected": "Não conectado", "Dashboard": "Painel", "Profile studio": "Estúdio do perfil", "Customize your profile": "Personalize seu perfil", "Save changes": "Salvar alterações", "Saved": "Salvo", "Reset": "Redefinir", "Live preview": "Pré-visualização ao vivo", "Updates instantly": "Atualiza instantaneamente", "Assets": "Recursos", "General": "Geral", "Colors": "Cores", "Effects": "Efeitos", "Upload": "Enviar", "Replace": "Substituir", "Remove": "Remover", "Description": "Descrição", "Location": "Localização", "Language": "Idioma", "English (United States)": "English (Estados Unidos)", "Español (España)": "Español (Espanha)", "Português (Brasil)": "Português (Brasil)", "Français (France)": "Français (França)", "Deutsch (Deutschland)": "Deutsch (Alemanha)", "Türkçe (Türkiye)": "Türkçe (Turquia)", "Your badges": "Seus distintivos", "Other badges": "Outros distintivos", "Owned": "Obtido", "No badges assigned yet.": "Nenhum distintivo atribuído ainda.", "Add social": "Adicionar rede social", "Active links": "Links ativos", "Hidden links": "Links ocultos", "Cancel": "Cancelar", "Add link": "Adicionar link", "Search features...": "Buscar recursos...", "Share Your Profile": "Compartilhar seu perfil", "Help Center": "Central de ajuda", "Log out": "Sair", "Loading your workspace…": "Carregando seu espaço de trabalho…", "Not available yet": "Ainda não disponível", "No analytics data available.": "Nenhum dado de análise disponível.", "Coming soon": "Em breve", "Search": "Buscar", "View": "Ver", "Active": "Ativo", "Suspended": "Suspenso", "Delete": "Excluir", "Create badge": "Criar distintivo", "No users found.": "Nenhum usuário encontrado.", "No reports.": "Nenhum relatório.", "No audit records.": "Nenhum registro de auditoria.", "Sign in to Misa.lol": "Entrar no Misa.lol", "Sign in": "Entrar", "Create account": "Criar conta", "Email address": "Endereço de e-mail", "Password": "Senha", "Confirm password": "Confirmar senha"
  },
  "fr-FR": {
    "Account": "Compte", "Overview": "Vue d’ensemble", "Analytics": "Analyses", "Badges": "Badges", "Settings": "Paramètres", "Customize": "Personnaliser", "Links": "Liens", "Account overview": "Vue d’ensemble du compte", "Manage your Misa.lol profile and account.": "Gérez votre profil et votre compte Misa.lol.", "View live profile": "Voir le profil en direct", "Account statistics": "Statistiques du compte", "Manage your account": "Gérer votre compte", "Account Settings": "Paramètres du compte", "Connections": "Connexions", "Connected": "Connecté", "Not connected": "Non connecté", "Dashboard": "Tableau de bord", "Profile studio": "Studio du profil", "Customize your profile": "Personnalisez votre profil", "Save changes": "Enregistrer les modifications", "Saved": "Enregistré", "Reset": "Réinitialiser", "Live preview": "Aperçu en direct", "Updates instantly": "Mise à jour instantanée", "Assets": "Ressources", "General": "Général", "Colors": "Couleurs", "Effects": "Effets", "Upload": "Importer", "Replace": "Remplacer", "Remove": "Supprimer", "Description": "Description", "Location": "Lieu", "Language": "Langue", "English (United States)": "English (États-Unis)", "Español (España)": "Español (Espagne)", "Português (Brasil)": "Português (Brésil)", "Français (France)": "Français (France)", "Deutsch (Deutschland)": "Deutsch (Allemagne)", "Türkçe (Türkiye)": "Türkçe (Turquie)", "Your badges": "Vos badges", "Other badges": "Autres badges", "Owned": "Obtenu", "No badges assigned yet.": "Aucun badge attribué.", "Add social": "Ajouter un réseau", "Active links": "Liens actifs", "Hidden links": "Liens masqués", "Cancel": "Annuler", "Add link": "Ajouter un lien", "Search features...": "Rechercher des fonctions...", "Share Your Profile": "Partager votre profil", "Help Center": "Centre d’aide", "Log out": "Se déconnecter", "Loading your workspace…": "Chargement de votre espace…", "Not available yet": "Pas encore disponible", "No analytics data available.": "Aucune donnée analytique disponible.", "Coming soon": "Bientôt disponible", "Search": "Rechercher", "View": "Voir", "Active": "Actif", "Suspended": "Suspendu", "Delete": "Supprimer", "Create badge": "Créer un badge", "No users found.": "Aucun utilisateur trouvé.", "No reports.": "Aucun rapport.", "No audit records.": "Aucun journal d’audit.", "Sign in to Misa.lol": "Se connecter à Misa.lol", "Sign in": "Se connecter", "Create account": "Créer un compte", "Email address": "Adresse e-mail", "Password": "Mot de passe", "Confirm password": "Confirmer le mot de passe"
  },
  "de-DE": {
    "Account": "Konto", "Overview": "Übersicht", "Analytics": "Analysen", "Badges": "Abzeichen", "Settings": "Einstellungen", "Customize": "Anpassen", "Links": "Links", "Account overview": "Kontoübersicht", "Manage your Misa.lol profile and account.": "Verwalte dein Misa.lol-Profil und Konto.", "View live profile": "Live-Profil ansehen", "Account statistics": "Kontostatistiken", "Manage your account": "Konto verwalten", "Account Settings": "Kontoeinstellungen", "Connections": "Verbindungen", "Connected": "Verbunden", "Not connected": "Nicht verbunden", "Dashboard": "Dashboard", "Profile studio": "Profilstudio", "Customize your profile": "Profil anpassen", "Save changes": "Änderungen speichern", "Saved": "Gespeichert", "Reset": "Zurücksetzen", "Live preview": "Live-Vorschau", "Updates instantly": "Wird sofort aktualisiert", "Assets": "Ressourcen", "General": "Allgemein", "Colors": "Farben", "Effects": "Effekte", "Upload": "Hochladen", "Replace": "Ersetzen", "Remove": "Entfernen", "Description": "Beschreibung", "Location": "Ort", "Language": "Sprache", "English (United States)": "English (Vereinigte Staaten)", "Español (España)": "Español (Spanien)", "Português (Brasil)": "Português (Brasilien)", "Français (France)": "Français (Frankreich)", "Deutsch (Deutschland)": "Deutsch (Deutschland)", "Türkçe (Türkiye)": "Türkçe (Türkei)", "Your badges": "Deine Abzeichen", "Other badges": "Andere Abzeichen", "Owned": "Besitzt du", "No badges assigned yet.": "Noch keine Abzeichen zugewiesen.", "Add social": "Social hinzufügen", "Active links": "Aktive Links", "Hidden links": "Verborgene Links", "Cancel": "Abbrechen", "Add link": "Link hinzufügen", "Search features...": "Funktionen suchen...", "Share Your Profile": "Profil teilen", "Help Center": "Hilfezentrum", "Log out": "Abmelden", "Loading your workspace…": "Arbeitsbereich wird geladen…", "Not available yet": "Noch nicht verfügbar", "No analytics data available.": "Keine Analysedaten verfügbar.", "Coming soon": "Demnächst", "Search": "Suchen", "View": "Ansehen", "Active": "Aktiv", "Suspended": "Gesperrt", "Delete": "Löschen", "Create badge": "Abzeichen erstellen", "No users found.": "Keine Benutzer gefunden.", "No reports.": "Keine Meldungen.", "No audit records.": "Keine Prüfprotokolle.", "Sign in to Misa.lol": "Bei Misa.lol anmelden", "Sign in": "Anmelden", "Create account": "Konto erstellen", "Email address": "E-Mail-Adresse", "Password": "Passwort", "Confirm password": "Passwort bestätigen"
  },
  "tr-TR": {
    "Account": "Hesap", "Overview": "Genel bakış", "Analytics": "Analitik", "Badges": "Rozetler", "Settings": "Ayarlar", "Customize": "Özelleştir", "Links": "Bağlantılar", "Account overview": "Hesap genel bakışı", "Manage your Misa.lol profile and account.": "Misa.lol profilinizi ve hesabınızı yönetin.", "View live profile": "Canlı profili görüntüle", "Account statistics": "Hesap istatistikleri", "Manage your account": "Hesabınızı yönetin", "Account Settings": "Hesap ayarları", "Connections": "Bağlantılar", "Connected": "Bağlı", "Not connected": "Bağlı değil", "Dashboard": "Kontrol paneli", "Profile studio": "Profil stüdyosu", "Customize your profile": "Profilinizi özelleştirin", "Save changes": "Değişiklikleri kaydet", "Saved": "Kaydedildi", "Reset": "Sıfırla", "Live preview": "Canlı önizleme", "Updates instantly": "Anında güncellenir", "Assets": "Varlıklar", "General": "Genel", "Colors": "Renkler", "Effects": "Efektler", "Upload": "Yükle", "Replace": "Değiştir", "Remove": "Kaldır", "Description": "Açıklama", "Location": "Konum", "Language": "Dil", "English (United States)": "English (Amerika Birleşik Devletleri)", "Español (España)": "Español (İspanya)", "Português (Brasil)": "Português (Brezilya)", "Français (France)": "Français (Fransa)", "Deutsch (Deutschland)": "Deutsch (Almanya)", "Türkçe (Türkiye)": "Türkçe (Türkiye)", "Your badges": "Rozetleriniz", "Other badges": "Diğer rozetler", "Owned": "Sahip olunan", "No badges assigned yet.": "Henüz atanmış rozet yok.", "Add social": "Sosyal bağlantı ekle", "Active links": "Aktif bağlantılar", "Hidden links": "Gizli bağlantılar", "Cancel": "İptal", "Add link": "Bağlantı ekle", "Search features...": "Özelliklerde ara...", "Share Your Profile": "Profilini paylaş", "Help Center": "Yardım merkezi", "Log out": "Çıkış yap", "Loading your workspace…": "Çalışma alanınız yükleniyor…", "Not available yet": "Henüz mevcut değil", "No analytics data available.": "Analitik verisi yok.", "Coming soon": "Yakında", "Search": "Ara", "View": "Görüntüle", "Active": "Aktif", "Suspended": "Askıya alındı", "Delete": "Sil", "Create badge": "Rozet oluştur", "No users found.": "Kullanıcı bulunamadı.", "No reports.": "Rapor yok.", "No audit records.": "Denetim kaydı yok.", "Sign in to Misa.lol": "Misa.lol'a giriş yap", "Sign in": "Giriş yap", "Create account": "Hesap oluştur", "Email address": "E-posta adresi", "Password": "Şifre", "Confirm password": "Şifreyi onayla"
  },
};

function normalizeLocale(value: unknown): Locale {
  const legacy: Record<string, Locale> = { English: "en-US", Spanish: "es-ES", Portuguese: "pt-BR", French: "fr-FR", German: "de-DE", Turkish: "tr-TR" };
  const candidate = legacy[String(value)] || String(value || "");
  return (SUPPORTED_LOCALES as readonly string[]).includes(candidate) ? candidate as Locale : "en-US";
}

type LocaleContextValue = { locale: Locale; setLocale: (locale: string) => void; t: (value: string) => string };
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const { config, updateConfig, saveProfile } = useProfile();
  const { user } = useAuth();
  const [locale, setLocaleState] = useState<Locale>(() => normalizeLocale(config.settings.language));

  useEffect(() => {
    const next = normalizeLocale(config.settings.language);
    setLocaleState((current) => current === next ? current : next);
    document.documentElement.lang = next.split("-")[0];
  }, [config.settings.language]);

  const setLocale = useCallback((value: string) => {
    const nextLocale = normalizeLocale(value);
    setLocaleState(nextLocale);
    const nextConfig = { ...config, settings: { ...config.settings, language: nextLocale } };
    updateConfig(() => nextConfig);
    if (user) void saveProfile(nextConfig);
  }, [config, saveProfile, updateConfig, user]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    setLocale,
    t: (key) => translations[locale][key] || key,
  }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}><TranslatedTree>{children}</TranslatedTree></LocaleContext.Provider>;
}

export function useI18n() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useI18n must be used inside LocaleProvider");
  return value;
}

export function TranslatedTree({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return <>{translateChildren(children, t)}</>;
}

function translateChildren(children: React.ReactNode, t: (value: string) => string): React.ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string") return t(child);
    if (!isValidElement(child)) return child;
    const type = typeof child.type === "string" ? child.type : "";
    if (["script", "style", "pre", "code", "textarea"].includes(type)) return child;
    const props = child.props as Record<string, unknown>;
    const translatedProps: Record<string, unknown> = {};
    for (const key of ["aria-label", "title", "placeholder"]) {
      if (typeof props[key] === "string") translatedProps[key] = t(props[key]);
    }
    if (Array.isArray(props.options)) translatedProps.options = props.options.map((option: unknown) => typeof option === "string" ? t(option) : option);
    const translatedChildren = translateChildren(props.children as React.ReactNode, t);
    return cloneElement(child, translatedProps, translatedChildren);
  });
}
