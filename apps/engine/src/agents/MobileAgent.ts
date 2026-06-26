import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  BriefAnalysis,
  CompetitorReport,
  DesignSystem,
  GeneratedFile,
} from '@genesis/shared';
import { streamCode } from '../llm';

// ─── Public contract ────────────────────────────────────────────────

export interface MobileResult {
  /** Absolute path of the generated Expo project: /tmp/genesis/<siteId>/mobile */
  path: string;
  /** Relative paths of every generated file. */
  files: string[];
  /** Path relative to mobile/, plus the file content. */
  generatedFiles: GeneratedFile[];
  ready: boolean;
}

export interface MobileInput {
  siteId: string;
  analysis: BriefAnalysis;
  design: DesignSystem;
  competitors: CompetitorReport;
  language?: { code: string; name: string; rtl: boolean };
}

interface Lang {
  code: string;
  name: string;
  rtl: boolean;
}

interface FileDescriptor {
  path: string;
  kind: 'static' | 'ai';
  /** Deterministic generator (kind === 'static'). */
  make?: () => string;
  /** AI prompt + a guaranteed-valid deterministic fallback (kind === 'ai'). */
  ai?: { user: string; maxTokens?: number; fallback: () => string };
}

/**
 * Generate a complete React Native (Expo Router, SDK 51) mobile app from the
 * same brief as the website, sharing the site's visual identity through the
 * DesignSystem (the palette/fonts land in constants/Colors.ts).
 *
 * Infrastructure/config files and the design-bearing theme primitives are
 * produced deterministically (guaranteed valid — never let an LLM hallucinate
 * your app.json or your color tokens). Only the three real screens are AI
 * generated, and each AI call is wrapped so a single failure falls back to a
 * minimal valid screen — the app always builds.
 */
export async function runMobile(input: MobileInput): Promise<MobileResult> {
  const root = join('/tmp', 'genesis', input.siteId, 'mobile');
  const lang: Lang = input.language ?? {
    code: input.analysis.location.locale,
    name: 'the local language of the client',
    rtl: false,
  };

  const descriptors = buildPlan(input, lang);
  const generatedFiles: GeneratedFile[] = [];

  for (const d of descriptors) {
    let content: string;
    if (d.kind === 'static' && d.make) {
      content = d.make();
    } else if (d.ai) {
      // Never throw on a single AI file: fall back to a valid deterministic
      // screen so the whole project always compiles and builds.
      try {
        const raw = await streamCode({
          system: aiSystem(input, lang),
          user: d.ai.user,
          maxTokens: d.ai.maxTokens ?? 6000,
          label: 'mobile:' + d.path,
        });
        content = stripFences(raw);
        if (!content) content = d.ai.fallback();
      } catch {
        content = d.ai.fallback();
      }
    } else {
      content = '';
    }

    const abs = join(root, d.path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, content, 'utf8');
    generatedFiles.push({ path: d.path, content });
  }

  return {
    path: root,
    files: descriptors.map((d) => d.path),
    generatedFiles,
    ready: true,
  };
}

// ─── File plan ──────────────────────────────────────────────────────

