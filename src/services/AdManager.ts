// src/services/AdManager.ts
import { AdMob, RewardAdPluginEvents, AdmobConsentStatus } from '@capacitor-community/admob';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

// Standard Google Test Ad Unit IDs
const REWARDED_AD_UNIT_ID_ANDROID = 'ca-app-pub-3940256099942544/5224354917';
const REWARDED_AD_UNIT_ID_IOS = 'ca-app-pub-3940256099942544/1712485313';

export class AdManager {
  private static isInitialized = false;
  private static isAdLoaded = false;

  /**
   * Checks if the device has an active internet connection
   */
  public static async isConnected(): Promise<boolean> {
    try {
      const status = await Network.getStatus();
      return status.connected;
    } catch (e) {
      // Fallback for standard web environment
      return navigator.onLine;
    }
  }

  /**
   * Initializes the AdMob SDK (Only executes on Native platforms)
   */
  public static async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('[AdManager] Web Environment: AdMob initialization skipped (running mock fallback).');
      return;
    }

    if (this.isInitialized) return;

    try {
      // Request User Consent first if applicable, then initialize
      await AdMob.initialize({
        requestTrackingAuthorization: true,
        testingDevices: [], // Add physical test device hashes here if needed
        initializeForTesting: true, // Force test ads
      });
      this.isInitialized = true;
      console.log('[AdManager] AdMob Initialized successfully.');
    } catch (error) {
      console.error('[AdManager] AdMob Initialization failed:', error);
    }
  }

  /**
   * Prefetches and loads a rewarded ad to reduce user waiting times
   */
  public static async loadRewardedAd(): Promise<boolean> {
    const isOnline = await this.isConnected();
    if (!isOnline) {
      this.isAdLoaded = false;
      return false;
    }

    if (!Capacitor.isNativePlatform()) {
      // Mock loading on desktop web browser
      this.isAdLoaded = true;
      return true;
    }

    await this.initialize();

    const adId = Capacitor.getPlatform() === 'ios' 
      ? REWARDED_AD_UNIT_ID_IOS 
      : REWARDED_AD_UNIT_ID_ANDROID;

    try {
      await AdMob.prepareRewardVideoAd({
        adId: adId,
        clearPriorAd: true,
      });
      this.isAdLoaded = true;
      console.log('[AdManager] Rewarded Ad Loaded & ready to play.');
      return true;
    } catch (error) {
      console.error('[AdManager] Failed to prepare rewarded ad:', error);
      this.isAdLoaded = false;
      return false;
    }
  }

  /**
   * Plays the prepared rewarded ad.
   * @param onReward callback executed only if the user watches the entire ad.
   * @param onClose callback executed when the ad is closed (regardless of reward).
   */
  public static async showRewardedAd(
    onReward: (rewardType: string, rewardAmount: number) => void,
    onClose: () => void
  ): Promise<void> {
    const isOnline = await this.isConnected();
    if (!isOnline) {
      alert('Network unavailable. Unable to play rewarded ad.');
      onClose();
      return;
    }

    // --- Web/Browser Fallback ---
    if (!Capacitor.isNativePlatform()) {
      console.log('[AdManager] Simulating ad playback in browser...');
      
      // Simulate a 3-second progress timer for simulation
      setTimeout(() => {
        onReward('crystals', 100);
        onClose();
      }, 3000);
      return;
    }

    // --- Native Device Implementation ---
    let rewardReceived = false;

    // Listen to Reward Received event
    const rewardListener = await AdMob.addListener(
      RewardAdPluginEvents.Rewarded,
      (reward) => {
        rewardReceived = true;
        onReward(reward.type, reward.amount);
      }
    );

    // Listen to Dismiss/Close event
    const dismissListener = await AdMob.addListener(
      RewardAdPluginEvents.Dismissed,
      () => {
        rewardListener.remove();
        dismissListener.remove();
        this.isAdLoaded = false;
        
        // Auto-prefetch the next ad for subsequent matches
        this.loadRewardedAd();
        onClose();
      }
    );

    try {
      await AdMob.showRewardVideoAd();
    } catch (error) {
      console.error('[AdManager] Error playing rewarded ad:', error);
      rewardListener.remove();
      dismissListener.remove();
      onClose();
    }
  }
}