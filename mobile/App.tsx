import React, { useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StripeTerminalProvider } from '@stripe/stripe-terminal-react-native';
import { api } from './src/api/client';
import KioskScreen from './src/screens/KioskScreen';

export default function App() {
  // Called by Stripe Terminal SDK whenever it needs a fresh connection token
  const fetchConnectionToken = useCallback(async () => {
    const { data } = await api.post('/stripe/terminal/connection-token');
    return data.secret;
  }, []);

  return (
    <StripeTerminalProvider
      logLevel="none"
      tokenProvider={fetchConnectionToken}
    >
      <StatusBar hidden />
      <KioskScreen />
    </StripeTerminalProvider>
  );
}