function buildPlan(input: MobileInput, lang: Lang): FileDescriptor[] {
  const { analysis, design } = input;
  const files: FileDescriptor[] = [];

  // ── deterministic infra / config (guaranteed valid) ──
  files.push({ path: 'package.json', kind: 'static', make: () => pkgJson(input) });
  files.push({ path: 'app.json', kind: 'static', make: () => appJson(input) });
  files.push({ path: 'eas.json', kind: 'static', make: easJson });
  files.push({ path: 'tsconfig.json', kind: 'static', make: tsConfig });
  files.push({ path: 'babel.config.js', kind: 'static', make: babelConfig });
  files.push({ path: '.env.example', kind: 'static', make: envExample });

  // ── design-bearing theme primitives (this is what makes each app unique) ──
  files.push({ path: 'constants/Colors.ts', kind: 'static', make: () => colorsTs(design) });
  files.push({ path: 'hooks/useColorScheme.ts', kind: 'static', make: useColorScheme });
  files.push({ path: 'hooks/useThemeColor.ts', kind: 'static', make: useThemeColor });
  files.push({ path: 'hooks/usePushNotifications.ts', kind: 'static', make: usePushNotifications });
  files.push({ path: 'lib/api.ts', kind: 'static', make: () => apiLib(input) });
  files.push({ path: 'components/ThemedText.tsx', kind: 'static', make: themedText });
  files.push({ path: 'components/ThemedView.tsx', kind: 'static', make: themedView });
  files.push({ path: 'app/_layout.tsx', kind: 'static', make: () => rootLayout(lang) });
  files.push({ path: 'app/(tabs)/_layout.tsx', kind: 'static', make: () => tabsLayout(lang) });
  files.push({ path: 'README.md', kind: 'static', make: () => readme(input) });

  // ── AI-generated screens (real, sector-specific, in the client's language) ──
  files.push({
    path: 'app/(tabs)/index.tsx',
    kind: 'ai',
    ai: {
      maxTokens: 6000,
      user:
        `Generate app/(tabs)/index.tsx — the HOME screen of the mobile app for ` +
        `${analysis.businessName} (${analysis.sector}). A native scrollable screen with: ` +
        `a hero block (business name as the headline, the value proposition "${analysis.valueProposition}" ` +
        `as the subtitle), one primary call-to-action button using Colors.light.primary (or the active scheme) ` +
        `as its background and the brand radius, and a short list of 3 highlights drawn from these features: ` +
        `${analysis.features.join(', ')}. Use a SafeAreaView or top padding, ScrollView, and the brand spacing. ` +
        `All visible copy in ${lang.name}.`,
      fallback: () => screenFallback('index', analysis, lang),
    },
  });
  files.push({
    path: 'app/(tabs)/explore.tsx',
    kind: 'ai',
    ai: {
      maxTokens: 6000,
      user:
        `Generate app/(tabs)/explore.tsx — the CATALOGUE screen for ${analysis.businessName} ` +
        `(${analysis.sector}). Render a native list (FlatList) of the ${sectorNoun(analysis.type)} ` +
        `the business offers, derived from: ${analysis.features.join(', ')}. Each row is a card using ` +
        `ThemedView with the brand surface color, the brand radius, a title (ThemedText type="defaultSemiBold"), ` +
        `a one-line description, and a chevron/affordance. Add a screen title at the top. ` +
        `All visible copy in ${lang.name}.`,
      fallback: () => screenFallback('explore', analysis, lang),
    },
  });
  files.push({
    path: 'app/(tabs)/account.tsx',
    kind: 'ai',
    ai: {
      maxTokens: 6000,
      user:
        `Generate app/(tabs)/account.tsx — the ACCOUNT / profile screen for ${analysis.businessName}. ` +
        `A native settings screen with: a profile header, a "Notifications" row with a working React Native ` +
        `<Switch/> (local useState; when enabled call usePushNotifications() from '@/hooks/usePushNotifications' ` +
        `to register), a "Contact us" row, an "About" row, and an app version footer. Use ThemedView rows ` +
        `with the brand surface color, the brand radius, and separators in the border color. ` +
        `All visible copy in ${lang.name}.`,
      fallback: () => accountFallback(analysis, lang),
    },
  });

  return files;
}

// ─── Shared AI system prompt ────────────────────────────────────────

function aiSystem(input: MobileInput, lang: Lang): string {
  const { analysis, competitors, design } = input;
  return [
    'You are an elite React Native + Expo Router (SDK 51, expo-router v3) + TypeScript engineer.',
    'Output ONLY the raw file content — no markdown fences, no commentary, no explanation.',
    'The code must be production-ready: zero placeholders, zero TODO, no lorem ipsum.',
    '',
    `Write ALL human-visible text in: ${lang.name} (${lang.code}).` +
      (lang.rtl ? ' The UI direction is RTL — set writingDirection/textAlign accordingly.' : ''),
    '',
    'MANDATORY conventions:',
    "- import { Colors } from '@/constants/Colors';",
    "- import { useColorScheme } from '@/hooks/useColorScheme';",
    "- import { ThemedText } from '@/components/ThemedText';",
    "- import { ThemedView } from '@/components/ThemedView';",
    '- Read the active scheme: const scheme = useColorScheme() ?? "light"; const c = Colors[scheme];',
    '- Use c.primary / c.secondary / c.accent / c.background / c.surface / c.text / c.muted / c.border.',
    '- Use Colors.radius for borderRadius and Colors.fonts.heading / Colors.fonts.body for fontFamily.',
    '- Build with StyleSheet.create. Mobile-native UX (touch targets >= 44px, ScrollView/FlatList, SafeArea).',
    '- The file is a default-exported React function component, fully typed.',
    '',
    `Business: ${analysis.businessName} — ${analysis.valueProposition}.`,
    `Sector: ${analysis.sector}. Audience: ${analysis.audience}. Tone: ${analysis.tone}.`,
    `Differentiate via: ${competitors.positioning}.`,
    `Brand colors — primary ${design.palette.primary}, secondary ${design.palette.secondary}, accent ${design.palette.accent}.`,
    `Brand radius ${design.radius}. Heading font ${design.fonts.heading}, body font ${design.fonts.body}.`,
  ].join('\n');
}

