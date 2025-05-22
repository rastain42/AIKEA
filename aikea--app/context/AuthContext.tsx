import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

type AuthContextType = {
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

// Mock des identifiants pour simplifier
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        // Vérifier si l'utilisateur est déjà authentifié
        const checkAuth = async () => {
            try {
                const isAuth = await AsyncStorage.getItem('@auth_status');
                if (isAuth === 'true') {
                    setIsAuthenticated(true);
                }
            } catch (error) {
                console.error("Erreur lors de la vérification de l'authentification", error);
            }
        };

        checkAuth();
    }, []);

    const login = async (username: string, password: string): Promise<boolean> => {
        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
            try {
                await AsyncStorage.setItem('@auth_status', 'true');
                // Stocker le token de manière sécurisée
                await SecureStore.setItemAsync('auth_token', 'admin_token');
                setIsAuthenticated(true);
                return true;
            } catch (error) {
                console.error('Erreur lors de la connexion', error);
                return false;
            }
        }
        return false;
    };

    const logout = async (): Promise<void> => {
        try {
            await AsyncStorage.removeItem('@auth_status');
            await SecureStore.deleteItemAsync('auth_token');
            setIsAuthenticated(false);
        } catch (error) {
            console.error('Erreur lors de la déconnexion', error);
        }
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
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
