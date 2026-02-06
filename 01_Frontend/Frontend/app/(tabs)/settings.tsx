import React, { useCallback, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'

import SSystemSettings from '@/components/settings/s-systemsettings'
import SProtocol from '@/components/settings/s-protocol'
import SDeviceStates from '@/components/settings/s-devicestates'
import SPasswordModal from '@/components/settings/s-passwordmodal'
import { useAuth } from '@/contexts/s-authcontext'

export default function SettingsScreen() {
  const router = useRouter()
  const { password, authorize, deauthorize } = useAuth()

  const [ipAddress, setIpAddress] = useState('192.168.14.67')
  const [askPw, setAskPw] = useState(false)

  const authorized = password !== null

  useFocusEffect(
    useCallback(() => {
      if (!authorized) {
        setAskPw(true)
      }

      return () => {
        setAskPw(false)
        deauthorize()
      }
    }, [authorized, deauthorize])
  )

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        {authorized && (
          <>
            <SSystemSettings
              ipAddress={ipAddress}
              onChangeIpAddress={setIpAddress}
            />

            <SProtocol />

            <SDeviceStates />
          </>
        )}
      </ScrollView>

      <SPasswordModal
        visible={askPw}
        onCancel={() => {
          setAskPw(false)
          router.replace('/')
        }}
        onSuccess={(pw: string) => {
          authorize(pw)
          setAskPw(false)
        }}
      />
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginTop: 30,
    gap: 12,
  },
})