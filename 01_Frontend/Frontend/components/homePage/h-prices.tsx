import Card from '@/components/card'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import React, { useState } from 'react'
import { 
    StyleSheet, 
    Text, 
    View, 
    TouchableOpacity, 
    TextInput,
    ActivityIndicator 
} from 'react-native'

type Props = {
    date: string
    time: string
    priceRaw: number
    priceOffset: number
    pricePerKWh: number
    available: boolean
    onOffsetUpdate?: (newOffset: number) => Promise<void>
}

export default function HPrices({
    date,
    time,
    priceRaw,
    priceOffset,
    pricePerKWh,
    available,
    onOffsetUpdate
}: Props) {
    const [isEditing, setIsEditing] = useState(false)
    const [editOffset, setEditOffset] = useState(String(Math.round(priceOffset)))
    const [isSaving, setIsSaving] = useState(false)

    const handleSave = async () => {
        const newOffset = parseInt(editOffset)
        if (isNaN(newOffset)) {
            setEditOffset(String(Math.round(priceOffset)))
            setIsEditing(false)
            return
        }

        setIsSaving(true)
        try {
            await onOffsetUpdate?.(newOffset)
            setIsEditing(false)
        } catch (error) {
            console.error('Failed to update offset:', error)
            setEditOffset(String(Math.round(priceOffset)))
        } finally {
            setIsSaving(false)
        }
    }

    const handleCancel = () => {
        setEditOffset(String(Math.round(priceOffset)))
        setIsEditing(false)
    }

    return (
        <Card>
            <View style={styles.priceCard}>
                <View>
                    <Text style={styles.priceTitle}>Strompreis aktuell</Text>

                    <View style={styles.priceMetaRow}>
                        <Text style={styles.priceMetaText}>{date}</Text>
                        <Text style={styles.priceMetaText}>{time}</Text>
                    </View>
                </View>

                {/* Transparente Preisberechnung */}
                <View style={styles.calculationBox}>
                    <View style={styles.calculationRow}>
                        <Text style={styles.calculationLabel}>Börsenpreis</Text>
                        <Text style={styles.calculationValue}>{Math.round(priceRaw)} ¢/kWh</Text>
                    </View>
                    
                    <View style={styles.calculationRow}>
                        <Text style={styles.calculationLabel}>Aufschlag</Text>
                        {isEditing ? (
                            <View style={styles.editRow}>
                                <TextInput
                                    style={styles.offsetInput}
                                    value={editOffset}
                                    onChangeText={setEditOffset}
                                    keyboardType="number-pad"
                                    selectTextOnFocus
                                />
                                <Text style={styles.calculationValue}>¢/kWh</Text>
                            </View>
                        ) : (
                            <TouchableOpacity 
                                style={styles.offsetButton}
                                onPress={() => setIsEditing(true)}
                            >
                                <Text style={styles.calculationValue}>
                                    {Math.round(priceOffset)} ¢/kWh
                                </Text>
                                <MaterialCommunityIcons 
                                    name="pencil" 
                                    size={16} 
                                    color="#1EAFF3" 
                                />
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.calculationRow}>
                        <Text style={styles.totalLabel}>Endpreis</Text>
                        <Text style={styles.totalValue}>{Math.round(pricePerKWh)} ¢/kWh</Text>
                    </View>
                </View>

                {/* Action Buttons beim Editieren */}
                {isEditing && (
                    <View style={styles.actionButtons}>
                        <TouchableOpacity 
                            style={[styles.button, styles.cancelButton]}
                            onPress={handleCancel}
                            disabled={isSaving}
                        >
                            <Text style={styles.cancelButtonText}>Abbrechen</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[styles.button, styles.saveButton]}
                            onPress={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <MaterialCommunityIcons 
                                        name="check" 
                                        size={18} 
                                        color="#fff" 
                                    />
                                    <Text style={styles.saveButtonText}>Speichern</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {!available && (
                    <Text style={styles.offlineInfo}>
                        EPEX-API momentan nicht verfügbar
                    </Text>
                )}
            </View>
        </Card>
    )
}

const styles = StyleSheet.create({
    priceCard: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
    },
    priceTitle: {
        fontSize: 27,
        fontWeight: 'bold',
        color: '#474646',
        marginBottom: 2,
    },
    priceMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    priceMetaText: {
        fontSize: 14,
        color: '#474646',
    },
    calculationBox: {
        backgroundColor: '#F8F9FA',
        borderRadius: 12,
        padding: 14,
        gap: 10,
    },
    calculationRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    calculationLabel: {
        fontSize: 15,
        color: '#666',
    },
    calculationValue: {
        fontSize: 15,
        fontWeight: '600',
        color: '#474646',
    },
    offsetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: '#E8F4FD',
    },
    editRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    offsetInput: {
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#1EAFF3',
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        fontSize: 15,
        fontWeight: '600',
        minWidth: 70,
        textAlign: 'right',
    },
    divider: {
        height: 1,
        backgroundColor: '#D0D5DD',
        marginVertical: 4,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#474646',
    },
    totalValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1EAFF3',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        gap: 6,
    },
    cancelButton: {
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    cancelButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#6B7280',
    },
    saveButton: {
        backgroundColor: '#1EAFF3',
    },
    saveButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
    priceBottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    offlineInfo: {
        marginTop: 4,
        fontSize: 13,
        color: '#9A9A9A',
        fontStyle: 'italic',
    },
})