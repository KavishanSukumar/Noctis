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
  Modal,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { UserSettingsConfig, GoogleSSOUserProfile } from '../models/NoctisModels';
import { NoctisTheme, ColorPaletteDefinition, ResponsiveMetrics } from '../theme/NoctisTheme';
import { AppConfigStorageService } from '../services/AppConfigStorageService';

export class ConfigurationMenuModalProps {
  public visible: boolean = false;
  public settings: UserSettingsConfig = new UserSettingsConfig();
  public palette: ColorPaletteDefinition = new ColorPaletteDefinition();
  public metrics: ResponsiveMetrics = new ResponsiveMetrics();
  public profile: GoogleSSOUserProfile | null = null;
  public isSyncing: boolean = false;
  public syncStatusMessage: string = '';
  public onClose: () => void = () => {};
  public onUpdateSettings: (newSettings: UserSettingsConfig) => void = () => {};
  public onGoogleLogin: () => void = () => {};
  public onGoogleSignOut: () => void = () => {};
  public onLockVault?: () => void;
  public onLogOut?: () => void;
  public onTriggerBackup?: () => void;
}

export class ConfigurationMenuModalState {}

export class ConfigurationMenuModal extends React.Component<
  ConfigurationMenuModalProps,
  ConfigurationMenuModalState
