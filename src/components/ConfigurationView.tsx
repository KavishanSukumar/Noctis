import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ImageStyle,
  Image,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { UserSettingsConfig, GoogleSSOUserProfile } from '../models/NoctisModels';
import { NoctisTheme, ColorPaletteDefinition, ResponsiveMetrics } from '../theme/NoctisTheme';
import { AppConfigStorageService } from '../services/AppConfigStorageService';

export class ConfigurationViewProps {
  public settings: UserSettingsConfig = new UserSettingsConfig();
  public palette: ColorPaletteDefinition = new ColorPaletteDefinition();
  public metrics: ResponsiveMetrics = new ResponsiveMetrics();
  public profile: GoogleSSOUserProfile | null = null;
  public isSyncing: boolean = false;
  public syncStatusMessage: string = '';
  public onUpdateSettings: (newSettings: UserSettingsConfig) => void = () => {};
  public onGoogleLogin: () => void = () => {};
  public onGoogleSignOut: () => void = () => {};
  public onLockVault: () => void = () => {};
  public onLogOut: () => void = () => {};
  public onTriggerBackup?: () => void;
}

export class ConfigurationViewState {}

export class ConfigurationView extends React.Component<
  ConfigurationViewProps,
  ConfigurationViewState
> {
  private styles = ConfigurationViewStyles.styles;

  private static readonly TAB_DEFINITIONS = [
    {
      id: 'diary',
      name: 'Daily Journal',
      icon: '📖',
      description: 'Daily reflections, mood logs, habits & timeline',
    },
    {
      id: 'brain',
      name: 'Second Brain',
      icon: '🧠',
      description: 'Books, knowledge topics, reference links & projects',
    },
    {
      id: 'todos',
      name: 'General To-Dos',
      icon: '☑️',
      description: 'Scheduled tasks, priorities & push reminders',
    },
    {
      id: 'notes',
      name: 'Quick Notes',
      icon: '📝',
      description: 'PARA inbox, thoughts & freeform captures',
    },
    {
      id: 'graph',
      name: 'Knowledge Graph',
      icon: '🕸️',
      description: 'Interactive 2D bidirectional concept visualizer',
    },
  ];

  // ================= TAB VISIBILITY TOGGLING =================

  private toggleTabVisibility = (tabId: string, isVisible: boolean): void => {
    Haptics.selectionAsync();
    const currentHidden = this.props.settings.hiddenTabs || [];
    const allTabIds = ConfigurationView.TAB_DEFINITIONS.map((t) => t.id);

    if (!isVisible) {
      const currentlyVisible = allTabIds.filter((id) => !currentHidden.includes(id));
      if (currentlyVisible.length <= 1 && currentlyVisible.includes(tabId)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          'Navigation Protection',
          'At least one navigation tab must remain visible in Noctis so you can navigate your workspace.'
        );
        return;
      }

      if (!currentHidden.includes(tabId)) {
        const updatedHidden = [...currentHidden, tabId];
        const updated = new UserSettingsConfig({
          ...this.props.settings,
          hiddenTabs: AppConfigStorageService.sanitizeHiddenTabs(updatedHidden),
        });
        this.props.onUpdateSettings(updated);
      }
    } else {
      const updatedHidden = currentHidden.filter((id) => id !== tabId);
      const updated = new UserSettingsConfig({
        ...this.props.settings,
        hiddenTabs: updatedHidden,
      });
      this.props.onUpdateSettings(updated);
    }
  };

  // ================= THEME SELECTION =================

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

  // ================= BACKUP & WI-FI TOGGLES =================

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

  // ================= LOCK & LOG OUT HANDLERS =================

  private handleLockPress = (): void => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    this.props.onLockVault();
  };

  private handleLogOutPress = (): void => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    this.props.onLogOut();
  };

  private formatLastBackupTime(timestamp?: number): string {
    if (!timestamp || timestamp <= 0) {
      return 'Never backed up';
    }
    const d = new Date(timestamp);
    return `${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  public override render() {
    const {
      palette,
      metrics,
      settings,
      profile,
      isSyncing,
      syncStatusMessage,
      onGoogleLogin,
    } = this.props;

    const allPalettes = Object.values(NoctisTheme.PALETTES);
    const hiddenTabs = settings.hiddenTabs || [];
    const isAutoBackup = (settings.backupMode || 'auto') === 'auto';
    const isWifiOnly = settings.backupWifiOnly !== false;

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={[this.styles.scrollContainer, { backgroundColor: palette.background }]}
        contentContainerStyle={{
          paddingBottom: 120 + (metrics?.safeBottomInset || 20),
          paddingHorizontal: metrics?.horizontalPadding || 16,
          maxWidth: metrics?.maxContainerWidth || 800,
          alignSelf: 'center',
          width: '100%',
        }}
      >
        {/* Page Header */}
        <View style={this.styles.pageHeader}>
          <Text style={[this.styles.pageTitle, { color: palette.textPrimary }]}>
            Configuration & Settings
          </Text>
          <Text style={[this.styles.pageSubtitle, { color: palette.textSecondary }]}>
            Workspace preferences, security, tab visibility & cloud backup
          </Text>
        </View>

        {/* ================= SECTION 1: ACCOUNT & SECURITY ACTIONS ================= */}
        <View style={this.styles.sectionBlock}>
          <Text style={[this.styles.sectionHeader, { color: palette.accent }]}>
            ACCOUNT & SECURITY
          </Text>

          {profile ? (
            <View
              style={[
                this.styles.accountCard,
                {
                  backgroundColor: palette.glassElevated,
                  borderColor: palette.cardBorder,
                },
              ]}
            >
              <View style={this.styles.accountRow}>
                {profile.picture ? (
                  <Image source={{ uri: profile.picture }} style={this.styles.avatarImage} />
                ) : (
                  <View
                    style={[
                      this.styles.avatarFallback,
                      { backgroundColor: palette.calloutBg, borderColor: palette.accent },
                    ]}
                  >
                    <Text style={[this.styles.avatarInitial, { color: palette.accent }]}>
                      {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
                    </Text>
                  </View>
                )}
                <View style={this.styles.accountInfoCol}>
                  <View style={this.styles.nameBadgeRow}>
                    <Text
                      style={[this.styles.accountName, { color: palette.textPrimary }]}
                      numberOfLines={1}
                    >
                      {profile.name || 'Noctis Vault User'}
                    </Text>
                    <View
                      style={[
                        this.styles.verifiedPill,
                        { backgroundColor: palette.success + '22' },
                      ]}
                    >
                      <Text style={[this.styles.verifiedText, { color: palette.success }]}>
                        ✓ Google
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[this.styles.accountEmail, { color: palette.textSecondary }]}
                    numberOfLines={1}
                  >
                    {profile.email}
                  </Text>
                  <Text style={[this.styles.vaultIdText, { color: palette.textMuted }]}>
                    Vault ID: vlt_{profile.sub ? profile.sub.slice(0, 10) : 'local'}...
                  </Text>
                </View>
              </View>

              {/* Action Buttons Row */}
              <View style={this.styles.securityBtnRow}>
                <TouchableOpacity
                  onPress={this.handleLockPress}
                  style={[
                    this.styles.actionBtnHalf,
                    { borderColor: palette.accent + '44', backgroundColor: palette.calloutBg },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Lock Vault Immediately"
                >
                  <Text style={[this.styles.actionBtnText, { color: palette.accent }]}>
                    🔒 Lock Vault
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={this.handleLogOutPress}
                  style={[
                    this.styles.actionBtnHalf,
                    { borderColor: palette.danger + '44', backgroundColor: palette.danger + '11' },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Log Out of Session"
                >
                  <Text style={[this.styles.actionBtnText, { color: palette.danger }]}>
                    🚪 Log Out
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View
              style={[
                this.styles.unlinkedCard,
                {
                  backgroundColor: palette.glassElevated,
                  borderColor: palette.cardBorder,
                },
              ]}
            >
              <View style={this.styles.unlinkedRow}>
                <Text style={this.styles.unlinkedIcon}>🛡️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[this.styles.unlinkedTitle, { color: palette.textPrimary }]}>
                    Local Vault Mode
                  </Text>
                  <Text style={[this.styles.unlinkedDesc, { color: palette.textSecondary }]}>
                    Your notes and reflections are securely encrypted locally with hardware-backed AES-256-GCM. Sign in to enable stealth cloud sync.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={onGoogleLogin}
                disabled={isSyncing}
                style={[this.styles.loginBtn, { backgroundColor: palette.accent }]}
                accessibilityRole="button"
                accessibilityLabel="Sign in with Google"
              >
                {isSyncing ? (
                  <ActivityIndicator color={palette.accentContrast} size="small" />
                ) : (
                  <Text style={[this.styles.loginBtnText, { color: palette.accentContrast }]}>🚀 Sign in with Google</Text>
                )}
              </TouchableOpacity>

              <View style={this.styles.securityBtnRow}>
                <TouchableOpacity
                  onPress={this.handleLockPress}
                  style={[
                    this.styles.actionBtnHalf,
                    { borderColor: palette.accent + '44', backgroundColor: palette.calloutBg },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Lock Vault Immediately"
                >
                  <Text style={[this.styles.actionBtnText, { color: palette.accent }]}>
                    🔒 Lock Vault
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={this.handleLogOutPress}
                  style={[
                    this.styles.actionBtnHalf,
                    { borderColor: palette.danger + '44', backgroundColor: palette.danger + '11' },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Log Out and Lock Vault"
                >
                  <Text style={[this.styles.actionBtnText, { color: palette.danger }]}>
                    🚪 Log Out
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ================= SECTION 2: TABS HIDING ================= */}
        <View style={this.styles.sectionBlock}>
          <View style={this.styles.sectionTitleRow}>
            <Text style={[this.styles.sectionHeader, { color: palette.accent }]}>
              WORKSPACE TAB VISIBILITY
            </Text>
            <View
              style={[
                this.styles.tabCountPill,
                { backgroundColor: palette.calloutBg, borderColor: palette.accent + '33' },
              ]}
            >
              <Text style={[this.styles.tabCountText, { color: palette.accent }]}>
                {ConfigurationView.TAB_DEFINITIONS.length - hiddenTabs.length} /{' '}
                {ConfigurationView.TAB_DEFINITIONS.length} Visible
              </Text>
            </View>
          </View>
          <Text style={[this.styles.sectionSub, { color: palette.textSecondary }]}>
            Hide tabs you don't frequently use to keep your dock distraction-free. Settings are stored automatically in your configuration file.
          </Text>

          <View
            style={[
              this.styles.cardGroup,
              {
                backgroundColor: palette.glassElevated,
                borderColor: palette.cardBorder,
              },
            ]}
          >
            {ConfigurationView.TAB_DEFINITIONS.map((tab, idx) => {
              const isVisible = !hiddenTabs.includes(tab.id);
              const isLast = idx === ConfigurationView.TAB_DEFINITIONS.length - 1;

              return (
                <View
                  key={tab.id}
                  style={[
                    this.styles.tabToggleRow,
                    !isLast && {
                      borderBottomColor: palette.border,
                      borderBottomWidth: 1,
                    },
                  ]}
                >
                  <View style={this.styles.tabRowLeft}>
                    <Text style={this.styles.tabIcon}>{tab.icon}</Text>
                    <View style={this.styles.tabTextCol}>
                      <View style={this.styles.tabNameRow}>
                        <Text
                          style={[
                            this.styles.tabName,
                            {
                              color: isVisible ? palette.textPrimary : palette.textMuted,
                              textDecorationLine: isVisible ? 'none' : 'line-through',
                            },
                          ]}
                        >
                          {tab.name}
                        </Text>
                        {!isVisible && (
                          <Text style={[this.styles.hiddenBadge, { color: palette.textMuted }]}>
                            (Hidden)
                          </Text>
                        )}
                      </View>
                      <Text
                        style={[this.styles.tabDesc, { color: palette.textSecondary }]}
                        numberOfLines={1}
                      >
                        {tab.description}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={isVisible}
                    onValueChange={(val) => this.toggleTabVisibility(tab.id, val)}
                    trackColor={{ false: palette.cardBorder, true: palette.accent }}
                    thumbColor={isVisible ? '#0B0B0E' : '#FFFFFF'}
                  />
                </View>
              );
            })}
          </View>
        </View>

        {/* ================= SECTION 3: AUTO BACKUP THROUGH WI-FI ================= */}
        <View style={this.styles.sectionBlock}>
          <Text style={[this.styles.sectionHeader, { color: palette.accent }]}>
            AUTO CLOUD BACKUP & WI-FI POLICY
          </Text>
          <Text style={[this.styles.sectionSub, { color: palette.textSecondary }]}>
            Control how and when your encrypted vault synchronizes to Google Drive
          </Text>

          <View
            style={[
              this.styles.cardGroup,
              {
                backgroundColor: palette.glassElevated,
                borderColor: palette.cardBorder,
                padding: 16,
              },
            ]}
          >
            {/* Backup Mode Pills */}
            <View style={this.styles.modePillsRow}>
              <TouchableOpacity
                onPress={() => this.setBackupMode('auto')}
                style={[
                  this.styles.modePill,
                  {
                    backgroundColor: isAutoBackup ? palette.accent : palette.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    this.styles.modePillText,
                    { color: isAutoBackup ? '#0B0B0E' : palette.textPrimary },
                  ]}
                >
                  ⚡ Automatic Backup
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => this.setBackupMode('manual')}
                style={[
                  this.styles.modePill,
                  {
                    backgroundColor: !isAutoBackup ? palette.accent : palette.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    this.styles.modePillText,
                    { color: !isAutoBackup ? '#0B0B0E' : palette.textPrimary },
                  ]}
                >
                  📖 Manual Only
                </Text>
              </TouchableOpacity>
            </View>

            {/* Wi-Fi Only Switch */}
            <View
              style={[
                this.styles.settingToggleRow,
                {
                  borderTopColor: palette.border,
                  borderBottomColor: palette.border,
                },
              ]}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[this.styles.toggleRowLabel, { color: palette.textPrimary }]}>
                  Backup Over Wi-Fi Only
                </Text>
                <Text style={[this.styles.toggleRowSub, { color: palette.textSecondary }]}>
                  Restricts cloud uploads to Wi-Fi connections to prevent cellular data usage
                </Text>
              </View>
              <Switch
                value={isWifiOnly}
                onValueChange={this.toggleBackupWifiOnly}
                trackColor={{ false: palette.cardBorder, true: palette.accent }}
                thumbColor={isWifiOnly ? '#0B0B0E' : '#FFFFFF'}
              />
            </View>

            {/* Status & Last Backup Info */}
            <View style={this.styles.backupStatusRow}>
              <View style={{ flex: 1 }}>
                <Text style={[this.styles.backupStatusLabel, { color: palette.textSecondary }]}>
                  Last Successful Cloud Sync:
                </Text>
                <Text style={[this.styles.backupStatusVal, { color: palette.textPrimary }]}>
                  ☁️ {this.formatLastBackupTime(settings.lastBackupTimestamp)}
                </Text>
                {syncStatusMessage ? (
                  <Text style={[this.styles.syncMessageText, { color: palette.accent }]}>
                    {syncStatusMessage}
                  </Text>
                ) : null}
              </View>

              {this.props.onTriggerBackup && profile && (
                <TouchableOpacity
                  onPress={this.props.onTriggerBackup}
                  disabled={isSyncing}
                  style={[
                    this.styles.manualBackupBtn,
                    { backgroundColor: palette.calloutBg, borderColor: palette.accent },
                  ]}
                >
                  {isSyncing ? (
                    <ActivityIndicator color={palette.accent} size="small" />
                  ) : (
                    <Text style={[this.styles.manualBackupBtnText, { color: palette.accent }]}>
                      Sync Now
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* ================= SECTION 4: THEME & APPEARANCE ================= */}
        <View style={this.styles.sectionBlock}>
          <Text style={[this.styles.sectionHeader, { color: palette.accent }]}>
            THEME & VISUAL PALETTES
          </Text>
          <Text style={[this.styles.sectionSub, { color: palette.textSecondary }]}>
            Select your desired aesthetic mood for reading and writing
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
                    <Text
                      style={[
                        this.styles.paletteModeBadge,
                        { color: p.isDark ? '#F5F5F5' : '#1F2937' },
                      ]}
                    >
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

          {/* Journal Reading Mode */}
          <Text style={[this.styles.sectionHeader, { color: palette.accent, marginTop: 18 }]}>
            DAILY JOURNAL DEFAULT READING MODE
          </Text>
          <View
            style={[
              this.styles.segmentedContainer,
              { backgroundColor: palette.glassElevated, borderColor: palette.cardBorder },
            ]}
          >
            <TouchableOpacity
              onPress={() => this.toggleDefaultJournalMode('view')}
              style={[
                this.styles.segmentBtn,
                {
                  backgroundColor:
                    settings.defaultJournalMode === 'view' ? palette.accent : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  this.styles.segmentBtnText,
                  {
                    color:
                      settings.defaultJournalMode === 'view' ? palette.accentContrast : palette.textSecondary,
                  },
                ]}
              >
                📖 Reading Mode
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => this.toggleDefaultJournalMode('edit')}
              style={[
                this.styles.segmentBtn,
                {
                  backgroundColor:
                    settings.defaultJournalMode === 'edit' ? palette.accent : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  this.styles.segmentBtnText,
                  {
                    color:
                      settings.defaultJournalMode === 'edit' ? palette.accentContrast : palette.textSecondary,
                  },
                ]}
              >
                ✏️ Editing Mode
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }
}

export class ConfigurationViewStyles {
  public static readonly styles = StyleSheet.create({
    scrollContainer: {
      flex: 1,
    } as ViewStyle,
    pageHeader: {
      paddingVertical: 14,
      marginBottom: 6,
    } as ViewStyle,
    pageTitle: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.3,
      marginBottom: 4,
    } as TextStyle,
    pageSubtitle: {
      fontSize: 13,
      lineHeight: 18,
    } as TextStyle,
    sectionBlock: {
      marginBottom: 24,
    } as ViewStyle,
    sectionHeader: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
      marginBottom: 6,
      textTransform: 'uppercase',
    } as TextStyle,
    sectionSub: {
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 12,
    } as TextStyle,
    sectionTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    } as ViewStyle,
    tabCountPill: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 2,
    } as ViewStyle,
    tabCountText: {
      fontSize: 11,
      fontWeight: '700',
    } as TextStyle,
    cardGroup: {
      borderRadius: 18,
      borderWidth: 1,
      overflow: 'hidden',
    } as ViewStyle,
    accountCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 16,
    } as ViewStyle,
    accountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
    } as ViewStyle,
    avatarImage: {
      width: 48,
      height: 48,
      borderRadius: 24,
      marginRight: 14,
    } as ImageStyle,
    avatarFallback: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    } as ViewStyle,
    avatarInitial: {
      fontSize: 20,
      fontWeight: '800',
    } as TextStyle,
    accountInfoCol: {
      flex: 1,
    } as ViewStyle,
    nameBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2,
    } as ViewStyle,
    accountName: {
      fontSize: 16,
      fontWeight: '700',
      maxWidth: 160,
    } as TextStyle,
    verifiedPill: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
    } as ViewStyle,
    verifiedText: {
      fontSize: 10,
      fontWeight: '700',
    } as TextStyle,
    accountEmail: {
      fontSize: 13,
      marginBottom: 2,
    } as TextStyle,
    vaultIdText: {
      fontSize: 11,
      fontFamily: 'monospace',
    } as TextStyle,
    securityBtnRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
    } as ViewStyle,
    actionBtnHalf: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    actionBtnText: {
      fontSize: 13,
      fontWeight: '700',
    } as TextStyle,
    unlinkedCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 16,
    } as ViewStyle,
    unlinkedRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 14,
    } as ViewStyle,
    unlinkedIcon: {
      fontSize: 28,
    } as TextStyle,
    unlinkedTitle: {
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 2,
    } as TextStyle,
    unlinkedDesc: {
      fontSize: 12,
      lineHeight: 17,
    } as TextStyle,
    loginBtn: {
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    } as ViewStyle,
    loginBtnText: {
      color: '#0B0B0E',
      fontSize: 14,
      fontWeight: '700',
    } as TextStyle,
    tabToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 16,
    } as ViewStyle,
    tabRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
      marginRight: 10,
    } as ViewStyle,
    tabIcon: {
      fontSize: 22,
    } as TextStyle,
    tabTextCol: {
      flex: 1,
    } as ViewStyle,
    tabNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    } as ViewStyle,
    tabName: {
      fontSize: 14,
      fontWeight: '700',
    } as TextStyle,
    hiddenBadge: {
      fontSize: 11,
      fontWeight: '600',
    } as TextStyle,
    tabDesc: {
      fontSize: 12,
      marginTop: 2,
    } as TextStyle,
    modePillsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 14,
    } as ViewStyle,
    modePill: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      alignItems: 'center',
    } as ViewStyle,
    modePillText: {
      fontSize: 12,
      fontWeight: '700',
    } as TextStyle,
    settingToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      marginBottom: 14,
    } as ViewStyle,
    toggleRowLabel: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 2,
    } as TextStyle,
    toggleRowSub: {
      fontSize: 12,
      lineHeight: 16,
    } as TextStyle,
    backupStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    } as ViewStyle,
    backupStatusLabel: {
      fontSize: 12,
      marginBottom: 2,
    } as TextStyle,
    backupStatusVal: {
      fontSize: 13,
      fontWeight: '600',
    } as TextStyle,
    syncMessageText: {
      fontSize: 11,
      marginTop: 2,
      fontWeight: '500',
    } as TextStyle,
    manualBackupBtn: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    } as ViewStyle,
    manualBackupBtnText: {
      fontSize: 12,
      fontWeight: '700',
    } as TextStyle,
    palettesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 8,
    } as ViewStyle,
    paletteCard: {
      width: '48%',
      borderRadius: 14,
      padding: 12,
    } as ViewStyle,
    paletteTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    } as ViewStyle,
    accentSwatch: {
      width: 14,
      height: 14,
      borderRadius: 7,
    } as ViewStyle,
    bgSwatch: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: '#88888844',
    } as ViewStyle,
    paletteModeBadge: {
      fontSize: 10,
      fontWeight: '700',
      marginLeft: 'auto',
      textTransform: 'uppercase',
      opacity: 0.7,
    } as TextStyle,
    paletteName: {
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 2,
    } as TextStyle,
    activeCheck: {
      fontSize: 11,
      fontWeight: '700',
      marginTop: 2,
    } as TextStyle,
    segmentedContainer: {
      flexDirection: 'row',
      borderRadius: 14,
      borderWidth: 1,
      padding: 4,
      marginTop: 6,
    } as ViewStyle,
    segmentBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 10,
      alignItems: 'center',
    } as ViewStyle,
    segmentBtnText: {
      fontSize: 13,
      fontWeight: '700',
    } as TextStyle,
  });
}