// ─── Deterministic generators: config ───────────────────────────────

function slug(input: MobileInput): string {
  const base = input.analysis.businessName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'genesis-app-' + input.siteId.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20);
}

function bundleId(input: MobileInput): string {
  const seg = slug(input).replace(/-/g, '');
  return 'com.genesis.' + (seg || 'app');
}

function pkgJson(input: MobileInput): string {
  const pkg = {
    name: slug(input),
    version: '1.0.0',
    private: true,
    main: 'expo-router/entry',
    scripts: {
      start: 'expo start',
      android: 'expo start --android',
      ios: 'expo start --ios',
      web: 'expo start --web',
      build: 'eas build',
      'build:android': 'eas build --platform android',
      'build:ios': 'eas build --platform ios',
    },
    dependencies: {
      expo: '~51.0.0',
      'expo-router': '~3.5.0',
      'expo-constants': '~16.0.0',
      'expo-linking': '~6.3.0',
      'expo-notifications': '~0.28.0',
      'expo-device': '~6.0.0',
      'expo-status-bar': '~1.12.0',
      'expo-splash-screen': '~0.27.0',
      'expo-system-ui': '~3.0.0',
      react: '18.2.0',
      'react-dom': '18.2.0',
      'react-native': '0.74.5',
      'react-native-safe-area-context': '4.10.5',
      'react-native-screens': '3.31.1',
      'react-native-web': '~0.19.10',
      '@react-navigation/native': '^6.0.2',
      '@react-navigation/bottom-tabs': '^6.5.20',
      '@expo/vector-icons': '^14.0.0',
    },
    devDependencies: {
      '@babel/core': '^7.24.0',
      '@types/react': '~18.2.79',
      typescript: '~5.3.3',
    },
  };
  return JSON.stringify(pkg, null, 2) + '\n';
}

function appJson(input: MobileInput): string {
  const name = input.analysis.businessName;
  const cfg = {
    expo: {
      name,
      slug: slug(input),
      version: '1.0.0',
      orientation: 'portrait',
      icon: './assets/icon.png',
      scheme: slug(input).replace(/-/g, ''),
      userInterfaceStyle: 'automatic',
      splash: {
        image: './assets/splash.png',
        resizeMode: 'contain',
        backgroundColor: input.design.palette.background,
      },
      ios: {
        supportsTablet: true,
        bundleIdentifier: bundleId(input),
      },
      android: {
        package: bundleId(input),
        adaptiveIcon: {
          foregroundImage: './assets/adaptive-icon.png',
          backgroundColor: input.design.palette.background,
        },
      },
      web: {
        bundler: 'metro',
        output: 'static',
        favicon: './assets/favicon.png',
      },
      plugins: [
        'expo-router',
        [
          'expo-notifications',
          {
            color: input.design.palette.primary,
          },
        ],
      ],
      experiments: {
        typedRoutes: true,
      },
    },
  };
  return JSON.stringify(cfg, null, 2) + '\n';
}

function easJson(): string {
  const cfg = {
    cli: {
      version: '>= 5.9.0',
      appVersionSource: 'remote',
    },
    build: {
      development: {
        developmentClient: true,
        distribution: 'internal',
      },
      preview: {
        distribution: 'internal',
        android: { buildType: 'apk' },
      },
      production: {
        autoIncrement: true,
      },
    },
    submit: {
      production: {},
    },
  };
  return JSON.stringify(cfg, null, 2) + '\n';
}

