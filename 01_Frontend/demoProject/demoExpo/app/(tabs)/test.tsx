import React from 'react';
import { StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function TestScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Neue Test-Seite</ThemedText>
      <ThemedText>Hier steht dein Inhalt.</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
});