import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ImageStyle,
  Image,
  Dimensions,
  ScaledSize,
  Switch,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { GoogleSSOUserProfile, UserSettingsConfig } from '../models/NoctisModels';
import { NetworkConnectivityGuard } from '../security/NetworkConnectivityGuard';
import { NoctisTheme, ResponsiveMetrics } from '../theme/NoctisTheme';

export class StealthDriveSyncModalProps {
  public visible: boolean = false;
  public isDark: boolean = true;
  public profile: GoogleSSOUserProfile | null = null;
  public userSettings: UserSettingsConfig = new UserSettingsConfig();
  public isSyncing: boolean = false;
  public syncStatusMessage: string = '';
  public onClose: () => void = () => {};
  public onGoogleLogin: () => void = () => {};
  public onGoogleSignOut: () => void = () => {};
  public onTriggerBackup: (passphrase: string) => void = () => {};
  public onTriggerRestore: (passphrase: string) => void = () => {};
  public onUpdateBackupSettings: (updates: Partial<UserSettingsConfig>) => void = () => {};
}

export class StealthDriveSyncModalState {
  public passphraseInput: string = '';
  public showPassphrase: boolean = false;
  public windowWidth: number = Dimensions.get('window').width;
  public windowHeight: number = Dimensions.get('window').height;
  public isWifi: boolean = false;
  public networkStatusText: string = 'Checking connection...';
}

export class StealthDriveSyncModal extends React.Component<
  StealthDriveSyncModalProps,
  StealthDriveSyncModalState
