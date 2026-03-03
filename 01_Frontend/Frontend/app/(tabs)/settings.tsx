import React, { useEffect, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'

import SDeviceConfigs from '@/components/settings/s-device-configs'
import SProtocol from '@/components/settings/s-protocol'
import SDeviceStates from '@/components/settings/s-devicestates'
import SErrorLog from '@/components/settings/s-errorlog'
import SPasswordModal from '@/components/settings/s-passwordmodal'
import { useAuth } from '@/contexts/s-authcontext'
import { useIsFocused } from '@react-navigation/native'

export default function SettingsScreen() {
  const router = useRouter()
  const { password, authorize, deauthorize } = useAuth()
  const authorized = password !== null

  const isFocused = useIsFocused()
  const [showPwModal, setShowPwModal] = useState(true)

  useEffect(() => {
    if (isFocused) setShowPwModal(true)
  }, [isFocused])

  const handleCancel = () => {
    setShowPwModal(false)
    deauthorize()
    router.replace('/')
  }

  const handleSuccess = (pw: string) => {
    authorize(pw) // Modal verschwindet automatisch
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.container} style={styles.scroll}>
        {authorized && (
          <>
            <SDeviceConfigs />
            <SProtocol />
            <SDeviceStates />
            <SErrorLog />
          </>
        )}
      </ScrollView>

      <SPasswordModal
        visible={isFocused && showPwModal && !authorized}
        onCancel={handleCancel}
        onSuccess={handleSuccess}
      />
    </>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16, marginTop: 30, gap: 12 },
  scroll: {
    flex: 1,
    backgroundColor: '#EDE9E9',
  },
})