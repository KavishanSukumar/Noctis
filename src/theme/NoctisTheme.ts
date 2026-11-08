import { StyleSheet, TextStyle, ViewStyle, Platform, StatusBar, Dimensions } from 'react-native';

export class ResponsiveMetrics {
  public width: number = 0;
  public height: number = 0;
  public deviceTier: 'compact' | 'phone' | 'foldable' | 'tablet' = 'phone';
  public isFoldableOrTablet: boolean = false;
  public isLandscape: boolean = false;
  public maxContainerWidth: number = 600;
  public horizontalPadding: number = 16;
  public noteGridColumns: number = 1;
  public connectionColumns: number = 2;
  public safeTopInset: number = 0;
  public safeBottomInset: number = 12;

  constructor(init?: Partial<ResponsiveMetrics>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class ColorPaletteDefinition {
  public id: string = '';
  public name: string = '';
  public isDark: boolean = true;
  public background: string = '';
  public surface: string = '';
  public surfaceElevated: string = '';
  public border: string = '';
  public accent: string = '';
  public accentMuted: string = '';
  public accentContrast: string = '#0B0B0E';
  public textPrimary: string = '';
  public textSecondary: string = '';
  public textMuted: string = '';
  public success: string = '#4ADE80';
  public danger: string = '#F87171';
  public warning: string = '#FBBF24';
  public tint: string = '';
  public cardBackground: string = '';
  public cardBorder: string = '';
  public divider: string = '';
  public frostOverlay: string = '';
  public calloutBg: string = '';
  public glassSurface: string = '';
  public glassElevated: string = '';
  public glassBorder: string = '';
  public glassHighlight: string = '';
  public blurTint: 'dark' | 'light' = 'dark';
  public blurIntensity: number = 65;

  constructor(init?: Partial<ColorPaletteDefinition>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class NoctisTheme {
  public static readonly PALETTES: Record<string, ColorPaletteDefinition> = {
    obsidian_gold: new ColorPaletteDefinition({
      id: 'obsidian_gold',
      name: 'Obsidian Gold',
      isDark: true,
      background: '#13151B',
      surface: '#1A1D24',
      surfaceElevated: '#222631',
      border: 'rgba(255, 255, 255, 0.08)',
      accent: '#E2A154',
      accentMuted: '#5C3E1B',
      accentContrast: '#111318',
      textPrimary: '#EAE6DF',
      textSecondary: '#A39E93',
      textMuted: '#A5A096',
      tint: '#E2A154',
      cardBackground: 'rgba(29, 32, 42, 0.70)',
      cardBorder: 'rgba(255, 255, 255, 0.12)',
      divider: 'rgba(255, 255, 255, 0.08)',
      frostOverlay: 'rgba(19, 21, 27, 0.85)',
      calloutBg: 'rgba(226, 161, 84, 0.10)',
      glassSurface: 'rgba(29, 32, 42, 0.72)',
      glassElevated: 'rgba(38, 42, 55, 0.85)',
      glassBorder: 'rgba(255, 255, 255, 0.14)',
      glassHighlight: 'rgba(255, 255, 255, 0.06)',
      blurTint: 'dark',
      blurIntensity: 65,
    }),

    midnight_emerald: new ColorPaletteDefinition({
      id: 'midnight_emerald',
      name: 'Midnight Emerald',
      isDark: true,
      background: '#0D1615',
      surface: '#12201E',
      surfaceElevated: '#182C29',
      border: 'rgba(52, 211, 153, 0.12)',
      accent: '#34D399',
      accentMuted: '#064E3B',
      accentContrast: '#081D1A',
      textPrimary: '#ECFDF5',
      textSecondary: '#A7F3D0',
      textMuted: '#84B0A1',
      tint: '#34D399',
      cardBackground: 'rgba(18, 32, 30, 0.72)',
      cardBorder: 'rgba(52, 211, 153, 0.18)',
      divider: 'rgba(255, 255, 255, 0.08)',
      frostOverlay: 'rgba(13, 22, 21, 0.88)',
      calloutBg: 'rgba(52, 211, 153, 0.10)',
      glassSurface: 'rgba(18, 32, 30, 0.75)',
      glassElevated: 'rgba(24, 44, 41, 0.85)',
      glassBorder: 'rgba(52, 211, 153, 0.20)',
      glassHighlight: 'rgba(255, 255, 255, 0.08)',
      blurTint: 'dark',
      blurIntensity: 65,
    }),

    cosmic_amethyst: new ColorPaletteDefinition({
      id: 'cosmic_amethyst',
      name: 'Cosmic Amethyst',
      isDark: true,
      background: '#13111C',
      surface: '#1C1929',
      surfaceElevated: '#262238',
      border: 'rgba(167, 139, 250, 0.12)',
      accent: '#A78BFA',
      accentMuted: '#4C1D95',
      accentContrast: '#120F22',
      textPrimary: '#F5F3FF',
      textSecondary: '#DDD6FE',
      textMuted: '#ACA0CE',
      tint: '#A78BFA',
      cardBackground: 'rgba(28, 25, 41, 0.72)',
      cardBorder: 'rgba(167, 139, 250, 0.18)',
      divider: 'rgba(255, 255, 255, 0.08)',
      frostOverlay: 'rgba(19, 17, 28, 0.88)',
      calloutBg: 'rgba(167, 139, 250, 0.10)',
      glassSurface: 'rgba(28, 25, 41, 0.75)',
      glassElevated: 'rgba(38, 34, 56, 0.85)',
      glassBorder: 'rgba(167, 139, 250, 0.20)',
      glassHighlight: 'rgba(255, 255, 255, 0.08)',
      blurTint: 'dark',
      blurIntensity: 65,
    }),

    crimson_rose: new ColorPaletteDefinition({
      id: 'crimson_rose',
      name: 'Crimson Rose',
      isDark: true,
      background: '#1A1015',
      surface: '#261720',
      surfaceElevated: '#331F2B',
      border: 'rgba(244, 114, 182, 0.12)',
      accent: '#F472B6',
      accentMuted: '#831843',
      accentContrast: '#200D1A',
      textPrimary: '#FDF2F8',
      textSecondary: '#FBCFE8',
      textMuted: '#C497AF',
      tint: '#F472B6',
      cardBackground: 'rgba(38, 23, 32, 0.72)',
      cardBorder: 'rgba(244, 114, 182, 0.18)',
      divider: 'rgba(255, 255, 255, 0.08)',
      frostOverlay: 'rgba(26, 16, 21, 0.88)',
      calloutBg: 'rgba(244, 114, 182, 0.10)',
      glassSurface: 'rgba(38, 23, 32, 0.75)',
      glassElevated: 'rgba(51, 31, 43, 0.85)',
      glassBorder: 'rgba(244, 114, 182, 0.20)',
      glassHighlight: 'rgba(255, 255, 255, 0.08)',
      blurTint: 'dark',
      blurIntensity: 65,
    }),

    oceanic_abyss: new ColorPaletteDefinition({
      id: 'oceanic_abyss',
      name: 'Oceanic Abyss',
      isDark: true,
      background: '#0B1522',
      surface: '#101E30',
      surfaceElevated: '#172B45',
      border: 'rgba(56, 189, 248, 0.12)',
      accent: '#38BDF8',
      accentMuted: '#0369A1',
      accentContrast: '#081726',
      textPrimary: '#F0F9FF',
      textSecondary: '#BAE6FD',
      textMuted: '#8EB2D6',
      tint: '#38BDF8',
      cardBackground: 'rgba(16, 30, 48, 0.72)',
      cardBorder: 'rgba(56, 189, 248, 0.18)',
      divider: 'rgba(255, 255, 255, 0.08)',
      frostOverlay: 'rgba(11, 21, 34, 0.88)',
      calloutBg: 'rgba(56, 189, 248, 0.10)',
      glassSurface: 'rgba(16, 30, 48, 0.75)',
      glassElevated: 'rgba(23, 43, 69, 0.85)',
      glassBorder: 'rgba(56, 189, 248, 0.20)',
      glassHighlight: 'rgba(255, 255, 255, 0.08)',
      blurTint: 'dark',
      blurIntensity: 65,
    }),

    alabaster_parchment: new ColorPaletteDefinition({
      id: 'alabaster_parchment',
      name: 'Alabaster Parchment',
      isDark: false,
      background: '#F3EFE6',
      surface: '#FAF8F3',
      surfaceElevated: '#EDE8DD',
      border: 'rgba(43, 41, 39, 0.10)',
      accent: '#B5681A',
      accentMuted: '#F0D6B2',
      accentContrast: '#FFFFFF',
      textPrimary: '#2B2927',
      textSecondary: '#524C44',
      textMuted: '#6E675D',
      tint: '#B5681A',
      cardBackground: 'rgba(255, 252, 246, 0.75)',
      cardBorder: 'rgba(43, 41, 39, 0.14)',
      divider: 'rgba(43, 41, 39, 0.08)',
      frostOverlay: 'rgba(243, 239, 230, 0.88)',
      calloutBg: 'rgba(181, 104, 26, 0.10)',
      glassSurface: 'rgba(255, 252, 246, 0.80)',
      glassElevated: 'rgba(255, 255, 255, 0.90)',
      glassBorder: 'rgba(255, 255, 255, 0.75)',
      glassHighlight: 'rgba(255, 255, 255, 0.40)',
      blurTint: 'light',
      blurIntensity: 55,
    }),

    sage_botanical: new ColorPaletteDefinition({
      id: 'sage_botanical',
      name: 'Sage Botanical',
      isDark: false,
      background: '#EEF3EE',
      surface: '#F6FAF6',
      surfaceElevated: '#E2EBE2',
      border: 'rgba(30, 58, 42, 0.10)',
      accent: '#26734B',
      accentMuted: '#C2E0D1',
      accentContrast: '#FFFFFF',
      textPrimary: '#1E3327',
      textSecondary: '#3B5845',
      textMuted: '#4F705D',
      tint: '#26734B',
      cardBackground: 'rgba(246, 250, 246, 0.80)',
      cardBorder: 'rgba(30, 58, 42, 0.14)',
      divider: 'rgba(30, 58, 42, 0.08)',
      frostOverlay: 'rgba(238, 243, 238, 0.88)',
      calloutBg: 'rgba(38, 115, 75, 0.10)',
      glassSurface: 'rgba(246, 250, 246, 0.82)',
      glassElevated: 'rgba(255, 255, 255, 0.92)',
      glassBorder: 'rgba(255, 255, 255, 0.75)',
      glassHighlight: 'rgba(255, 255, 255, 0.45)',
      blurTint: 'light',
      blurIntensity: 55,
    }),
  };

  public static readonly TEXT_COLORS: Array<{ name: string; hex: string }> = [
    { name: 'Default', hex: '' },
    { name: 'Honey Gold', hex: '#E2A154' },
    { name: 'Emerald', hex: '#34D399' },
    { name: 'Sky Blue', hex: '#38BDF8' },
    { name: 'Rose Pink', hex: '#F472B6' },
    { name: 'Lavender', hex: '#A78BFA' },
    { name: 'Sunset Coral', hex: '#FB923C' },
    { name: 'Ruby Red', hex: '#F87171' },
  ];

  public static readonly SPRINGS = {
    interactive: {
      damping: 22,
      stiffness: 240,
      mass: 0.8,
    },
    gentle: {
      damping: 28,
      stiffness: 180,
      mass: 1.0,
    },
    sheet: {
      damping: 24,
      stiffness: 220,
      mass: 0.9,
    },
  };

  public static getPalette(paletteId: string = 'obsidian_gold', isDarkFallback: boolean = true): ColorPaletteDefinition {
    if (this.PALETTES[paletteId]) {
      return this.PALETTES[paletteId];
    }
    return isDarkFallback ? this.PALETTES.obsidian_gold : this.PALETTES.alabaster_parchment;
  }

  public static getColors(isDark: boolean = true): ColorPaletteDefinition {
    return isDark ? this.PALETTES.obsidian_gold : this.PALETTES.alabaster_parchment;
  }

  public static getResponsiveMetrics(width: number, height: number): ResponsiveMetrics {
    const isLandscape = width > height;
    let deviceTier: ResponsiveMetrics['deviceTier'] = 'phone';
    let maxContainerWidth = width;
    let horizontalPadding = 16;
    let noteGridColumns = 1;
    let connectionColumns = 2;

    if (width < 360) {
      deviceTier = 'compact';
      maxContainerWidth = width;
      horizontalPadding = 14;
      noteGridColumns = 1;
      connectionColumns = 1;
    } else if (width < 600) {
      deviceTier = 'phone';
      maxContainerWidth = width;
      horizontalPadding = 18;
      noteGridColumns = 1;
      connectionColumns = 2;
    } else if (width < 900) {
      deviceTier = 'foldable';
      maxContainerWidth = 760;
      horizontalPadding = 24;
      noteGridColumns = 2;
      connectionColumns = 3;
    } else {
      deviceTier = 'tablet';
      maxContainerWidth = 1040;
      horizontalPadding = 32;
      noteGridColumns = 3;
      connectionColumns = 4;
    }

    const androidBarHeight = StatusBar.currentHeight || 28;
    const safeTopInset = Platform.OS === 'android' ? androidBarHeight + 8 : 12;
    // Stable bottom dock elevation preventing volatile layout jumps when keyboard opens
    const safeBottomInset = Platform.OS === 'android' ? 16 : 20;

    return new ResponsiveMetrics({
      width,
      height,
      deviceTier,
      isFoldableOrTablet: deviceTier === 'foldable' || deviceTier === 'tablet',
      isLandscape,
      maxContainerWidth,
      horizontalPadding,
      noteGridColumns,
      connectionColumns,
      safeTopInset,
      safeBottomInset,
    });
  }
}
