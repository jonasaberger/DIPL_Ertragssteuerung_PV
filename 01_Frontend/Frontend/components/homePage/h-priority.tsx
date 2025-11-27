import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import Card from '@/components/card'
import DraggableFlatList, {
  RenderItemParams,
} from 'react-native-draggable-flatlist'

export type PriorityItem = {
  id: string
  label: string
}

type Props = {
  priorities: PriorityItem[]
  onDragEnd: (items: PriorityItem[]) => void
}

export default function HPriority({ priorities, onDragEnd }: Props) {
  //Wird aufgerufen wenn die Prioritäten neu angeordnet wurden
  //Data ist die neu geordnete Liste
  const handlePriorityDragEnd = ({ data }: { data: PriorityItem[] }) => {
    onDragEnd(data)
  }

  //braucht man damit die Nummern in der UI richtig angezeigt werden
  const renderPriorityItem = ({
    item,
    drag,
    isActive,
  }: RenderItemParams<PriorityItem>) => {
    //Sucht den aktuellen Index des Items in der Prioritätenliste
    const currentIndex = priorities.findIndex((p) => p.id === item.id)

    return (
      //Hier passiert das eigentliche draggen
      <TouchableOpacity
        onLongPress={drag}
        delayLongPress={120}
        activeOpacity={0.9}
        style={[
          //Style ändert sich wenn es gerade gezogen wird
          styles.priorityRow,
          isActive && styles.priorityRowActive,
        ]}
      >
        <View style={styles.priorityNumber}>
          <Text style={styles.priorityNumberText}>{currentIndex + 1}</Text>
        </View>
        <Text style={styles.priorityLabel}>{item.label}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <Card>
      <Text style={styles.priorityTitle}>Ladeprioritäten</Text>
      <DraggableFlatList
        data={priorities}
        keyExtractor={(item) => item.id}
        renderItem={renderPriorityItem}
        onDragEnd={handlePriorityDragEnd}
        scrollEnabled={false}
        activationDistance={4}
      />
    </Card>
  )
}

const styles = StyleSheet.create({
  priorityTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
    color: '#474646',
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5E5E5',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  priorityRowActive: {
    opacity: 0.9,
  },
  priorityNumber: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 30,
  },
  priorityNumberText: {
    fontSize: 22,
    fontWeight: '700',
  },
  priorityLabel: {
    fontSize: 22,
    fontWeight: '900',
    color: '#474646',
  },
})
