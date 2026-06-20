import { NavigationContainer } from '@react-navigation/native';
import { useContext } from 'react';
import {
  ActivityIndicator,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AuthContext, AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import AuthNavigator from './src/navigation/AuthNavigator';

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#111827" />

      <View style={styles.logoBox}>
        <Image
          source={require('./assets/images/logo-fitmap.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <ActivityIndicator size="large" color="#2563EB" />

      <Text style={styles.loadingText}>Carregando FitMap...</Text>
    </View>
  );
}

function Routes() {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#111827" />

      <NavigationContainer>
        {user ? <AppNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 18,
    marginBottom: 24,
    width: '100%',
    maxWidth: 280,
    alignItems: 'center',
  },
  logo: {
    width: 220,
    height: 140,
  },
  loadingText: {
    color: '#D1D5DB',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 14,
  },
});