function tsConfig(): string {
  const cfg = {
    extends: 'expo/tsconfig.base',
    compilerOptions: {
      strict: true,
      paths: {
        '@/*': ['./*'],
      },
    },
    include: ['**/*.ts', '**/*.tsx', '.expo/types/**/*.ts', 'expo-env.d.ts'],
  };
  return JSON.stringify(cfg, null, 2) + '\n';
}

function babelConfig(): string {
  return [
    'module.exports = function (api) {',
    '  api.cache(true);',
    '  return {',
    "    presets: ['babel-preset-expo'],",
    "    plugins: ['expo-router/babel'],",
    '  };',
    '};',
    '',
  ].join('\n');
}

function envExample(): string {
  return [
    '# Mobile app generated by GENESIS',
    '# Points the app at the deployed website API (reuses the site assistant).',
    'EXPO_PUBLIC_API_URL=http://localhost:3000',
    '',
  ].join('\n');
}

// ─── Deterministic generators: theme primitives ─────────────────────

/**
 * The CLIENT'S unique palette, derived directly from input.design. This is the
 * single source of truth that makes each generated app visually unique and
 * consistent with the website. Light + dark schemes, brand radius and fonts.
 */
function colorsTs(d: DesignSystem): string {
  const p = d.palette;
  const light = {
    text: p.text,
    background: p.background,
    surface: p.surface,
    primary: p.primary,
    secondary: p.secondary,
    accent: p.accent,
    muted: p.muted,
    border: p.border,
    tint: p.primary,
    icon: p.muted,
    tabIconDefault: p.muted,
    tabIconSelected: p.primary,
  };
  // Dark scheme: swap the neutral ground for the brand's dark surface while
  // keeping the brand hues (primary/secondary/accent) identical to the site.
  const dark = {
    text: p.background,
    background: p.text,
    surface: p.text,
    primary: p.primary,
    secondary: p.secondary,
    accent: p.accent,
    muted: p.muted,
    border: p.muted,
    tint: p.primary,
    icon: p.muted,
    tabIconDefault: p.muted,
    tabIconSelected: p.primary,
  };
  return [
    '// Brand identity for this app — derived deterministically from the GENESIS',
    '// DesignSystem so the mobile app matches the website exactly. DO NOT edit by hand.',
    '',
    'export const Colors = {',
    '  light: ' + JSON.stringify(light, null, 4).replace(/\n/g, '\n  ') + ',',
    '  dark: ' + JSON.stringify(dark, null, 4).replace(/\n/g, '\n  ') + ',',
    '  radius: ' + JSON.stringify(parseRadius(d.radius)) + ',',
    '  gradient: ' + JSON.stringify([p.primary, p.secondary]) + ',',
    '  fonts: {',
    '    heading: ' + JSON.stringify(d.fonts.heading) + ',',
    '    body: ' + JSON.stringify(d.fonts.body) + ',',
    '    mono: ' + JSON.stringify(d.fonts.mono) + ',',
    '  },',
    '} as const;',
    '',
    'export type ColorScheme = keyof Omit<typeof Colors, ' +
      "'radius' | 'gradient' | 'fonts'>;",
    'export type ThemeColorName = keyof typeof Colors.light;',
    '',
  ].join('\n');
}

/** React Native styles want a number for borderRadius — coerce "12px"/"1rem". */
function parseRadius(radius: string): number {
  const m = radius.match(/([\d.]+)\s*(px|rem|em)?/);
  if (!m) return 12;
  const n = Number(m[1]);
  if (Number.isNaN(n)) return 12;
  if (m[2] === 'rem' || m[2] === 'em') return Math.round(n * 16);
  return Math.round(n);
}

function useColorScheme(): string {
  return [
    "// Re-export RN's useColorScheme so screens import from a stable app path.",
    "export { useColorScheme } from 'react-native';",
    '',
  ].join('\n');
}

function useThemeColor(): string {
  return [
    "import { useColorScheme } from '@/hooks/useColorScheme';",
    "import { Colors, type ThemeColorName } from '@/constants/Colors';",
    '',
    'export function useThemeColor(',
    '  props: { light?: string; dark?: string },',
    '  colorName: ThemeColorName,',
    '): string {',
    "  const theme = useColorScheme() ?? 'light';",
    '  const fromProps = props[theme];',
    '  if (fromProps) return fromProps;',
    '  return Colors[theme][colorName];',
    '}',
    '',
  ].join('\n');
}

