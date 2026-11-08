import * as Network from 'expo-network';

export class NetworkValidationResult {
  public canProceed: boolean = false;
  public isConnected: boolean = false;
  public isWifi: boolean = false;
  public reason: string = '';
  public connectionType: string = 'UNKNOWN';

  constructor(init?: Partial<NetworkValidationResult>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class NetworkConnectivityGuard {
  /**
   * Evaluates network state against user backup configuration constraints (e.g., Wi-Fi only).
   */
  public static async validateBackupNetworkCondition(
    wifiOnly: boolean
  ): Promise<NetworkValidationResult> {
    try {
      const state = await Network.getNetworkStateAsync();
      const isConnected = !!(state.isConnected && state.isInternetReachable !== false);
      const isWifi = state.type === Network.NetworkStateType.WIFI;
      const connectionType = state.type ? String(state.type) : 'UNKNOWN';

      if (!isConnected) {
        return new NetworkValidationResult({
          canProceed: false,
          isConnected: false,
          isWifi,
          connectionType,
          reason: 'No active internet connection detected.',
        });
      }

      if (wifiOnly && !isWifi) {
        return new NetworkValidationResult({
          canProceed: false,
          isConnected: true,
          isWifi: false,
          connectionType,
          reason: 'Wi-Fi only backup enabled. Current connection is metered/cellular.',
        });
      }

      return new NetworkValidationResult({
        canProceed: true,
        isConnected: true,
        isWifi,
        connectionType,
        reason: 'Network conditions satisfied for secure cloud backup.',
      });
    } catch (err: unknown) {
      // In case network query fails, handle gracefully without crash
      const msg = err instanceof Error ? err.message : 'Network check error';
      return new NetworkValidationResult({
        canProceed: !wifiOnly,
        isConnected: true,
        isWifi: false,
        connectionType: 'UNKNOWN',
        reason: `Network verification bypass: ${msg}`,
      });
    }
  }

  /**
   * Helper to quickly check if current connection is Wi-Fi
   */
  public static async isConnectedToWifi(): Promise<boolean> {
    try {
      const state = await Network.getNetworkStateAsync();
      return state.type === Network.NetworkStateType.WIFI;
    } catch {
      return false;
    }
  }
}
