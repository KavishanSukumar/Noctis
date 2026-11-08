import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Modal,
  Switch,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { UserSettingsConfig } from '../models/NoctisModels';
import { NoctisTheme, ColorPaletteDefinition, ResponsiveMetrics } from '../theme/NoctisTheme';

export class ThemeSettingsModalProps {
  public visible: boolean = false;
  public settings: UserSettingsConfig = new UserSettingsConfig();
  public palette: ColorPaletteDefinition = new ColorPaletteDefinition();
  public metrics: ResponsiveMetrics = new ResponsiveMetrics();
  public onClose: () => void = () => {};
  public onUpdateSettings: (newSettings: UserSettingsConfig) => void = () => {};
}

export class ThemeSettingsModalState {}

export class ThemeSettingsModal extends React.Component<
  ThemeSettingsModalProps,
  ThemeSettingsModalState
> {
  private styles = ThemeSettingsModalStyles.styles;

  private selectPalette = (paletteId: string): void => {
    Haptics.selectionAsync();
    const target = NoctisTheme.PALETTES[paletteId];
    const isDark = target ? target.isDark : this.props.settings.isDark;

    const updated = new UserSettingsConfig({
      ...this.props.settings,
      themePaletteId: paletteId,
      isDark,
    });
    this.props.onUpdateSettings(updated);
  };

  private toggleDefaultJournalMode = (mode: 'view' | 'edit'): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = new UserSettingsConfig({
      ...this.props.settings,
      defaultJournalMode: mode,
    });
    this.props.onUpdateSettings(updated);
  };

  private setBackupMode = (mode: 'auto' | 'manual'): void => {
    Haptics.selectionAsync();
    const updated = new UserSettingsConfig({
      ...this.props.settings,
      backupMode: mode,
    });
    this.props.onUpdateSettings(updated);
  };

  private toggleBackupWifiOnly = (value: boolean): void => {
    Haptics.selectionAsync();
    const updated = new UserSettingsConfig({
      ...this.props.settings,
      backupWifiOnly: value,
    });
    this.props.onUpdateSettings(updated);
  };

  public override render() {
    const { visible, palette, settings, onClose } = this.props;
    const allPalettes = Object.values(NoctisTheme.PALETTES);

    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={this.styles.modalBackdrop}>
          <View style={[this.styles.sheet, { backgroundColor: palette.surface, borderColor: palette.glassBorder, paddingBottom: Math.max(20, this.props.metrics?.safeBottomInset || 20) }]}>
            <View style={this.styles.sheetHeader}>
              <Text style={[this.styles.sheetTitle, { color: palette.textPrimary }]}>
                Appearance & Preferences
              </Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close appearance settings"
                style={this.styles.closeBtn}
              >
                <Text style={[this.styles.closeText, { color: palette.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 30 + (this.props.metrics?.safeBottomInset || 20) }}>
              {/* Color Palettes Section */}
              <Text style={[this.styles.sectionHeader, { color: palette.accent }]}>
                GLOBAL COLOR PALETTES
              </Text>
              <Text style={[this.styles.sectionSub, { color: palette.textSecondary }]}>
                Choose your desired nocturnal or parchment mood theme
              </Text>

              <View style={this.styles.palettesGrid}>
                {allPalettes.map((p) => {
                  const isSelected = settings.themePaletteId === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => this.selectPalette(p.id)}
                      style={[
                        this.styles.paletteCard,
                        {
                          backgroundColor: p.surface,
                          borderColor: isSelected ? palette.accent : p.border,
                          borderWidth: isSelected ? 2 : 1,
                        },
                      ]}
                    >
                      <View style={this.styles.paletteTop}>
                        <View style={[this.styles.accentSwatch, { backgroundColor: p.accent }]} />
                        <View style={[this.styles.bgSwatch, { backgroundColor: p.background }]} />
                        <Text style={[this.styles.paletteModeBadge, { color: p.isDark ? '#F5F5F5' : '#1F2937' }]}>
                          {p.isDark ? 'Dark' : 'Light'}
                        </Text>
                      </View>
                      <Text style={[this.styles.paletteName, { color: p.textPrimary }]}>
                        {p.name}
                      </Text>
                      {isSelected && (
                        <Text style={[this.styles.activeCheck, { color: palette.accent }]}>
                          ✓ Active Theme
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Journal Default Mode */}
              <Text style={[this.styles.sectionHeader, { color: palette.accent, marginTop: 18 }]}>
                DAILY JOURNAL DEFAULT READING MODE
              </Text>
              <Text style={[this.styles.sectionSub, { color: palette.textSecondary }]}>
                When opening a date's journal, start in distraction-free View Mode or interactive Edit Mode:
              </Text>

              <View style={this.styles.modePillsRow}>
                <TouchableOpacity
                  onPress={() => this.toggleDefaultJournalMode('view')}
                  style={[
                    this.styles.modePill,
                    {
                      backgroundColor: settings.defaultJournalMode === 'view' ? palette.accent : palette.glassElevated,
                    },
                  ]}
                >
                  <Text
                    style={[
                      this.styles.modePillText,
                      { color: settings.defaultJournalMode === 'view' ? palette.accentContrast : palette.textPrimary },
                    ]}
                  >
                    📖 View Mode (Default)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => this.toggleDefaultJournalMode('edit')}
                  style={[
                    this.styles.modePill,
                    {
                      backgroundColor: settings.defaultJournalMode === 'edit' ? palette.accent : palette.glassElevated,
                    },
                  ]}
                >
                  <Text
                    style={[
                      this.styles.modePillText,
                      { color: settings.defaultJournalMode === 'edit' ? palette.accentContrast : palette.textPrimary },
                    ]}
                  >
                    ✏️ Edit Mode
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Cloud Backup & Network Section */}
              <Text style={[this.styles.sectionHeader, { color: palette.accent, marginTop: 10 }]}>
                CLOUD BACKUP & NETWORK
              </Text>
              <Text style={[this.styles.sectionSub, { color: palette.textSecondary }]}>
                Configure automatic cloud synchronization and network behavior
              </Text>

              <View style={this.styles.modePillsRow}>
                <TouchableOpacity
                  onPress={() => this.setBackupMode('auto')}
                  style={[
                    this.styles.modePill,
                    {
                      backgroundColor: (settings.backupMode || 'auto') === 'auto' ? palette.accent : palette.glassElevated,
                    },
                  ]}
                >
                  <Text
                    style={[
                      this.styles.modePillText,
                      { color: (settings.backupMode || 'auto') === 'auto' ? palette.accentContrast : palette.textPrimary },
                    ]}
                  >
                    ⚡ Auto Backup
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => this.setBackupMode('manual')}
                  style={[
                    this.styles.modePill,
                    {
                      backgroundColor: settings.backupMode === 'manual' ? palette.accent : palette.glassElevated,
                    },
                  ]}
                >
                  <Text
                    style={[
                      this.styles.modePillText,
                      { color: settings.backupMode === 'manual' ? palette.accentContrast : palette.textPrimary },
                    ]}
                  >
                    🔘 Manual Button
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={[this.styles.settingToggleRow, { borderTopColor: palette.border, borderBottomColor: palette.border }]}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={[this.styles.toggleRowLabel, { color: palette.textPrimary }]}>
                    Wi-Fi Only Backup
                  </Text>
                  <Text style={[this.styles.toggleRowSub, { color: palette.textSecondary }]}>
                    Upload backups only over Wi-Fi networks to protect cellular data
                  </Text>
                </View>
                <Switch
                  value={settings.backupWifiOnly !== false}
                  onValueChange={this.toggleBackupWifiOnly}
                  trackColor={{ false: palette.cardBorder, true: palette.accent }}
                  thumbColor={settings.backupWifiOnly !== false ? '#0B0B0E' : '#FFFFFF'}
                />
              </View>

              <TouchableOpacity
                onPress={onClose}
                style={[this.styles.doneBtn, { backgroundColor: palette.accent }]}
              >
                <Text style={[this.styles.doneBtnText, { color: palette.accentContrast }]}>Save & Apply</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }
}