function usePushNotifications(): string {
  return [
    "import { useEffect, useState } from 'react';",
    "import { Platform } from 'react-native';",
    "import * as Device from 'expo-device';",
    "import * as Notifications from 'expo-notifications';",
    "import Constants from 'expo-constants';",
    '',
    'Notifications.setNotificationHandler({',
    '  handleNotification: async () => ({',
    '    shouldShowAlert: true,',
    '    shouldPlaySound: true,',
    '    shouldSetBadge: false,',
    '  }),',
    '});',
    '',
    '/**',
    ' * Register for Expo push notifications. Fully guarded: it never throws —',
    ' * on simulators, denied permission, or any error it resolves to null.',
    ' */',
    'export async function registerForPushNotificationsAsync(): Promise<string | null> {',
    '  try {',
    "    if (Platform.OS === 'android') {",
    "      await Notifications.setNotificationChannelAsync('default', {",
    "        name: 'default',",
    '        importance: Notifications.AndroidImportance.DEFAULT,',
    '      });',
    '    }',
    '    if (!Device.isDevice) return null;',
    '    const existing = await Notifications.getPermissionsAsync();',
    '    let status = existing.status;',
    "    if (status !== 'granted') {",
    '      const req = await Notifications.requestPermissionsAsync();',
    '      status = req.status;',
    '    }',
    "    if (status !== 'granted') return null;",
    '    const projectId =',
    '      Constants.expoConfig?.extra?.eas?.projectId ??',
    '      Constants.easConfig?.projectId;',
    '    const token = await Notifications.getExpoPushTokenAsync(',
    '      projectId ? { projectId } : undefined,',
    '    );',
    '    return token.data;',
    '  } catch {',
    '    return null;',
    '  }',
    '}',
    '',
    '/** Hook wrapper: registers on mount and exposes the token (or null). */',
    'export function usePushNotifications(): { expoPushToken: string | null } {',
    '  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);',
    '  useEffect(() => {',
    '    let active = true;',
    '    registerForPushNotificationsAsync().then((t) => {',
    '      if (active) setExpoPushToken(t);',
    '    });',
    '    return () => {',
    '      active = false;',
    '    };',
    '  }, []);',
    '  return { expoPushToken };',
    '}',
    '',
  ].join('\n');
}

function apiLib(input: MobileInput): string {
  const ctx = input.analysis.businessName + ' — ' + input.analysis.valueProposition;
  return [
    '// Talks to the GENESIS website API (set EXPO_PUBLIC_API_URL to the deployed site).',
    "import Constants from 'expo-constants';",
    '',
    'const API_URL =',
    '  process.env.EXPO_PUBLIC_API_URL ??',
    '  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??',
    "  'http://localhost:3000';",
    '',
    'export const BUSINESS_CONTEXT = ' + JSON.stringify(ctx) + ';',
    '',
    "export type ChatMessage = { role: 'user' | 'assistant'; content: string };",
    '',
    'export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {',
    "  const url = API_URL.replace(/\\/$/, '') + path;",
    '  const res = await fetch(url, {',
    '    ...init,',
    "    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },",
    '  });',
    '  if (!res.ok) {',
    "    throw new Error('Request failed (' + res.status + '): ' + path);",
    '  }',
    '  return (await res.json()) as T;',
    '}',
    '',
    '/** Reuse the website assistant: POST /api/chat. Returns the assistant reply. */',
    'export async function chat(messages: ChatMessage[]): Promise<string> {',
    '  try {',
    "    const data = await apiFetch<{ reply: string }>('/api/chat', {",
    "      method: 'POST',",
    '      body: JSON.stringify({ messages }),',
    '    });',
    "    return data.reply ?? '';",
    '  } catch {',
    "    return '';",
    '  }',
    '}',
    '',
  ].join('\n');
}

