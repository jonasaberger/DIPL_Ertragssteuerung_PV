import React from 'react'
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

type Props = {
  visible: boolean
  title?: string
  children: React.ReactNode
  onCancel: () => void
  onConfirm: () => void
  confirmDisabled?: boolean
  cancelText?: string
  confirmText?: string
}

export default function AppModal({
  visible,
  title,
  children,
  onCancel,
  onConfirm,
  confirmDisabled = false,
  cancelText = 'Abbrechen',
  confirmText = 'Bestätigen',
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.wrap}>
          <View style={styles.popup}>
            {!!title && <Text style={styles.title}>{title}</Text>}
            {children}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity onPress={onCancel} activeOpacity={0.8}>
              <Text style={styles.cancel}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onConfirm} activeOpacity={0.8} disabled={confirmDisabled}>
              <Text style={[styles.confirm, confirmDisabled && styles.confirmDisabled]}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  wrap: {
    width: '100%',
    maxWidth: 420,
  },
  popup: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 3,
    borderColor: '#1e90ff',
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  title: {
    color: '#474646',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  actions: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  cancel: {
    color: '#474646',
    fontSize: 15,
    fontWeight: '700',
  },
  confirm: {
    color: '#1e90ff',
    fontSize: 15,
    fontWeight: '800',
  },
  confirmDisabled: {
    opacity: 0.35,
  },
})
