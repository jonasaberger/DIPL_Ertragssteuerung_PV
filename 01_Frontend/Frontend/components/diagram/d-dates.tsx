import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native'

export type DateSelection = {
  year: number
  month: number | null
  day: number | null // null = ganzer Monat
}

type Props = {
  selection: DateSelection
  onChangeSelection: (next: DateSelection) => void
}

export const DDates: React.FC<Props> = ({ selection, onChangeSelection }) => {
  const [isOpen, setIsOpen] = useState(false) //Popup offen/zu
  const currentYear = new Date().getFullYear()

  const [tempYear, setTempYear] = useState(selection.year) 
  const [tempMonth, setTempMonth] = useState<number | null>(selection.month)
  const [tempDay, setTempDay] = useState<number | null>(selection.day)

  const openPopup = () => {
    setTempYear(selection.year)
    setTempMonth(selection.month)
    setTempDay(selection.day)
    setIsOpen(true)
  }

  const closePopup = () => setIsOpen(false)

  const confirmSelection = () => {
    let day = tempDay   //tempDay aktuelle Auswahl im Popup
    if (day !== null && tempMonth !== null) {
      const max = getDaysInMonth(tempYear, tempMonth)
      //Schützt vor ungültigen Tagen: Wenn User Jänner 30. wählt und dann auf Februar wechselt,
      //wird der Tag auf 28/29 korrigiert
      day = Math.min(day, max)
    }

    onChangeSelection({
      year: tempYear,
      month: tempMonth,
      day: tempMonth === null ? null : day,
    })
    setIsOpen(false)
  }

  const formattedLabel = useMemo(() => {
    if (selection.month === null) {
      //Anzeige ohne Tag
      return new Intl.DateTimeFormat('de-AT', {
        year: 'numeric',
      }).format(new Date(selection.year, 0, 1))
    }

    if (selection.day === null) {
      //Anzeige ohne Tag
      return new Intl.DateTimeFormat('de-AT', {
        month: 'long',
        year: 'numeric',
      }).format(new Date(selection.year, selection.month, 1))
    }

    //Anzeige mit Monat + Tag
    return new Intl.DateTimeFormat('de-AT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(
      new Date(selection.year, selection.month, selection.day)
    )
  }, [selection])

  const months = [
    'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
  ]

  const daysInMonth = tempMonth === null ? 0 : getDaysInMonth(tempYear, tempMonth)
  const canIncYear = tempYear < currentYear

  const toggleDay = (d: number) => {
    setTempDay(prev => (prev === d ? null : d))
  }

  return (
    <View>
      <Text style={styles.label}>Aktuelle Auswahl:</Text>
      <Text style={styles.selectedDateText}>{formattedLabel}</Text>

      <View style={styles.buttonRow}>
        <Pressable
          style={styles.mainButton}
          onPress={() => {
            const now = new Date()
            onChangeSelection({
              year: now.getFullYear(),
              month: now.getMonth(),
              day: now.getDate(),
            })
          }}
        >
          <Text style={styles.mainButtonText}>Heute</Text>
        </Pressable>

        <Pressable style={styles.mainButton} onPress={openPopup}>
          <Text style={styles.mainButtonText}>Datum auswählen</Text>
        </Pressable>
      </View>

      {/* PopUp */}
      <Modal visible={isOpen} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={closePopup}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.modalWrapper}>
          <View style={styles.modalBox}>
            <View style={styles.blueBorder}>
              <View style={styles.innerBox}>

                {/* Jahr */}
                <View style={styles.yearRow}>
                  <Pressable
                    onPress={() => {
                      setTempYear(y => y - 1)
                      setTempMonth(null)
                      setTempDay(null)
                    }}
                  >
                    <Text style={styles.yearArrow}>{'<'}</Text>
                  </Pressable>

                  <Text style={styles.yearText}>{tempYear}</Text>

                  <Pressable
                    onPress={() => {
                      if (!canIncYear) return
                      setTempYear(y => y + 1)
                      setTempMonth(null)
                      setTempDay(null)
                    }}
                    disabled={!canIncYear}
                  >
                    <Text
                      style={[
                        styles.yearArrow,
                        !canIncYear && styles.disabledText,
                      ]}
                    >
                      {'>'}
                    </Text>
                  </Pressable>
                </View>

                {/* Monate */}
                <View style={styles.monthGrid}>
                  {months.map((m, index) => (
                    <Pressable
                      key={m}
                      style={styles.monthCell}
                      onPress={() => {
                        setTempMonth(prev => {
                          if (prev === index) return null
                          return index
                        })
                        setTempDay(null)
                      }}
                    >
                      <View
                        style={[
                          styles.monthPill,
                          tempMonth === index && styles.activePill,
                        ]}
                      >
                        <Text
                          style={[
                            styles.monthText,
                            tempMonth === index && styles.activeText,
                          ]}
                        >
                          {m}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.separator} />

                {/* Tage */}
                <View style={styles.dayGrid}>
                  {tempMonth !== null &&
                    Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                      <Pressable
                        key={d}
                        style={styles.dayCell}
                        onPress={() => toggleDay(d)}
                      >
                        <View
                          style={[
                            styles.dayPill,
                            tempDay === d && styles.activePill,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayText,
                              tempDay === d && styles.activeText,
                            ]}
                          >
                            {d}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                </View>

              </View>

              {/* Footer */}
              <View style={styles.footerDivider} />
              <View style={styles.footerRow}>
                <Pressable onPress={closePopup} style={styles.footerButton}>
                  <Text style={styles.footerCancel}>Abbrechen</Text>
                </Pressable>

                <View style={styles.footerButtonDivider} />

                <Pressable onPress={confirmSelection} style={styles.footerButton}>
                  <Text style={styles.footerConfirm}>Bestätigen</Text>
                </Pressable>
              </View>

            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
  //Month +1 -> nächster Monat, Tag 0 = letzter Tag des Vormonats
}

const styles = StyleSheet.create({
  label: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
    color: '#474646',
  },
  selectedDateText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1EAFF3',
    marginBottom: 12,
  },

  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  mainButton: {
    flex: 1,
    backgroundColor: '#1EAFF3',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  mainButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  backdrop: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalBox: {
    width: '100%',
  },
  blueBorder: {
    borderWidth: 3,
    borderColor: '#1EAFF3',
    borderRadius: 16,
    backgroundColor: '#E6F5FF',
    overflow: 'hidden',
  },
  innerBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 0,
    padding: 16,
  },

  yearRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
    marginBottom: 12,
  },
  yearText: {
    fontSize: 28,
    fontWeight: '900',
  },
  yearArrow: {
    fontSize: 28,
    fontWeight: '900',
  },

  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthCell: {
    width: '25%',
    alignItems: 'center',
    marginVertical: 6,
  },
  monthPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
  },
  monthText: {
    fontSize: 17,
    fontWeight: '700',
  },

  separator: {
    height: 3,
    backgroundColor: '#1EAFF3',
    marginVertical: 12,
  },

  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    alignItems: 'center',
    marginVertical: 6,
  },
  dayPill: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  dayText: {
    fontSize: 16,
    fontWeight: '700',
  },

  activePill: {
    backgroundColor: '#1EAFF3',
  },
  activeText: {
    color: '#fff',
  },

  footerDivider: {
    height: 1,
    backgroundColor: '#c0dff0',
  },
  footerRow: {
    flexDirection: 'row',
    height: 52,
    backgroundColor: '#E6F5FF',
  },
  footerButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerButtonDivider: {
    width: 1,
    backgroundColor: '#c0dff0',
    marginVertical: 10,
  },
  footerCancel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#474646',
  },
  footerConfirm: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1EAFF3',
  },

  disabledText: {
    opacity: 0.3,
  },
})