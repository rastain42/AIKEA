import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthProvider';
import { useColorScheme } from '@/hooks/useColorScheme';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { isAuthenticated } = useAuth();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
      }}
    >
      {' '}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Créateur',
          tabBarIcon: ({ color }) => <TabBarIcon name="paint-brush" color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Mes Créations',
          tabBarIcon: ({ color }) => <TabBarIcon name="folder" color={color} />,
          // Masquer l'onglet admin si l'utilisateur n'est pas authentifié
          tabBarStyle: isAuthenticated ? undefined : { display: 'none' },
        }}
      />
    </Tabs>
  );
}