> {
  private styles = StealthDriveSyncModalStyles.styles;
  private dimensionsSub: { remove: () => void } | null = null;

  constructor(props: StealthDriveSyncModalProps) {
    super(props);
    const win = Dimensions.get('window');
    this.state = {
      passphraseInput: '',
      showPassphrase: false,
      windowWidth: win.width,
      windowHeight: win.height,
      isWifi: false,
      networkStatusText: 'Checking connection...',
    };
  }

  public override componentDidMount(): void {
    this.dimensionsSub = Dimensions.addEventListener('change', this.handleDimensionChange);
    this.refreshNetworkStatus();
  }

  public override componentDidUpdate(prevProps: StealthDriveSyncModalProps): void {
    if (!prevProps.visible && this.props.visible) {
      this.refreshNetworkStatus();
    } else if (prevProps.visible && !this.props.visible) {
      // Zeroize plaintext passphrase from component state when modal closes (OWASP M9)
      this.setState({ passphraseInput: '', showPassphrase: false });
    }
  }

  public override componentWillUnmount(): void {
    if (this.dimensionsSub) {
      this.dimensionsSub.remove();
    }
  }

  private refreshNetworkStatus = async (): Promise<void> => {
    const isWifi = await NetworkConnectivityGuard.isConnectedToWifi();
    const validation = await NetworkConnectivityGuard.validateBackupNetworkCondition(false);
    this.setState({
      isWifi,
      networkStatusText: isWifi
        ? 'Connected to Wi-Fi'
        : validation.isConnected
        ? `Mobile/Cellular Data (${validation.connectionType})`
        : 'Offline (No Internet)',
    });
  };

  private handleDimensionChange = ({ window }: { window: ScaledSize }): void => {
    this.setState({
      windowWidth: window.width,
      windowHeight: window.height,
    });
  };

  private handleBackup = (): void => {
    if (!this.state.passphraseInput || this.state.passphraseInput.length < 8) {
      alert('Secret Recovery Phrase must be at least 8 characters long.');
      return;
    }
    const passphrase = this.state.passphraseInput;
    this.setState({ passphraseInput: '', showPassphrase: false });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    this.props.onTriggerBackup(passphrase);
  };

  private handleRestore = (): void => {
    if (!this.state.passphraseInput || this.state.passphraseInput.length < 8) {
      alert('Please enter your Secret Recovery Phrase to unlock your backup.');
      return;
    }
    const passphrase = this.state.passphraseInput;
    this.setState({ passphraseInput: '', showPassphrase: false });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    this.props.onTriggerRestore(passphrase);
  };

  private setBackupMode = (mode: 'auto' | 'manual'): void => {
    Haptics.selectionAsync();
    this.props.onUpdateBackupSettings({ backupMode: mode });
  };

  private toggleWifiOnly = (value: boolean): void => {
    Haptics.selectionAsync();
    this.props.onUpdateBackupSettings({ backupWifiOnly: value });
  };

  public override render() {
    const palette = NoctisTheme.getColors(this.props.isDark);
    const metrics: ResponsiveMetrics = NoctisTheme.getResponsiveMetrics(
      this.state.windowWidth,
      this.state.windowHeight
    );
    const { profile, isSyncing, syncStatusMessage, userSettings } = this.props;
    const isLargeScreen = metrics.isFoldableOrTablet;

    const backupMode = userSettings.backupMode || 'auto';
    const isWifiOnly = userSettings.backupWifiOnly !== false;

    return (
      <Modal
        visible={this.props.visible}
        animationType="fade"
        transparent={true}
        onRequestClose={this.props.onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[
            this.styles.backdrop,
            {
              backgroundColor: palette.frostOverlay,
              justifyContent: isLargeScreen ? 'center' : 'flex-end',
              alignItems: isLargeScreen ? 'center' : 'stretch',
              padding: isLargeScreen ? 24 : 0,
            },
          ]}
        >
          <BlurView
            intensity={palette.blurIntensity}
            tint={palette.blurTint}
            style={[
              this.styles.modalCard,
              {
                backgroundColor: palette.glassElevated,
                borderColor: palette.glassBorder,
                borderRadius: isLargeScreen ? 32 : 0,
                borderTopLeftRadius: 32,
                borderTopRightRadius: 32,
                maxWidth: isLargeScreen ? 560 : undefined,
                width: isLargeScreen ? '100%' : undefined,
                maxHeight: this.state.windowHeight * 0.88,
              },
            ]}
          >
            <View style={this.styles.topBar}>
              <View>
                <Text style={[this.styles.sheetTitle, { color: palette.textPrimary }]}>
                  Cloud Backup & Security
                </Text>
                <Text style={[this.styles.sheetSubtitle, { color: palette.textMuted }]}>
                  Zero-Knowledge Encryption • Hardware Key Protection
                </Text>
              </View>
              <TouchableOpacity
                onPress={this.props.onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close backup modal"
                style={this.styles.closeBtn}
              >
                <Text style={[this.styles.closeIcon, { color: palette.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={this.styles.scrollContainer}>
              {/* Unauthenticated Security Banner */}
              {!profile && (
                <View
                  style={[
                    this.styles.unauthenticatedShieldCard,
                    {
                      backgroundColor: palette.cardBackground,
                      borderColor: palette.cardBorder,
                    },
                  ]}
                >
                  <View style={this.styles.shieldHeaderRow}>
                    <Text style={this.styles.shieldEmoji}>🛡️</Text>
                    <View style={this.styles.shieldHeaderTextCol}>
                      <Text style={[this.styles.shieldTitle, { color: palette.accent }]}>
                        Hardware-Bound Local Encryption Active
                      </Text>
                      <Text style={[this.styles.shieldSubtitle, { color: palette.textSecondary }]}>
                        Device-unique 256-bit key protected inside hardware keystore
                      </Text>
                    </View>
                  </View>
                  <Text style={[this.styles.shieldBody, { color: palette.textMuted }]}>
                    When not logged in to Google, your reflections and mind maps remain strictly on this device,
                    sealed by a hardware-bound key. No other app, user, or tool can read or decrypt your private data.
                  </Text>
                </View>
              )}

              {/* Profile Section */}
              {profile ? (
                <View
                  style={[
                    this.styles.profileCard,
                    { backgroundColor: palette.cardBackground, borderColor: palette.cardBorder },
                  ]}
                >
                  {profile.picture ? (
                    <Image source={{ uri: profile.picture }} style={this.styles.avatar} />
                  ) : (
                    <View style={[this.styles.avatarFallback, { backgroundColor: palette.accent }]}>
                      <Text style={[this.styles.avatarInitial, { color: palette.accentContrast }]}>
                        {(profile.name || profile.email || 'N').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={this.styles.profileMeta}>
                    <Text style={[this.styles.profileName, { color: palette.textPrimary }]} numberOfLines={1}>
                      {profile.name || 'Verified User'}
                    </Text>
                    <Text style={[this.styles.profileEmail, { color: palette.textSecondary }]} numberOfLines={1}>
                      {profile.email}
                    </Text>
                    <Text style={[this.styles.badgeText, { color: palette.accent }]}>
                      🔒 Google Account Connected
                    </Text>
                  </View>
                  <TouchableOpacity onPress={this.props.onGoogleSignOut} style={this.styles.signOutBtn}>
                    <Text style={[this.styles.signOutText, { color: palette.danger }]}>Sign Out</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View
                  style={[
                    this.styles.ssoPrompt,
                    { backgroundColor: palette.cardBackground, borderColor: palette.cardBorder },
                  ]}
                >
                  <Text style={[this.styles.ssoHeading, { color: palette.textPrimary }]}>
                    Connect Google Account to Back Up
                  </Text>
                  <Text style={[this.styles.ssoBody, { color: palette.textSecondary }]}>
                    Once signed in, your device-encrypted data is securely backed up to your personal Google Drive
                    hidden app folder.
                  </Text>
                  <TouchableOpacity
                    onPress={this.props.onGoogleLogin}
                    style={[this.styles.ssoButton, { backgroundColor: palette.accent }]}
                  >
                    <Text style={[this.styles.ssoButtonText, { color: palette.accentContrast }]}>Continue with Google</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Backup Configuration Section */}
              <View
                style={[
                  this.styles.configCard,
                  { backgroundColor: palette.cardBackground, borderColor: palette.cardBorder },
                ]}
              >
                <Text style={[this.styles.configCardTitle, { color: palette.accent }]}>
                  BACKUP CONFIGURATION
                </Text>

                {/* Auto vs Manual Mode */}
                <View style={this.styles.modeSelectionRow}>
                  <TouchableOpacity
                    onPress={() => this.setBackupMode('auto')}
                    style={[
                      this.styles.modeTab,
                      backupMode === 'auto'
                        ? [this.styles.modeTabActive, { backgroundColor: palette.accent }]
                        : [this.styles.modeTabInactive, { borderColor: palette.cardBorder }],
                    ]}
                  >
                    <Text
                      style={[
                        this.styles.modeTabText,
                        { color: backupMode === 'auto' ? palette.accentContrast : palette.textSecondary },
                      ]}
                    >
                      ⚡ Auto Backup
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => this.setBackupMode('manual')}
                    style={[
                      this.styles.modeTab,
                      backupMode === 'manual'
                        ? [this.styles.modeTabActive, { backgroundColor: palette.accent }]
                        : [this.styles.modeTabInactive, { borderColor: palette.cardBorder }],
                    ]}
                  >
                    <Text
                      style={[
                        this.styles.modeTabText,
                        { color: backupMode === 'manual' ? palette.accentContrast : palette.textSecondary },
                      ]}
                    >
                      🔘 Manual Only
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={[this.styles.configDescription, { color: palette.textMuted }]}>
                  {backupMode === 'auto'
                    ? 'Syncs automatically upon login, data changes, and when moving to the background.'
                    : 'Backs up only when you tap the "Back Up Now" button.'}
                </Text>

                {/* Wi-Fi Only Option */}
                <View style={[this.styles.toggleRow, { borderTopColor: palette.cardBorder }]}>
                  <View style={this.styles.toggleInfo}>
                    <Text style={[this.styles.toggleLabel, { color: palette.textPrimary }]}>
                      Wi-Fi Only Backup
                    </Text>
                    <Text style={[this.styles.toggleHelp, { color: palette.textMuted }]}>
                      Prevent backups over cellular mobile data
                    </Text>
                  </View>
                  <Switch
                    value={isWifiOnly}
                    onValueChange={this.toggleWifiOnly}
                    trackColor={{ false: palette.cardBorder, true: palette.accent }}
                    thumbColor={isWifiOnly ? '#0B0B0E' : '#FFFFFF'}
                  />
                </View>

                {/* Network Status Badge */}
                <View style={[this.styles.networkStatusContainer, { backgroundColor: palette.surface }]}>
                  <Text style={[this.styles.networkStatusDot, { color: this.state.isWifi ? '#10B981' : '#F59E0B' }]}>
                    ●
                  </Text>
                  <Text style={[this.styles.networkStatusLabel, { color: palette.textSecondary }]}>
                    Network: {this.state.networkStatusText}
                  </Text>
                </View>
              </View>

              {/* Secret Recovery Phrase Input */}
              <View style={this.styles.passphraseSection}>
                <Text style={[this.styles.passphraseLabel, { color: palette.textPrimary }]}>
                  Secret Recovery Phrase
                </Text>
                <Text style={[this.styles.passphraseHelp, { color: palette.textMuted }]}>
                  Client-side zero-knowledge passphrase (minimum 8 characters) used to seal your cloud backups.
                </Text>
                <TextInput
                  secureTextEntry={!this.state.showPassphrase}
                  value={this.state.passphraseInput}
                  onChangeText={(txt) => this.setState({ passphraseInput: txt })}
                  placeholder="Enter secret recovery phrase (8+ characters)..."
                  placeholderTextColor={palette.textMuted}
                  style={[
                    this.styles.passphraseInput,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.cardBorder,
                      color: palette.textPrimary,
                    },
                  ]}
                />
              </View>

              {/* Sync Status / Activity */}
              {isSyncing && (
                <View style={this.styles.syncStatusRow}>
                  <ActivityIndicator size="small" color={palette.accent} />
                  <Text style={[this.styles.syncStatusText, { color: palette.accent }]}>
                    {syncStatusMessage || 'Updating your private backup...'}
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={this.styles.actionRow}>
                <TouchableOpacity
                  onPress={this.handleBackup}
                  disabled={isSyncing || !profile}
                  style={[
                    this.styles.actionBtn,
                    {
                      backgroundColor: profile ? palette.accent : palette.surface,
                      opacity: profile && !isSyncing ? 1 : 0.5,
                    },
                  ]}
                >
                  <Text
                    style={[
                      this.styles.actionBtnText,
                      { color: profile ? palette.accentContrast : palette.textMuted },
                    ]}
                  >
                    ↑ Back Up Now
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={this.handleRestore}
                  disabled={isSyncing || !profile}
                  style={[
                    this.styles.actionBtnOutline,
                    {
                      borderColor: profile ? palette.accent : palette.border,
                      opacity: profile && !isSyncing ? 1 : 0.5,
                    },
                  ]}
                >
                  <Text
                    style={[
                      this.styles.actionBtnOutlineText,
                      { color: profile ? palette.accent : palette.textMuted },
                    ]}
                  >
                    ↓ Restore Backup
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </BlurView>
        </KeyboardAvoidingView>
      </Modal>
    );
  }
}

export class StealthDriveSyncModalStyles {
  public static readonly styles = StyleSheet.create({
    backdrop: {
      flex: 1,
    } as ViewStyle,
    modalCard: {
      borderWidth: 1,
      padding: 24,
      overflow: 'hidden',
    } as ViewStyle,
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    } as ViewStyle,
    sheetTitle: {
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: -0.3,
    } as TextStyle,
    sheetSubtitle: {
      fontSize: 12,
      fontWeight: '500',
      marginTop: 2,
    } as TextStyle,
    closeBtn: {
      padding: 6,
    } as ViewStyle,
    closeIcon: {
      fontSize: 22,
      fontWeight: '300',
    } as TextStyle,
    scrollContainer: {
      paddingBottom: 20,
    } as ViewStyle,
    unauthenticatedShieldCard: {
      borderWidth: 1,
      borderRadius: 20,
      padding: 16,
      marginBottom: 18,
    } as ViewStyle,
    shieldHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    } as ViewStyle,
    shieldEmoji: {
      fontSize: 24,
      marginRight: 10,
    } as TextStyle,
    shieldHeaderTextCol: {
      flex: 1,
    } as ViewStyle,
    shieldTitle: {
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 0.2,
    } as TextStyle,
    shieldSubtitle: {
      fontSize: 11,
      marginTop: 2,
    } as TextStyle,
    shieldBody: {
      fontSize: 12,
      lineHeight: 18,
    } as TextStyle,
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 20,
      padding: 14,
      marginBottom: 16,
    } as ViewStyle,
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
    } as ImageStyle,
    avatarFallback: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    } as ViewStyle,
    avatarInitial: {
      color: '#0B0B0E',
      fontSize: 20,
      fontWeight: '700',
    } as TextStyle,
    profileMeta: {
      flex: 1,
      marginLeft: 12,
    } as ViewStyle,
    profileName: {
      fontSize: 16,
      fontWeight: '600',
    } as TextStyle,
    profileEmail: {
      fontSize: 13,
      marginTop: 2,
    } as TextStyle,
    badgeText: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 4,
    } as TextStyle,
    signOutBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
    } as ViewStyle,
    signOutText: {
      fontSize: 12,
      fontWeight: '600',
    } as TextStyle,
    ssoPrompt: {
      borderWidth: 1,
      borderRadius: 20,
      padding: 18,
      marginBottom: 16,
    } as ViewStyle,
    ssoHeading: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 6,
    } as TextStyle,
    ssoBody: {
      fontSize: 13,
      lineHeight: 19,
      marginBottom: 16,
    } as TextStyle,
    ssoButton: {
      borderRadius: 999,
      paddingVertical: 12,
      alignItems: 'center',
    } as ViewStyle,
    ssoButtonText: {
      color: '#0B0B0E',
      fontSize: 15,
      fontWeight: '700',
    } as TextStyle,
    configCard: {
      borderWidth: 1,
      borderRadius: 20,
      padding: 16,
      marginBottom: 18,
    } as ViewStyle,
    configCardTitle: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.2,
      marginBottom: 12,
    } as TextStyle,
    modeSelectionRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 8,
    } as ViewStyle,
    modeTab: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    modeTabActive: {} as ViewStyle,
    modeTabInactive: {
      borderWidth: 1,
    } as ViewStyle,
    modeTabText: {
      fontSize: 13,
      fontWeight: '700',
    } as TextStyle,
    configDescription: {
      fontSize: 12,
      lineHeight: 16,
      marginBottom: 14,
    } as TextStyle,
    toggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: 1,
      marginBottom: 12,
    } as ViewStyle,
    toggleInfo: {
      flex: 1,
      marginRight: 10,
    } as ViewStyle,
    toggleLabel: {
      fontSize: 14,
      fontWeight: '600',
    } as TextStyle,
    toggleHelp: {
      fontSize: 11,
      marginTop: 2,
    } as TextStyle,
    networkStatusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    } as ViewStyle,
    networkStatusDot: {
      fontSize: 12,
      marginRight: 6,
    } as TextStyle,
    networkStatusLabel: {
      fontSize: 12,
      fontWeight: '500',
    } as TextStyle,
    passphraseSection: {
      marginBottom: 18,
    } as ViewStyle,
    passphraseLabel: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
    } as TextStyle,
    passphraseHelp: {
      fontSize: 11,
      lineHeight: 15,
      marginBottom: 8,
    } as TextStyle,
    passphraseInput: {
      borderWidth: 1,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 14,
    } as TextStyle,
    syncStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      gap: 8,
    } as ViewStyle,
    syncStatusText: {
      fontSize: 13,
      fontWeight: '600',
    } as TextStyle,
    actionRow: {
      flexDirection: 'row',
      gap: 12,
    } as ViewStyle,
    actionBtn: {
      flex: 1,
      borderRadius: 999,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    actionBtnText: {
      fontSize: 14,
      fontWeight: '700',
    } as TextStyle,
    actionBtnOutline: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 999,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    actionBtnOutlineText: {
      fontSize: 14,
      fontWeight: '700',
    } as TextStyle,
  });
}
