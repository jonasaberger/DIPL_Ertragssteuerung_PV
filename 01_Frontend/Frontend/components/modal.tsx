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

            <View style={styles.divider} />

            <View style={styles.actions}>
              <TouchableOpacity onPress={onCancel} activeOpacity={0.8} style={styles.cancelButton}>
                <Text style={styles.cancel}>{cancelText}</Text>
              </TouchableOpacity>

              <View style={styles.buttonDivider} />

              <TouchableOpacity onPress={onConfirm} activeOpacity={0.8} disabled={confirmDisabled} style={styles.confirmButton}>
                <Text style={[styles.confirm, confirmDisabled && styles.confirmDisabled]}>
                  {confirmText}
                </Text>
              </TouchableOpacity>
            </View>
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
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  title: {
    color: '#474646',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: -16,
    marginTop: 18,
  },
  actions: {
    flexDirection: 'row',
    height: 52,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDivider: {
    width: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 10,
  },
  confirmButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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