export class ThemeSettingsModalStyles {
  public static readonly styles = StyleSheet.create({
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'flex-end',
    } as ViewStyle,
    sheet: {
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderWidth: 1,
      padding: 20,
      maxHeight: '85%',
    } as ViewStyle,
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    } as ViewStyle,
    sheetTitle: {
      fontSize: 20,
      fontWeight: '800',
    } as TextStyle,
    closeBtn: {
      padding: 6,
    } as ViewStyle,
    closeText: {
      fontSize: 18,
      fontWeight: '700',
    } as TextStyle,
    sectionHeader: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      marginBottom: 4,
    } as TextStyle,
    sectionSub: {
      fontSize: 13,
      marginBottom: 12,
      lineHeight: 18,
    } as TextStyle,
    palettesGrid: {
      gap: 10,
    } as ViewStyle,
    paletteCard: {
      borderRadius: 18,
      padding: 14,
      marginBottom: 4,
    } as ViewStyle,
    paletteTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    } as ViewStyle,
    accentSwatch: {
      width: 18,
      height: 18,
      borderRadius: 9,
    } as ViewStyle,
    bgSwatch: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    } as ViewStyle,
    paletteModeBadge: {
      fontSize: 11,
      fontWeight: '700',
      marginLeft: 'auto',
    } as TextStyle,
    paletteName: {
      fontSize: 16,
      fontWeight: '700',
    } as TextStyle,
    activeCheck: {
      fontSize: 12,
      fontWeight: '700',
      marginTop: 4,
    } as TextStyle,
    modePillsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 20,
    } as ViewStyle,
    modePill: {
      flex: 1,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    modePillText: {
      fontSize: 13,
      fontWeight: '700',
    } as TextStyle,
    settingToggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      marginBottom: 20,
    } as ViewStyle,
    toggleRowLabel: {
      fontSize: 14,
      fontWeight: '700',
    } as TextStyle,
    toggleRowSub: {
      fontSize: 12,
      marginTop: 2,
    } as TextStyle,
    doneBtn: {
      borderRadius: 999,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
    } as ViewStyle,
    doneBtnText: {
      color: '#0B0B0E',
      fontSize: 15,
      fontWeight: '700',
    } as TextStyle,
  });
}