function themedText(): string {
  return [
    "import { Text, type TextProps, StyleSheet } from 'react-native';",
    "import { useThemeColor } from '@/hooks/useThemeColor';",
    "import { Colors } from '@/constants/Colors';",
    '',
    'export type ThemedTextProps = TextProps & {',
    '  lightColor?: string;',
    '  darkColor?: string;',
    "  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'muted';",
    '};',
    '',
    'export function ThemedText({',
    '  style,',
    '  lightColor,',
    '  darkColor,',
    "  type = 'default',",
    '  ...rest',
    '}: ThemedTextProps) {',
    "  const colorName = type === 'muted' ? 'muted' : 'text';",
    '  const color = useThemeColor({ light: lightColor, dark: darkColor }, colorName);',
    '  return (',
    '    <Text',
    '      style={[',
    '        { color },',
    "        type === 'default' ? styles.default : undefined,",
    "        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,",
    "        type === 'title' ? styles.title : undefined,",
    "        type === 'subtitle' ? styles.subtitle : undefined,",
    "        type === 'muted' ? styles.default : undefined,",
    '        style,',
    '      ]}',
    '      {...rest}',
    '    />',
    '  );',
    '}',
    '',
    'const styles = StyleSheet.create({',
    '  default: { fontSize: 16, lineHeight: 24, fontFamily: Colors.fonts.body },',
    '  defaultSemiBold: { fontSize: 16, lineHeight: 24, fontWeight: \'600\', fontFamily: Colors.fonts.body },',
    '  title: { fontSize: 30, lineHeight: 34, fontWeight: \'700\', fontFamily: Colors.fonts.heading },',
    '  subtitle: { fontSize: 20, lineHeight: 26, fontWeight: \'600\', fontFamily: Colors.fonts.heading },',
    '});',
    '',
  ].join('\n');
}

function themedView(): string {
  return [
    "import { View, type ViewProps } from 'react-native';",
    "import { useThemeColor } from '@/hooks/useThemeColor';",
    "import { type ThemeColorName } from '@/constants/Colors';",
    '',
    'export type ThemedViewProps = ViewProps & {',
    '  lightColor?: string;',
    '  darkColor?: string;',
    '  colorName?: ThemeColorName;',
    '};',
    '',
    'export function ThemedView({',
    '  style,',
    '  lightColor,',
    '  darkColor,',
    "  colorName = 'background',",
    '  ...rest',
    '}: ThemedViewProps) {',
    '  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, colorName);',
    '  return <View style={[{ backgroundColor }, style]} {...rest} />;',
    '}',
    '',
  ].join('\n');
}

function rootLayout(lang: Lang): string {
  return [
    "import { useEffect } from 'react';",
    "import { Stack } from 'expo-router';",
    "import { StatusBar } from 'expo-status-bar';",
    "import { I18nManager } from 'react-native';",
    "import { SafeAreaProvider } from 'react-native-safe-area-context';",
    "import { useColorScheme } from '@/hooks/useColorScheme';",
    "import { Colors } from '@/constants/Colors';",
    "import { registerForPushNotificationsAsync } from '@/hooks/usePushNotifications';",
    '',
    lang.rtl
      ? 'try { I18nManager.allowRTL(true); I18nManager.forceRTL(true); } catch {}'
      : 'try { I18nManager.allowRTL(false); } catch {}',
    '',
    'export default function RootLayout() {',
    "  const scheme = useColorScheme() ?? 'light';",
    '  const theme = Colors[scheme];',
    '',
    '  useEffect(() => {',
    '    // Best-effort push registration on launch; never throws.',
    '    registerForPushNotificationsAsync().catch(() => undefined);',
    '  }, []);',
    '',
    '  return (',
    '    <SafeAreaProvider>',
    '      <Stack',
    '        screenOptions={{',
    '          headerStyle: { backgroundColor: theme.background },',
    '          headerTintColor: theme.text,',
    '          contentStyle: { backgroundColor: theme.background },',
    '        }}',
    '      >',
    '        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />',
    '      </Stack>',
    "      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />",
    '    </SafeAreaProvider>',
    '  );',
    '}',
    '',
  ].join('\n');
}

