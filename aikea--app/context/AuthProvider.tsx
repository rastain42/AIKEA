import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

// Configuration de l'URL de l'API
const DEV_API_URL = Platform.select({
    web: 'http://localhost:8080',
    // Adresse IP locale pour le développement mobile
    default: 'http://10.33.77.163:8080'
});

// En production, utilisez votre URL de production
const PROD_API_URL = 'https://votre-api-production.com';

// Utilisez DEV_API_URL en développement, PROD_API_URL en production
const API_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;

// Configuration d'axios avec plus de détails
axios.defaults.baseURL = DEV_API_URL;
axios.defaults.timeout = 10000; // 10 secondes de timeout
axios.defaults.headers.common['Accept'] = 'application/json';
axios.defaults.headers.post['Content-Type'] = 'application/json';

// Intercepteur pour les requêtes
axios.interceptors.request.use(
    (config) => {
        console.log('Requête envoyée:', {
            url: config.url,
            method: config.method,
            headers: config.headers,
            data: config.data
        });
        return config;
    },
    (error) => {
        console.error('Erreur de requête:', error);
        return Promise.reject(error);
    }
);

// Intercepteur pour les réponses
axios.interceptors.response.use(
    (response) => {
        console.log('Réponse reçue:', {
            status: response.status,
            data: response.data
        });
        return response;
    },
    (error) => {
        if (error.response) {
            // La requête a été faite et le serveur a répondu avec un code d'état
            console.error('Erreur de réponse:', {
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers
            });
        } else if (error.request) {
            // La requête a été faite mais aucune réponse n'a été reçue
            console.error('Pas de réponse reçue:', {
                request: error.request,
                message: error.message,
                code: error.code
            });
        } else {
            // Une erreur s'est produite lors de la configuration de la requête
            console.error('Erreur de configuration:', error.message);
        }
        return Promise.reject(error);
    }
);

type AuthContextType = {
    isAuthenticated: boolean;
    username: string | null;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [username, setUsername] = useState<string | null>(null);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                console.log('AuthProvider - Checking authentication status');
                const isAuth = await AsyncStorage.getItem('@auth_status');
                const storedUsername = await AsyncStorage.getItem('@username');
                let token;

                if (Platform.OS === 'web') {
                    token = localStorage.getItem('auth_token');
                } else {
                    token = await SecureStore.getItemAsync('auth_token');
                }

                // Vérifier aussi le token stocké dans AsyncStorage (pour compatibilité)
                if (!token) {
                    token = await AsyncStorage.getItem('token');
                }

                console.log('AuthProvider - Auth check results:', {
                    isAuth,
                    storedUsername,
                    hasToken: !!token,
                    platform: Platform.OS
                });

                if (isAuth === 'true' && token) {
                    console.log('AuthProvider - User is authenticated, setting state');
                    setIsAuthenticated(true);
                    if (storedUsername) {
                        setUsername(storedUsername);
                    }
                } else {
                    console.log('AuthProvider - User is not authenticated');
                    setIsAuthenticated(false);
                    setUsername(null);
                }
            } catch (error) {
                console.error("Erreur lors de la vérification de l'authentification", error);
                setIsAuthenticated(false);
                setUsername(null);
            }
        };

        checkAuth();
    }, []);

    const login = async (username: string, password: string): Promise<boolean> => {
        try {
            console.log('Tentative de connexion à:', `${DEV_API_URL}/api/login`);
            console.log('Plateforme:', Platform.OS);
            console.log('Configuration axios:', {
                baseURL: axios.defaults.baseURL,
                timeout: axios.defaults.timeout,
                headers: axios.defaults.headers
            });

            const response = await axios.post('/api/login', {
                username,
                password
            });

            if (response.data && response.data.token) {
                console.log('Connexion réussie, token reçu');
                // Stockage du token selon la plateforme
                if (Platform.OS === 'web') {
                    localStorage.setItem('auth_token', response.data.token);
                } else {
                    await SecureStore.setItemAsync('auth_token', response.data.token);
                }

                // Stockage des informations d'authentification
                await AsyncStorage.setItem('@auth_status', 'true');
                await AsyncStorage.setItem('@username', username);

                // Configuration du token pour les futures requêtes axios
                axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;

                setUsername(username);
                setIsAuthenticated(true);
                return true;
            }
            return false;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('Erreur de connexion détaillée:', {
                    message: error.message,
                    code: error.code,
                    response: error.response?.data,
                    status: error.response?.status,
                    url: error.config?.url,
                    baseURL: error.config?.baseURL,
                    headers: error.config?.headers
                });
            } else {
                console.error('Erreur lors de la connexion', error);
            }
            return false;
        }
    };

    const logout = async (): Promise<void> => {
        try {
            console.log('AuthProvider - Starting logout process');
            
            // Suppression des informations d'authentification
            await AsyncStorage.removeItem('@auth_status');
            await AsyncStorage.removeItem('@username');
            // Supprimer aussi le token stocké dans AsyncStorage (pour compatibilité)
            await AsyncStorage.removeItem('token');
            console.log('AuthProvider - AsyncStorage cleared');

            // Suppression du token selon la plateforme
            if (Platform.OS === 'web') {
                localStorage.removeItem('auth_token');
                console.log('AuthProvider - Web localStorage cleared');
            } else {
                await SecureStore.deleteItemAsync('auth_token');
                console.log('AuthProvider - Mobile SecureStore cleared');
            }

            // Suppression du token des headers axios
            delete axios.defaults.headers.common['Authorization'];
            console.log('AuthProvider - Axios headers cleared');

            setIsAuthenticated(false);
            setUsername(null);
            console.log('AuthProvider - State updated, logout completed');
        } catch (error) {
            console.error('Erreur lors de la déconnexion', error);
            throw error; // Re-throw pour que l'appelant puisse gérer l'erreur
        }
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, username, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth doit être utilisé à l'intérieur d'un AuthProvider");
    }
    return context;
};