> {
  private styles = ConfigurationMenuModalStyles.styles;

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
      icon: '🔗',
      description: 'Interactive 2D bidirectional concept visualizer',
    },
  ];

  // ================= TAB VISIBILITY TOGGLING =================

  private toggleTabVisibility = (tabId: string, isVisible: boolean): void => {
    Haptics.selectionAsync();
    const currentHidden = this.props.settings.hiddenTabs || [];
    const allTabIds = ConfigurationMenuModal.TAB_DEFINITIONS.map((t) => t.id);

    if (!isVisible) {
      // User wants to hide this tab. Validate that at least ONE other tab remains visible.
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
      // User wants to show this tab
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
    if (this.props.onLockVault) {
      this.props.onLockVault();
    }
  };

  private handleLogOutPress = (): void => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (this.props.onLogOut) {
      this.props.onLogOut();
    } else {
      this.handleSignOutPress();
    }
  };

  // ================= SIGN OUT CONFIRMATION =================

  private handleSignOutPress = (): void => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Sign Out of Noctis',
      'Are you sure you want to sign out? Stealth cloud backup will be paused until you sign in again. Your local encrypted vault remains intact on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => this.props.onGoogleSignOut(),
        },
      ]
    );
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
      visible,
      palette,
      metrics,
      settings,
      profile,
      isSyncing,
      syncStatusMessage,
      onClose,
      onGoogleLogin,
    } = this.props;

    const allPalettes = Object.values(NoctisTheme.PALETTES);
    const hiddenTabs = settings.hiddenTabs || [];
    const isAutoBackup = (settings.backupMode || 'auto') === 'auto';
    const isWifiOnly = settings.backupWifiOnly !== false;

    return (
      <Modal visible={Boolean(visible)} animationType="slide" transparent onRequestClose={onClose}>
        <View style={this.styles.modalBackdrop}>
          <View
            style={[
              this.styles.sheet,
              {
                backgroundColor: palette.surface,
                borderColor: palette.glassBorder,
                paddingBottom: Math.max(20, metrics?.safeBottomInset || 20),
              },
            ]}
          >
            {/* Header */}
            <View style={this.styles.sheetHeader}>
              <View>
                <Text style={[this.styles.sheetTitle, { color: palette.textPrimary }]}>
                  Configuration & Settings
                </Text>
                <Text style={[this.styles.sheetSubTitle, { color: palette.textSecondary }]}>
                  Workspace preferences, tab visibility & cloud backup
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close Configuration Menu"
                style={this.styles.closeBtn}
              >
                <Text style={[this.styles.closeText, { color: palette.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingBottom: 40 + (metrics?.safeBottomInset || 20),
              }}
            >
              {/* ================= SECTION 1: ACCOUNT INFORMATION ================= */}
              <View style={this.styles.sectionBlock}>
                <Text style={[this.styles.sectionHeader, { color: palette.accent }]}>
                  ACCOUNT & IDENTITY
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
                        <Text style={[this.styles.loginBtnText, { color: palette.accentContrast }]}>🔑 Sign in with Google</Text>
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
                      {ConfigurationMenuModal.TAB_DEFINITIONS.length - hiddenTabs.length} /{' '}
                      {ConfigurationMenuModal.TAB_DEFINITIONS.length} Visible
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
                  {ConfigurationMenuModal.TAB_DEFINITIONS.map((tab, idx) => {
                    const isVisible = !hiddenTabs.includes(tab.id);
                    const isLast = idx === ConfigurationMenuModal.TAB_DEFINITIONS.length - 1;

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
                        🔘 Manual Only
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
                        🕒 {this.formatLastBackupTime(settings.lastBackupTimestamp)}
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
                <Text style={[this.styles.sectionSub, { color: palette.textSecondary }]}>
                  When opening a date's journal, start in distraction-free View Mode or interactive Edit Mode:
                </Text>

                <View style={this.styles.modePillsRow}>
                  <TouchableOpacity
                    onPress={() => this.toggleDefaultJournalMode('view')}
                    style={[
                      this.styles.modePill,
                      {
                        backgroundColor:
                          settings.defaultJournalMode === 'view'
                            ? palette.accent
                            : palette.glassElevated,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        this.styles.modePillText,
                        {
                          color:
                            settings.defaultJournalMode === 'view' ? palette.accentContrast : palette.textPrimary,
                        },
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
                        backgroundColor:
                          settings.defaultJournalMode === 'edit'
                            ? palette.accent
                            : palette.glassElevated,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        this.styles.modePillText,
                        {
                          color:
                            settings.defaultJournalMode === 'edit' ? palette.accentContrast : palette.textPrimary,
                        },
                      ]}
                    >
                      ✏️ Edit Mode
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Close / Apply Button */}
              <TouchableOpacity
                onPress={onClose}
                style={[this.styles.doneBtn, { backgroundColor: palette.accent }]}
              >
                <Text style={[this.styles.doneBtnText, { color: palette.accentContrast }]}>Save & Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }
}

export class ConfigurationMenuModalStyles {
  public static readonly styles = StyleSheet.create({
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.72)',
      justifyContent: 'flex-end',
    } as ViewStyle,
    sheet: {
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderWidth: 1,
      padding: 20,
      maxHeight: '90%',
    } as ViewStyle,
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    } as ViewStyle,
    sheetTitle: {
      fontSize: 21,
      fontWeight: '800',
      letterSpacing: -0.3,
    } as TextStyle,
    sheetSubTitle: {
      fontSize: 12,
      marginTop: 2,
    } as TextStyle,
    closeBtn: {
      padding: 6,
    } as ViewStyle,
    closeText: {
      fontSize: 18,
      fontWeight: '700',
    } as TextStyle,
    sectionBlock: {
      marginBottom: 22,
    } as ViewStyle,
    sectionTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    } as ViewStyle,
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
    tabCountPill: {
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
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

    // Account Card
    accountCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 16,
    } as ViewStyle,
    accountRow: {
      flexDirection: 'row',
      alignItems: 'center',
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
      borderWidth: 2,
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
    } as ViewStyle,
    accountName: {
      fontSize: 16,
      fontWeight: '700',
      flexShrink: 1,
    } as TextStyle,
    verifiedPill: {
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
    } as ViewStyle,
    verifiedText: {
      fontSize: 10,
      fontWeight: '700',
    } as TextStyle,
    accountEmail: {
      fontSize: 13,
      marginTop: 2,
    } as TextStyle,
    vaultIdText: {
      fontSize: 11,
      marginTop: 2,
      fontFamily: 'monospace',
    } as TextStyle,
    securityBtnRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
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
    signOutBtn: {
      marginTop: 14,
      borderRadius: 12,
      borderWidth: 1,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    signOutBtnText: {
      fontSize: 13,
      fontWeight: '700',
    } as TextStyle,

    // Unlinked Card
    unlinkedCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 16,
    } as ViewStyle,
    unlinkedRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    } as ViewStyle,
    unlinkedIcon: {
      fontSize: 24,
    } as TextStyle,
    unlinkedTitle: {
      fontSize: 15,
      fontWeight: '700',
    } as TextStyle,
    unlinkedDesc: {
      fontSize: 12,
      lineHeight: 17,
      marginTop: 3,
    } as TextStyle,
    loginBtn: {
      marginTop: 14,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    loginBtnText: {
      color: '#0B0B0E',
      fontSize: 14,
      fontWeight: '700',
    } as TextStyle,

    // Tab Rows
    tabToggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 13,
    } as ViewStyle,
    tabRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: 10,
    } as ViewStyle,
    tabIcon: {
      fontSize: 20,
      marginRight: 12,
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
      fontSize: 15,
      fontWeight: '700',
    } as TextStyle,
    hiddenBadge: {
      fontSize: 11,
      fontWeight: '600',
      fontStyle: 'italic',
    } as TextStyle,
    tabDesc: {
      fontSize: 12,
      marginTop: 2,
    } as TextStyle,

    // Backup & Wi-Fi
    modePillsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    } as ViewStyle,
    modePill: {
      flex: 1,
      borderRadius: 14,
      paddingVertical: 11,
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
      paddingVertical: 12,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      marginBottom: 14,
    } as ViewStyle,
    toggleRowLabel: {
      fontSize: 14,
      fontWeight: '700',
    } as TextStyle,
    toggleRowSub: {
      fontSize: 12,
      marginTop: 2,
      lineHeight: 16,
    } as TextStyle,
    backupStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
    } as ViewStyle,
    backupStatusLabel: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    } as TextStyle,
    backupStatusVal: {
      fontSize: 13,
      fontWeight: '600',
      marginTop: 2,
    } as TextStyle,
    syncMessageText: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 3,
    } as TextStyle,
    manualBackupBtn: {
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 8,
    } as ViewStyle,
    manualBackupBtnText: {
      fontSize: 12,
      fontWeight: '700',
    } as TextStyle,

    // Palettes
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

    // Bottom Button
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
