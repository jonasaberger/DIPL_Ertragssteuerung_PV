import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { ForecastData } from '@/services/ext_services/weatherforecast_service'

interface HForecastProps {
  data: ForecastData | null
  available?: boolean
}

const SunIcon = ({ size = 18, active }: { size?: number; active: boolean }) => (
  <View style={[sunIconStyles.wrapper, { width: size, height: size }]}>
    {/* Rays */}
    {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
      <View
        key={i}
        style={[
          sunIconStyles.ray,
          {
            transform: [{ rotate: `${deg}deg` }],
            opacity: active ? 1 : 0.3,
            backgroundColor: active ? '#F5A623' : '#999',
          },
        ]}
      />
    ))}
    {/* Core */}
    <View
      style={[
        sunIconStyles.core,
        {
          width: size * 0.45,
          height: size * 0.45,
          borderRadius: size * 0.225,
          backgroundColor: active ? '#F5A623' : '#bbb',
          opacity: active ? 1 : 0.4,
        },
      ]}
    />
  </View>
)

const sunIconStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ray: {
    position: 'absolute',
    width: 2,
    height: '100%',
    borderRadius: 1,
  },
  core: {
    position: 'absolute',
  },
})

const DayBadge = ({
  label,
  active,
  sub,
}: {
  label: string
  active: boolean
  sub?: string
}) => (
  <View style={[badge.container, active ? badge.active : badge.inactive]}>
    <SunIcon size={16} active={active} />
    <View style={badge.textGroup}>
      <Text style={[badge.label, !active && badge.inactiveText]}>{label}</Text>
      {sub ? (
        <Text style={[badge.sub, !active && badge.inactiveText]}>{sub}</Text>
      ) : null}
    </View>
  </View>
)

const badge = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
  },
  active: {
    backgroundColor: '#FFFBF0',
    borderColor: '#F5A62340',
  },
  inactive: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  textGroup: {
    flexShrink: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2C2C2C',
    letterSpacing: 0.3,
  },
  sub: {
    fontSize: 10,
    color: '#F5A623',
    fontWeight: '600',
    marginTop: 1,
  },
  inactiveText: {
    color: '#999',
  },
})

export default function HForecast({ data, available = true }: HForecastProps) {
  return (
    <View style={styles.card}>
      {/* Header row - immer anzeigen */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Solar Prognose</Text>
          {available && data && (
            <View style={styles.sourcePill}>
              <View
                style={[
                  styles.sourceDot,
                  { backgroundColor: data.pv_today ? '#4CAF50' : '#999' },
                ]}
              />
              <Text style={styles.sourceText}>{data.source}</Text>
            </View>
          )}
        </View>

        {/* Peak hour - nur wenn verfügbar und Daten vorhanden */}
        {available && data?.pv_today && (
          <View style={styles.peakRow}>
            <Text style={styles.peakLabel}>Beste Stunde</Text>
            <View style={styles.peakTimeChip}>
              <Text style={styles.peakTime}>{data.best_hour_today} Uhr</Text>
            </View>
          </View>
        )}
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Unavailable State */}
      {!available ? (
        <View style={styles.unavailableContainer}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={28}
            color="#8E8E93"
          />
          <Text style={styles.unavailableTitle}>Prognose nicht verfügbar</Text>
          <Text style={styles.unavailableSubtitle}>
            Verbindung konnte nicht hergestellt werden
          </Text>
        </View>
      ) : !data ? null : (
        /* Day badges */
        <View style={styles.badgeRow}>
          <DayBadge
            label="Heute"
            active={data.pv_today}
            sub={
              data.pv_today
                ? data.pv_hours_today > 0
                  ? `${data.pv_hours_today} Std. Ertrag`
                  : 'Ertrag möglich'
                : 'Kein Ertrag'
            }
          />
          <DayBadge
            label="Morgen"
            active={data.pv_tomorrow}
            sub={data.pv_tomorrow ? 'Ertrag erwartet' : 'Kein Ertrag'}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0EDEA',
  },
  header: {
    gap: 6,
    marginBottom: 11,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  sourceDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  sourceText: {
    fontSize: 10,
    color: '#888',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  peakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  peakLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  peakTimeChip: {
    backgroundColor: '#FFF3DC',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#F5A62330',
  },
  peakTime: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C87D00',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: '#F2EFEC',
    marginBottom: 11,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  unavailableContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 4,
  },
  unavailableTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 2,
  },
  unavailableSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
})