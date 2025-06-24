import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

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
    // Vérifier si l'utilisateur est déjà authentifié
    const checkAuth = async () => {
      try {
        const isAuth = await AsyncStorage.getItem('@auth_status');
        const storedUsername = await AsyncStorage.getItem('@username');

        if (isAuth === 'true') {
          setIsAuthenticated(true);
          if (storedUsername) {
            setUsername(storedUsername);
          }
        }
      } catch (error) {
        console.error("Erreur lors de la vérification de l'authentification", error);
      }
    };

    checkAuth();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await axios.post('http://localhost:8080/api/login', {
        username,
        password,
      });

      if (response.data && response.data.token) {
        await SecureStore.setItemAsync('auth_token', response.data.token);
        await AsyncStorage.setItem('@auth_status', 'true');
        await AsyncStorage.setItem('@username', username);
        setUsername(username);
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erreur lors de la connexion', error);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem('@auth_status');
      await AsyncStorage.removeItem('@username');
      await SecureStore.deleteItemAsync('auth_token');
      setIsAuthenticated(false);
      setUsername(null);
    } catch (error) {
      console.error('Erreur lors de la déconnexion', error);
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
