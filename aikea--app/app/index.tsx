import { useAuth } from '@/context/AuthProvider';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export default function IndexScreen() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Attendre un peu pour s'assurer que l'état d'authentification est vérifié
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        router.replace('/(tabs)/admin');
      }
      // Si l'utilisateur n'est pas authentifié, le layout principal s'occupera de la redirection
    }, 100);

    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  // Afficher un loader pendant la vérification
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3498db" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
}); 
