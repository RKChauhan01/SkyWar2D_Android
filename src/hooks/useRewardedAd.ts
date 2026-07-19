// src/hooks/useRewardedAd.ts
import { useState, useEffect } from 'react';
import { AdManager } from '../services/AdManager';
import { Network } from '@capacitor/network';

export function useRewardedAd() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isAdReady, setIsAdReady] = useState<boolean>(false);
  const [isLoadingAd, setIsLoadingAd] = useState<boolean>(false);
  const [isAdPlaying, setIsAdPlaying] = useState<boolean>(false);

  // Monitor Network Status Changes
  useEffect(() => {
    let networkListener: any;

    const setupNetworkMonitoring = async () => {
      const status = await Network.getStatus();
      setIsOnline(status.connected);

      networkListener = await Network.addListener('networkStatusChange', (status) => {
        setIsOnline(status.connected);
      });
    };

    setupNetworkMonitoring();

    return () => {
      if (networkListener) networkListener.remove();
    };
  }, []);

  // Fetch the Ad once connectivity is verified
  useEffect(() => {
    if (isOnline) {
      prefetchAd();
    } else {
      setIsAdReady(false);
    }
  }, [isOnline]);

  const prefetchAd = async () => {
    setIsLoadingAd(true);
    const success = await AdManager.loadRewardedAd();
    setIsAdReady(success);
    setIsLoadingAd(false);
  };

  const watchAd = async (
    onRewardEarned: (type: string, amount: number) => void,
    onCompleted: () => void
  ) => {
    if (!isOnline) return;
    
    setIsAdPlaying(true);
    await AdManager.showRewardedAd(
      (type, amount) => {
        onRewardEarned(type, amount);
      },
      () => {
        setIsAdPlaying(false);
        onCompleted();
      }
    );
  };

  return {
    isOnline,
    isAdReady,
    isLoadingAd,
    isAdPlaying,
    watchAd,
    prefetchAd
  };
}