import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { verifyAdminPW } from '@/services/settings_service'
import AppModal from '@/components/modal'

type Props = {
  visible: boolean
  onCancel: () => void
  onSuccess: () => void
}

export default function SPasswordModal({ visible, onCancel, onSuccess }: Props) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) return
    setPw('')
    setError('')
  }, [visible])


  return (
    <AppModal
      visible={visible}
      title="Passwort erforderlich"
      onCancel={onCancel}
      onConfirm={async () => {
        const isValid = await verifyAdminPW(pw)
        if (isValid) {
          onSuccess()
        } else {
          setError('Falsches Passwort')
        }
      }}
      confirmDisabled={pw.length === 0}
      cancelText="Abbrechen"
      confirmText="Bestätigen"
    >
      <View style={styles.content}>
        <Text style={styles.label}>Passwort</Text>
        <TextInput
          value={pw}
          onChangeText={(t) => {
            setPw(t)
            if (error) setError('')
          }}
          placeholder="Passwort eingeben"
          placeholderTextColor="#8a8a8a"
          secureTextEntry
          autoFocus
          style={styles.input}
          selectionColor="#474646"
          returnKeyType="done"
          onSubmitEditing={async () => {
            const isValid = await verifyAdminPW(pw)
            if (isValid) {
              onSuccess()
            } else {
              setError('Falsches Passwort')
            }
          }}
        />

        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>
    </AppModal>
  )
}

const styles = StyleSheet.create({
  content: {
    gap: 10,
  },
  label: {
    color: '#474646',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#efefef',
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#474646',
  },
  error: {
    color: '#c0392b',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
})
