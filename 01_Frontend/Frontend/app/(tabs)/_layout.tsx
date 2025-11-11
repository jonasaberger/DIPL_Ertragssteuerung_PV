import { Tabs } from 'expo-router';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ICON_SIZE = 50;

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#1EAFF3',
        tabBarInactiveTintColor: '#474646',

        tabBarButton: (props) => {
          const {
            children,
            onPress,
            onLongPress,
            accessibilityState,
            accessibilityLabel,
            testID,
            style,
            delayLongPress,
          } = props;

          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onPress}
              {...(typeof onLongPress === 'function' ? { onLongPress } : {})}
              {...(typeof delayLongPress === 'number' ? { delayLongPress } : {})}
              accessibilityState={accessibilityState}
              accessibilityLabel={accessibilityLabel}
              testID={testID}
              style={[style, { height: '100%', alignItems: 'center', justifyContent: 'center' }]}
            >
              {children}
            </TouchableOpacity>
          );
        },

        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          height: 110 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 6,
          borderTopWidth: 2.5,
          borderTopColor: '#474646',
        },
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: 'bold',
          marginTop: 1,
        },
        // HIER: den 24x24-Wrapper übersteuern
        tabBarIconStyle: {
          width: ICON_SIZE,
          height: ICON_SIZE,
        },

        tabBarIcon: ({ color }) => {
          let iconName: keyof typeof MaterialIcons.glyphMap = 'home';
          if (route.name === 'index') iconName = 'home';
          else if (route.name === 'diagram') iconName = 'bar-chart';
          else if (route.name === 'settings') iconName = 'memory';

          return (
            <View
              style={{
                width: ICON_SIZE,
                height: ICON_SIZE,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialIcons name={iconName} size={ICON_SIZE} color={color} />
            </View>
          );
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Überblick' }} />
      <Tabs.Screen name="diagram" options={{ title: 'Diagramm' }} />
      <Tabs.Screen name="settings" options={{ title: 'Einstellungen' }} />
    </Tabs>
  );
}
