import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { StripeTerminalProvider } from '@stripe/stripe-terminal-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './src/api/client';
import KioskScreen from './src/screens/KioskScreen';
import SetupScreen from './src/screens/SetupScreen';

const DARK = '#07131a';
const GOLD = '#ffd166';

export default function App() {
  const [synagogueId, setSynagogueId] = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);

  // On first launch check if synagogue ID is already saved
  useEffect(() => {
    AsyncStorage.getItem('synagogueId').then((id) => {
      setSynagogueId(id);
      setLoading(false);
    });
  }, []);

  const fetchConnectionToken = useCallback(async () => {
    const { data } = await api.post('/stripe/terminal/connection-token');
    return data.secret;
  }, []);

  const handleSetupComplete = useCallback(async (id: string) => {
    await AsyncStorage.setItem('synagogueId', id);
    setSynagogueId(id);
  }, []);

  const handleReset = useCallback(async () => {
    await AsyncStorage.removeItem('synagogueId');
    setSynagogueId(null);
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: DARK, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={GOLD} size="large" />
      </View>
    );
  }

  if (!synagogueId) {
    return (
      <>
        <StatusBar hidden />
        <SetupScreen onComplete={handleSetupComplete} />
      </>
    );
  }

  return (
    <StripeTerminalProvider logLevel="none" tokenProvider={fetchConnectionToken}>
      <StatusBar hidden />
      <KioskScreen synagogueId={synagogueId} onReset={handleReset} />
    </StripeTerminalProvider>
  );
}
