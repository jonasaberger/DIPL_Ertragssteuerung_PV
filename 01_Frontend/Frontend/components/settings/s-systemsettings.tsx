import React, { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import SettingsCard from '@/components/settingscard'
import SIPModal from '@/components/settings/s-ipmodal'
import { setBaseUrl } from '@/services/helper'

type Props = {
  initialIp?: string
  onChangeIpAddress?: (ip: string) => void
}

export default function SSystemSettings({ initialIp, onChangeIpAddress }: Props) {
  const [open, setOpen] = useState(false)
  const [currentIp, setCurrentIp] = useState(initialIp ?? '')

  const handleConfirm = (ip: string) => {
    setBaseUrl(`http://${ip}:5050/api`) // direkt im Helper setzen
    setCurrentIp(ip)
    onChangeIpAddress?.(ip)
    setOpen(false)
  }

  return (
    <>
      <SettingsCard title="System- & Backendeinstellungen">
        <TouchableOpacity
          style={styles.item}
          activeOpacity={0.85}
          onPress={() => setOpen(true)}
        >
          <View style={styles.row}>
            <Text style={styles.label}>Backend-IP</Text>
            <View style={styles.right}>
              <Text style={styles.value}>{currentIp || 'nicht gesetzt'}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#474646" />
            </View>
          </View>
        </TouchableOpacity>
      </SettingsCard>

      <SIPModal
        visible={open}
        initialIp={currentIp}
        onCancel={() => setOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  )
}

const styles = StyleSheet.create({
  item: { backgroundColor: '#eeeeee', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { fontSize: 18, fontWeight: '800', color: '#474646' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  value: { fontSize: 18, fontWeight: '800', color: '#474646' }
})