function tabsLayout(lang: Lang): string {
  const labels = lang.rtl
    ? { home: 'الرئيسية', explore: 'استكشاف', account: 'الحساب' }
    : { home: 'Home', explore: 'Explore', account: 'Account' };
  return [
    "import { Tabs } from 'expo-router';",
    "import { Ionicons } from '@expo/vector-icons';",
    "import { useColorScheme } from '@/hooks/useColorScheme';",
    "import { Colors } from '@/constants/Colors';",
    '',
    'export default function TabsLayout() {',
    "  const scheme = useColorScheme() ?? 'light';",
    '  const theme = Colors[scheme];',
    '  return (',
    '    <Tabs',
    '      screenOptions={{',
    '        tabBarActiveTintColor: theme.primary,',
    '        tabBarInactiveTintColor: theme.tabIconDefault,',
    '        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },',
    '        headerStyle: { backgroundColor: theme.background },',
    '        headerTintColor: theme.text,',
    '      }}',
    '    >',
    '      <Tabs.Screen',
    '        name="index"',
    '        options={{',
    '          title: ' + JSON.stringify(labels.home) + ',',
    '          tabBarIcon: ({ color, size }) => (',
    '            <Ionicons name="home-outline" size={size} color={color} />',
    '          ),',
    '        }}',
    '      />',
    '      <Tabs.Screen',
    '        name="explore"',
    '        options={{',
    '          title: ' + JSON.stringify(labels.explore) + ',',
    '          tabBarIcon: ({ color, size }) => (',
    '            <Ionicons name="compass-outline" size={size} color={color} />',
    '          ),',
    '        }}',
    '      />',
    '      <Tabs.Screen',
    '        name="account"',
    '        options={{',
    '          title: ' + JSON.stringify(labels.account) + ',',
    '          tabBarIcon: ({ color, size }) => (',
    '            <Ionicons name="person-outline" size={size} color={color} />',
    '          ),',
    '        }}',
    '      />',
    '    </Tabs>',
    '  );',
    '}',
    '',
  ].join('\n');
}

function readme(input: MobileInput): string {
  return [
    '# ' + input.analysis.businessName + ' — Mobile app',
    '',
    'React Native (Expo Router, SDK 51) app generated by **GENESIS**, sharing the',
    "website's visual identity (see `constants/Colors.ts`).",
    '',
    '## Run',
    '',
    '```bash',
    'cp .env.example .env   # set EXPO_PUBLIC_API_URL to your deployed website',
    'npm install',
    'npm run start          # then press i (iOS) / a (Android)',
    '```',
    '',
    '## Build (EAS)',
    '',
    '```bash',
    'npx eas build --profile preview      # internal test build',
    'npx eas build --profile production   # store-ready build',
    '```',
    '',
  ].join('\n');
}

// ─── AI fallbacks (minimal valid screens) ───────────────────────────

function sectorNoun(type: BriefAnalysis['type']): string {
  switch (type) {
    case 'ecommerce':
      return 'products';
    case 'restaurant':
      return 'menu items';
    case 'salon':
    case 'booking':
      return 'services';
    case 'portfolio':
      return 'projects';
    case 'blog':
      return 'articles';
    default:
      return 'offers';
  }
}

function screenFallback(which: 'index' | 'explore', a: BriefAnalysis, lang: Lang): string {
  const isHome = which === 'index';
  const title = isHome ? a.businessName : sectorNoun(a.type);
  const items = (a.features.length ? a.features : [a.valueProposition]).slice(0, 6);
  return [
    "import { ScrollView, StyleSheet, View } from 'react-native';",
    "import { SafeAreaView } from 'react-native-safe-area-context';",
    "import { ThemedText } from '@/components/ThemedText';",
    "import { ThemedView } from '@/components/ThemedView';",
    "import { useColorScheme } from '@/hooks/useColorScheme';",
    "import { Colors } from '@/constants/Colors';",
    '',
    'const ITEMS = ' + JSON.stringify(items) + ';',
    '',
    'export default function Screen() {',
    "  const scheme = useColorScheme() ?? 'light';",
    '  const c = Colors[scheme];',
    "  return (",
    "    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>",
    '      <ScrollView contentContainerStyle={styles.content}>',
    '        <ThemedText type="title">' + escapeText(title) + '</ThemedText>',
    isHome
      ? '        <ThemedText type="muted" style={styles.gap}>' + escapeText(a.valueProposition) + '</ThemedText>'
      : '        <ThemedText type="muted" style={styles.gap}>' + escapeText(a.businessName) + '</ThemedText>',
    '        {ITEMS.map((item, i) => (',
    '          <ThemedView',
    '            key={i}',
    '            colorName="surface"',
    '            style={[styles.card, { borderRadius: Colors.radius, borderColor: c.border }]}',
    '          >',
    '            <ThemedText type="defaultSemiBold">{item}</ThemedText>',
    '          </ThemedView>',
    '        ))}',
    isHome
      ? '        <View style={[styles.cta, { backgroundColor: c.primary, borderRadius: Colors.radius }]}>\n          <ThemedText style={styles.ctaText} lightColor="#fff" darkColor="#fff">' +
        escapeText(callToAction(lang)) +
        '</ThemedText>\n        </View>'
      : '',
    '      </ScrollView>',
    '    </SafeAreaView>',
    '  );',
    '}',
    '',
    'const styles = StyleSheet.create({',
    '  safe: { flex: 1 },',
    '  content: { padding: 20, gap: 12 },',
    '  gap: { marginBottom: 8 },',
    '  card: { padding: 16, borderWidth: 1 },',
    '  cta: { marginTop: 16, paddingVertical: 16, alignItems: \'center\' },',
    '  ctaText: { fontSize: 16, fontWeight: \'700\' },',
    '});',
    '',
  ]
    .filter((l) => l !== '')
    .join('\n');
}

