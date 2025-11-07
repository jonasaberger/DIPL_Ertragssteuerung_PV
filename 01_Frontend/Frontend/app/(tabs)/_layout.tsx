import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
         tabBarActiveTintColor: '#1EAFF3',   
        tabBarInactiveTintColor: '#474646',  
        headerShown: false,
        tabBarButton: HapticTab,

        tabBarStyle: {
          height: 100 + insets.bottom,   
          backgroundColor: '#FFFFFF',
          paddingTop: 20,                
          paddingBottom: insets.bottom,  
          justifyContent: 'center',    
          borderTopWidth: 2,              
          borderTopColor: '#474646',  
        },

        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '600',
          paddingTop: 5,
        },

      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Überblick',
          tabBarIcon: ({ color }) => <IconSymbol size={45} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="diagram"
        options={{
          title: 'Diagramm',
          tabBarIcon: ({ color }) => <IconSymbol size={45} name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Einstellungen',
          tabBarIcon: ({ color }) => <IconSymbol size={45} name="cpu.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
