import React, { useCallback, useRef, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'

import SSystemSettings from '@/components/settings/s-systemsettings'
import SProtocol from '@/components/settings/s-protocol'
import SPasswordModal from '@/components/settings/s-passwordmodal'

export default function SettingsScreen() {
  const router = useRouter()

  const [ipAddress, setIpAddress] = useState('192.168.14.67')

  const [authorized, setAuthorized] = useState(false)
  const [askPw, setAskPw] = useState(false)

  const unlockedThisFocus = useRef(false)

  useFocusEffect(
    useCallback(() => {
      if (!unlockedThisFocus.current) {
        setAuthorized(false)
        setAskPw(true)
      }

      return () => {
        unlockedThisFocus.current = false
        setAuthorized(false)
        setAskPw(false)
      }
    }, [])
  )

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        {authorized ? (
          <>
            <SSystemSettings ipAddress={ipAddress} onChangeIpAddress={setIpAddress} />
            <SProtocol />
          </>
        ) : null}
      </ScrollView>

      <SPasswordModal
        visible={askPw}
        onCancel={() => {
          setAskPw(false)
          router.replace('/')
        }}
        onSuccess={() => {
          unlockedThisFocus.current = true
          setAuthorized(true)
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
