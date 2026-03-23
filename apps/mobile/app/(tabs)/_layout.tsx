/** * Path: app/(tabs)/_layout.tsx 
 * Description: 4-tab layout. Guests are redirected here via Root Layout.
 */

import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { HapticTab } from '@pallinky/ui';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      // This ensures the logic stays on the tab the user was sent to
      initialRouteName="index"
      screenOptions={{
        tabBarActiveTintColor: '#43691b',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: Platform.select({
          ios: { 
            position: 'absolute',
            backgroundColor: 'rgba(255, 255, 255, 0.9)', 
          },
          default: {},
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="calendar" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarIcon: ({ color }) => <Ionicons name="rocket-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: 'People',
          tabBarIcon: ({ color }) => <Ionicons name="people-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}