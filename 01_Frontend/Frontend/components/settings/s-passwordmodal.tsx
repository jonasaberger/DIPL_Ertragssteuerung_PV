import React, { useEffect, useState, useCallback } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { verifyAdminPW } from '@/services/setting_services/device-backend_configs/settings_service'
import AppModal from '@/components/modal'

type Props = {
  visible: boolean
  onCancel: () => void
  onSuccess: (password: string) => void
}

export default function SPasswordModal({ visible, onCancel, onSuccess }: Props) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!visible) return
    setPw('')
    setError('')
    setSubmitting(false)
  }, [visible])

  const trySubmit = useCallback(async () => {
    if (!pw || submitting) return

    setSubmitting(true)
    setError('')

    try {
      const isValid = await verifyAdminPW(pw)
      if (isValid) {
        onSuccess(pw)
      } else {
        setError('Falsches Passwort')
      }
    } catch (e) {
      // fängt HTTP/Network Fehler ab 
      setError('Falsches Passwort')
    } finally {
      setSubmitting(false)
    }
  }, [pw, submitting, onSuccess])

  return (
    <AppModal
      visible={visible}
      title="Passwort erforderlich"
      onCancel={onCancel}
      onConfirm={trySubmit}
      confirmDisabled={pw.length === 0 || submitting}
      cancelText="Abbrechen"
      confirmText={submitting ? '...' : 'Bestätigen'}
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
          onSubmitEditing={trySubmit}
          editable={!submitting}
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