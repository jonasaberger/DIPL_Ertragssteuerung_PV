import React, { useState } from 'react'
import { ScrollView, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'

import SSystemSettings from '@/components/settings/s-device-configs'
import SProtocol from '@/components/settings/s-protocol'
import SDeviceStates from '@/components/settings/s-devicestates'
import SErrorLog from '@/components/settings/s-errorlog'
import SPasswordModal from '@/components/settings/s-passwordmodal'
import { useAuth } from '@/contexts/s-authcontext'
import { verifyAdminPW } from '@/services/setting_services/device-backend_configs/settings_service'

export default function SettingsScreen() {
  const router = useRouter()
  const { password, authorize, deauthorize } = useAuth()// optional für Anzeige

  const authorized = password !== null

  const handleCancel = () => {
    deauthorize()
    router.replace('/')
  }

  const handleSuccess = async (pw: string) => {
    const valid = await verifyAdminPW(pw)
    if (valid) authorize(pw) // Modal verschwindet automatisch
    else Alert.alert('Falsches Passwort')
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        {authorized && (
          <>
            <SSystemSettings/>
            <SProtocol />
            <SDeviceStates />
            <SErrorLog />
          </>
        )}
      </ScrollView>

      <SPasswordModal
        visible={!authorized}
        onCancel={handleCancel}
        onSuccess={handleSuccess}
      />
    </>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16, marginTop: 30, gap: 12 }
})