function accountFallback(a: BriefAnalysis, lang: Lang): string {
  const t = lang.rtl
    ? { account: 'الحساب', notif: 'الإشعارات', contact: 'اتصل بنا', about: 'حول' }
    : { account: 'Account', notif: 'Notifications', contact: 'Contact us', about: 'About' };
  return [
    "import { useState } from 'react';",
    "import { StyleSheet, Switch, View } from 'react-native';",
    "import { SafeAreaView } from 'react-native-safe-area-context';",
    "import { ThemedText } from '@/components/ThemedText';",
    "import { ThemedView } from '@/components/ThemedView';",
    "import { useColorScheme } from '@/hooks/useColorScheme';",
    "import { Colors } from '@/constants/Colors';",
    "import { registerForPushNotificationsAsync } from '@/hooks/usePushNotifications';",
    '',
    'export default function AccountScreen() {',
    "  const scheme = useColorScheme() ?? 'light';",
    '  const c = Colors[scheme];',
    '  const [notif, setNotif] = useState(false);',
    '',
    '  async function onToggleNotif(value: boolean) {',
    '    setNotif(value);',
    '    if (value) {',
    '      const token = await registerForPushNotificationsAsync();',
    '      if (!token) setNotif(false);',
    '    }',
    '  }',
    '',
    '  return (',
    "    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>",
    '      <View style={styles.content}>',
    '        <ThemedText type="title">' + escapeText(t.account) + '</ThemedText>',
    '        <ThemedText type="defaultSemiBold" style={styles.name}>' + escapeText(a.businessName) + '</ThemedText>',
    '        <ThemedView colorName="surface" style={[styles.row, { borderRadius: Colors.radius, borderColor: c.border }]}>',
    '          <ThemedText>' + escapeText(t.notif) + '</ThemedText>',
    '          <Switch value={notif} onValueChange={onToggleNotif} trackColor={{ true: c.primary }} />',
    '        </ThemedView>',
    '        <ThemedView colorName="surface" style={[styles.row, { borderRadius: Colors.radius, borderColor: c.border }]}>',
    '          <ThemedText>' + escapeText(t.contact) + '</ThemedText>',
    '        </ThemedView>',
    '        <ThemedView colorName="surface" style={[styles.row, { borderRadius: Colors.radius, borderColor: c.border }]}>',
    '          <ThemedText>' + escapeText(t.about) + '</ThemedText>',
    '        </ThemedView>',
    '        <ThemedText type="muted" style={styles.version}>v1.0.0</ThemedText>',
    '      </View>',
    '    </SafeAreaView>',
    '  );',
    '}',
    '',
    'const styles = StyleSheet.create({',
    '  safe: { flex: 1 },',
    '  content: { padding: 20, gap: 12 },',
    '  name: { marginBottom: 8 },',
    '  row: {',
    "    flexDirection: 'row',",
    "    justifyContent: 'space-between',",
    "    alignItems: 'center',",
    '    padding: 16,',
    '    borderWidth: 1,',
    '  },',
    "  version: { marginTop: 16, textAlign: 'center' },",
    '});',
    '',
  ].join('\n');
}

function callToAction(lang: Lang): string {
  return lang.rtl ? 'ابدأ الآن' : 'Get started';
}

/** Escape a string for safe embedding inside JSX text. */
function escapeText(s: string): string {
  return s.replace(/[<>{}]/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripFences(text: string): string {
  return text
    .replace(/^\s*```[a-zA-Z]*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim();
}
