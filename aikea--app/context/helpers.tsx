import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Helper function pour stocker des données de manière sécurisée
export async function saveSecureValue(key: string, value: string) {
    if (Platform.OS === 'web') {
        // Utiliser localStorage comme alternative sur le web
        localStorage.setItem(key, value);
    } else {
        // Utiliser SecureStore sur les appareils mobiles
        await SecureStore.setItemAsync(key, value);
    }
}

// Helper function pour récupérer des données de manière sécurisée
export async function getSecureValue(key: string) {
    if (Platform.OS === 'web') {
        return localStorage.getItem(key);
    } else {
        return await SecureStore.getItemAsync(key);
    }
}

// Helper function pour supprimer des données
export async function deleteSecureValue(key: string) {
    if (Platform.OS === 'web') {
        localStorage.removeItem(key);
    } else {
        await SecureStore.deleteItemAsync(key);
    }
}