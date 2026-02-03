import React, { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import SettingsCard from '@/components/settingscard'
import SIPModal from '@/components/settings/s-ipmodal'

type Props = {
  ipAddress: string
  onChangeIpAddress: (next: string) => void
}

export default function SSystemSettings({ ipAddress, onChangeIpAddress }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <SettingsCard title="System- & Backendeinstellungen">
        <TouchableOpacity style={styles.item} activeOpacity={0.85} onPress={() => setOpen(true)}>
          <View style={styles.row}>
            <Text style={styles.label}>IP-Adresse</Text>

            <View style={styles.right}>
              <Text style={styles.value}>{ipAddress}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#474646" />
            </View>
          </View>
        </TouchableOpacity>
      </SettingsCard>

      <SIPModal
        visible={open}
        initialIp={ipAddress}
        onCancel={() => setOpen(false)}
        onConfirm={(ip) => {
          onChangeIpAddress(ip)
          setOpen(false)
        }}
      />
    </>
  )
}

const styles = StyleSheet.create({
  item: {
    backgroundColor: '#d8d8d8',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    fontSize: 18,
    fontWeight: '800',
    color: '#474646',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  value: {
    fontSize: 18,
    fontWeight: '800',
    color: '#474646',
  },
})
