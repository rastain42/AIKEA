import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, Alert, Text, View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleLogin = async () => {
        if (!username || !password) {
            Alert.alert('Erreur', 'Veuillez remplir tous les champs');
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post('http://votre-api-url/api/login', {
                username,
                password
            });

            if (response.data && response.data.token) {
                // Stocker le token de manière sécurisée
                await SecureStore.setItemAsync('auth_token', response.data.token);
                // Stocker le nom d'utilisateur
                await AsyncStorage.setItem('@username', response.data.username || username);
                await AsyncStorage.setItem('@auth_status', 'true');

                // Mettre à jour le contexte d'authentification
                login(username, password);

                // Redirection
                router.replace('/(tabs)/admin');
            } else {
                Alert.alert('Erreur', 'Problème lors de l\'authentification');
            }
        } catch (error) {
            console.error('Erreur de connexion:', error);
            Alert.alert(
                'Erreur de connexion',
                'Identifiants incorrects ou problème de serveur'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Connexion Administrateur</Text>

            <TextInput
                style={styles.input}
                placeholder="Nom d'utilisateur"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                editable={!loading}
            />

            <TextInput
                style={styles.input}
                placeholder="Mot de passe"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
            />

            <TouchableOpacity
                style={[styles.loginButton, loading && styles.disabledButton]}
                onPress={handleLogin}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <Text style={styles.buttonText}>Se connecter</Text>
                )}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 30,
    },
    input: {
        width: '100%',
        height: 50,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        marginBottom: 15,
        paddingHorizontal: 15,
    },
    loginButton: {
        backgroundColor: '#3498db',
        width: '100%',
        padding: 15,
        borderRadius: 5,
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: '#87CEEB',
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
