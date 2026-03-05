/** * Path: app/(tabs)/_layout.tsx 
 * Description: 4-tab layout updated to new strategy: Hub, Ideas, Launch, and Circles. 
 * Updated: Set active tint to blue-themed '#0077b6' and added 'waves' icon for Ideas. */

import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { HapticTab } from '@pallinky/ui';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0077b6', // Blue tint to match the new 'Fishing' branding
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
          title: 'Hub',
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ideas"
        options={{
          title: 'Ideas',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="waves" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="invite"
        options={{
          title: 'Launch',
          tabBarIcon: ({ color }) => <Ionicons name="rocket-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="circles"
        options={{
          title: 'Circles',
          tabBarIcon: ({ color }) => <Ionicons name="people-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}