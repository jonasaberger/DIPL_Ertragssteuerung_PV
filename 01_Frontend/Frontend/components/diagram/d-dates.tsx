// components/diagram/d-dates.tsx
import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native'

type Props = {
  selectedDate: Date
  onChangeDate: (date: Date) => void
}

export const DDates: React.FC<Props> = ({ selectedDate, onChangeDate }) => {
  const [isOpen, setIsOpen] = useState(false)

  // temporäre Auswahl im Popup
  const [tempYear, setTempYear] = useState(selectedDate.getFullYear())
  const [tempMonth, setTempMonth] = useState(selectedDate.getMonth()) // 0–11
  const [tempDay, setTempDay] = useState(selectedDate.getDate())

  // wenn Popup geöffnet wird -> mit aktueller Auswahl initialisieren
  const openPopup = () => {
    setTempYear(selectedDate.getFullYear())
    setTempMonth(selectedDate.getMonth())
    setTempDay(selectedDate.getDate())
    setIsOpen(true)
  }

  const closePopup = () => setIsOpen(false)

  const confirmDate = () => {
    const safeDay = Math.min(tempDay, getDaysInMonth(tempYear, tempMonth))
    const newDate = new Date(tempYear, tempMonth, safeDay)
    onChangeDate(newDate)
    setIsOpen(false)
  }

  const formattedLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('de-AT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(selectedDate),
    [selectedDate]
  )

  const daysInMonth = getDaysInMonth(tempYear, tempMonth)
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

  return (
    <View>
      {/* Anzeige-Card-Inhalt */}
      <Text style={styles.label}>Aktuelle Auswahl:</Text>
      <Text style={styles.selectedDateText}>{formattedLabel}</Text>

      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.mainButton]}
          onPress={() => onChangeDate(new Date())}
        >
          <Text style={styles.mainButtonText}>Heute</Text>
        </Pressable>

        <Pressable style={[styles.mainButton]} onPress={openPopup}>
          <Text style={styles.mainButtonText}>Datum auswählen</Text>
        </Pressable>
      </View>

      {/* Popup */}
      <Modal visible={isOpen} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={closePopup}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.modalWrapper}>
          <View style={styles.modalBox}>
            {/* blauer Rand laut Figma */}
            <View style={styles.blueBorder}>
              <View style={styles.innerBox}>
                {/* Jahr-Header */}
                <View style={styles.yearRow}>
                  <Pressable
                    onPress={() => setTempYear((y) => y - 1)}
                    style={styles.yearArrow}
                  >
                    <Text style={styles.yearArrowText}>{'<'}</Text>
                  </Pressable>

                  <Text style={styles.yearText}>{tempYear}</Text>

                  <Pressable
                    onPress={() => setTempYear((y) => y + 1)}
                    style={styles.yearArrow}
                  >
                    <Text style={styles.yearArrowText}>{'>'}</Text>
                  </Pressable>
                </View>

                {/* Monate */}
                <View style={styles.monthGrid}>
                  {months.map((m, index) => (
                    <Pressable
                      key={m}
                      onPress={() => setTempMonth(index)}
                      style={[
                        styles.monthItem,
                        tempMonth === index && styles.monthItemActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.monthText,
                          tempMonth === index && styles.monthTextActive,
                        ]}
                      >
                        {m}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Trennlinie */}
                <View style={styles.separator} />

                {/* Tage */}
                <View style={styles.dayGrid}>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                    (day) => (
                      <Pressable
                        key={day}
                        style={[
                          styles.dayItem,
                          tempDay === day && styles.dayItemActive,
                        ]}
                        onPress={() => setTempDay(day)}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            tempDay === day && styles.dayTextActive,
                          ]}
                        >
                          {day}
                        </Text>
                      </Pressable>
                    )
                  )}
                </View>
              </View>
            </View>

            {/* Footer-Buttons */}
            <View style={styles.footerRow}>
              <Pressable onPress={closePopup}>
                <Text style={styles.footerCancel}>Abbrechen</Text>
              </Pressable>
              <Pressable onPress={confirmDate}>
                <Text style={styles.footerConfirm}>Bestätigen</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

const styles = StyleSheet.create({
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: '#444',
    marginBottom: 4,
  },
  selectedDateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1EAFF3',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  mainButton: {
    flex: 1,
    backgroundColor: '#1EAFF3',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  mainButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  // Popup
  backdrop: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  modalWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalBox: {
    width: '100%',
  },
  blueBorder: {
    borderWidth: 3,
    borderColor: '#1EAFF3',
    borderRadius: 16,
    padding: 4,
    backgroundColor: '#E6F5FF',
  },
  innerBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  yearRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    gap: 24,
  },
  yearArrow: {
    padding: 8,
  },
  yearArrowText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#444',
  },
  yearText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#444',
  },

  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    marginBottom: 10,
  },
  monthItem: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  monthItemActive: {
    backgroundColor: '#1EAFF3',
  },
  monthText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#444',
  },
  monthTextActive: {
    color: '#fff',
  },

  separator: {
    height: 2,
    backgroundColor: '#1EAFF3',
    marginVertical: 8,
  },

  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 4,
    justifyContent: 'flex-start',
  },
  dayItem: {
    width: '14.28%', // 7 Spalten
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 999,
  },
  dayItemActive: {
    backgroundColor: '#1EAFF3',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#444',
  },
  dayTextActive: {
    color: '#fff',
  },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 8,
  },
  footerCancel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  footerConfirm: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1EAFF3',
  },
})
