import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native'
import type { DateSelection } from '@/components/diagram/d-dates'

import { CartesianChart, Line, Scatter } from 'victory-native'
import { useFont } from '@shopify/react-native-skia'

type PvPoint = {
  _time: string
  pv_power: number
  load_power: number
  grid_power: number
  battery_power: number

  e_total?: number
  rel_autonomy?: number
  rel_selfconsumption?: number
  soc?: number
}

type Props = {
  selection: DateSelection
  data?: PvPoint[]
  showBattery?: boolean
}

const TEST_DATA: PvPoint[] = [
  {
    "_time": "2026-01-03T00:15:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 525.1,
    "load_power": -525.1,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5.3
  },
  {
    "_time": "2026-01-03T00:30:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 248.8,
    "load_power": -248.8,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5.3
  },
  {
    "_time": "2026-01-03T00:45:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 2708,
    "load_power": -2708,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5.2
  },
  {
    "_time": "2026-01-03T01:00:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 380.4,
    "load_power": -380.4,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5.2
  },
  {
    "_time": "2026-01-03T01:15:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 238.7,
    "load_power": -238.7,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5.2
  },
  {
    "_time": "2026-01-03T01:30:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 231.1,
    "load_power": -231.1,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5.1
  },
  {
    "_time": "2026-01-03T01:45:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 2644,
    "load_power": -2644,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5.1
  },
  {
    "_time": "2026-01-03T02:00:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 213.5,
    "load_power": -213.5,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5.1
  },
  {
    "_time": "2026-01-03T02:15:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 230.1,
    "load_power": -230.1,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5
  },
  {
    "_time": "2026-01-03T02:30:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 1026.2,
    "load_power": -1026.2,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5
  },
  {
    "_time": "2026-01-03T02:45:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 210.6,
    "load_power": -210.6,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5
  },
  {
    "_time": "2026-01-03T03:00:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 162.8,
    "load_power": -162.8,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5
  },
  {
    "_time": "2026-01-03T03:15:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 994.4,
    "load_power": -994.4,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.9
  },
  {
    "_time": "2026-01-03T03:30:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 148.7,
    "load_power": -148.7,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.9
  },
  {
    "_time": "2026-01-03T03:45:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 159.8,
    "load_power": -159.8,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.9
  },
  {
    "_time": "2026-01-03T04:00:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 979.2,
    "load_power": -979.2,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.8
  },
  {
    "_time": "2026-01-03T04:15:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 141.3,
    "load_power": -141.3,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.8
  },
  {
    "_time": "2026-01-03T04:30:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 156.3,
    "load_power": -156.3,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.8
  },
  {
    "_time": "2026-01-03T04:45:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 985.1,
    "load_power": -985.1,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.7
  },
  {
    "_time": "2026-01-03T05:00:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 138.7,
    "load_power": -138.7,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.7
  },
  {
    "_time": "2026-01-03T05:15:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 155.1,
    "load_power": -155.1,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.7
  },
  {
    "_time": "2026-01-03T05:30:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 987.3,
    "load_power": -987.3,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.6
  },
  {
    "_time": "2026-01-03T05:45:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 138.3,
    "load_power": -138.3,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.6
  },
  {
    "_time": "2026-01-03T06:00:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 158.8,
    "load_power": -158.8,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.6
  },
  {
    "_time": "2026-01-03T06:15:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 978.1,
    "load_power": -978.1,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.5
  },
  {
    "_time": "2026-01-03T06:30:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 163.6,
    "load_power": -163.6,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.5
  },
  {
    "_time": "2026-01-03T06:45:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 137.5,
    "load_power": -137.5,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.5
  },
  {
    "_time": "2026-01-03T07:00:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 2610.9,
    "load_power": -2610.9,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.5
  },
  {
    "_time": "2026-01-03T07:15:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 138.4,
    "load_power": -138.4,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.4
  },
  {
    "_time": "2026-01-03T07:30:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 137.6,
    "load_power": -137.6,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.4
  },
  {
    "_time": "2026-01-03T07:45:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 341.3,
    "load_power": -341.3,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.4
  },
  {
    "_time": "2026-01-03T08:00:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 179.5,
    "load_power": -179.5,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.3
  },
  {
    "_time": "2026-01-03T08:15:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 153.2,
    "load_power": -153.2,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.3
  },
  {
    "_time": "2026-01-03T08:30:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 3432.3,
    "load_power": -3432.3,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.3
  },
  {
    "_time": "2026-01-03T08:45:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 151,
    "load_power": -151,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.2
  },
  {
    "_time": "2026-01-03T09:00:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 148.9,
    "load_power": -148.9,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.2
  },
  {
    "_time": "2026-01-03T09:15:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 990.8,
    "load_power": -990.8,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.2
  },
  {
    "_time": "2026-01-03T09:30:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 174.8,
    "load_power": -174.8,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.1
  },
  {
    "_time": "2026-01-03T09:45:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 330.8,
    "load_power": -330.8,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.1
  },
  {
    "_time": "2026-01-03T10:00:00+01:00",
    "battery_power": 0,
    "e_total": 21243985.675277777,
    "grid_power": 3196.6,
    "load_power": -3196.6,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.1
  },
  {
    "_time": "2026-01-03T10:15:00+01:00",
    "battery_power": -503.51611328125,
    "e_total": 21243985.675277777,
    "grid_power": 2148.6,
    "load_power": -1631.0720458984374,
    "pv_power": 24.47303581237793,
    "rel_autonomy": 0,
    "rel_selfconsumption": 100,
    "soc": 4.1
  },
  {
    "_time": "2026-01-03T10:30:00+01:00",
    "battery_power": -500.03857421875,
    "e_total": 21243985.680277776,
    "grid_power": 1247.4,
    "load_power": -738.2261718750001,
    "pv_power": 37.90556716918945,
    "rel_autonomy": 0,
    "rel_selfconsumption": 100,
    "soc": 6
  },
  {
    "_time": "2026-01-03T10:45:00+01:00",
    "battery_power": 0,
    "e_total": 21243986.84888889,
    "grid_power": 603.9,
    "load_power": -603.9,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 6
  },
  {
    "_time": "2026-01-03T11:00:00+01:00",
    "battery_power": 0,
    "e_total": 21243986.85888889,
    "grid_power": 169.5,
    "load_power": -169.5,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 6
  },
  {
    "_time": "2026-01-03T11:15:00+01:00",
    "battery_power": 0,
    "e_total": 21243986.85888889,
    "grid_power": 143.2,
    "load_power": -143.2,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 6
  },
  {
    "_time": "2026-01-03T11:30:00+01:00",
    "battery_power": 0,
    "e_total": 21243986.85888889,
    "grid_power": 752.6,
    "load_power": -752.6,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5.9
  },
  {
    "_time": "2026-01-03T11:45:00+01:00",
    "battery_power": -0.11636099219322205,
    "e_total": 21244020.95027778,
    "grid_power": 667.2,
    "load_power": -956.4058410644532,
    "pv_power": 318.52357482910156,
    "rel_autonomy": 30.238820032986734,
    "rel_selfconsumption": 100,
    "soc": 5.9
  },
  {
    "_time": "2026-01-03T12:00:00+01:00",
    "battery_power": -0.9083418250083923,
    "e_total": 21244091.218055554,
    "grid_power": 296.4,
    "load_power": -604.3689331054687,
    "pv_power": 332.0331115722656,
    "rel_autonomy": 50.95710852028936,
    "rel_selfconsumption": 100,
    "soc": 5.9
  },
  {
    "_time": "2026-01-03T12:15:00+01:00",
    "battery_power": -0.1504099816083908,
    "e_total": 21244167.00972222,
    "grid_power": 382.4,
    "load_power": -695.5791076660156,
    "pv_power": 343.1440887451172,
    "rel_autonomy": 45.02422574434043,
    "rel_selfconsumption": 100,
    "soc": 5.8
  },
  {
    "_time": "2026-01-03T12:30:00+01:00",
    "battery_power": -1.4159170389175415,
    "e_total": 21244245.159722224,
    "grid_power": 1428.7,
    "load_power": -1744.498797607422,
    "pv_power": 344.3203125,
    "rel_autonomy": 18.10255174956495,
    "rel_selfconsumption": 100,
    "soc": 5.8
  },
  {
    "_time": "2026-01-03T12:45:00+01:00",
    "battery_power": -0.6220966577529907,
    "e_total": 21244325.070555557,
    "grid_power": 689.7,
    "load_power": -1020.0900146484375,
    "pv_power": 356.6096649169922,
    "rel_autonomy": 32.38831964866382,
    "rel_selfconsumption": 100,
    "soc": 5.8
  },
  {
    "_time": "2026-01-03T13:00:00+01:00",
    "battery_power": -0.060760948807001114,
    "e_total": 21244406.775,
    "grid_power": 707.1,
    "load_power": -1038.7930236816405,
    "pv_power": 357.05747985839844,
    "rel_autonomy": 31.93061717974097,
    "rel_selfconsumption": 100,
    "soc": 5.7
  },
  {
    "_time": "2026-01-03T13:15:00+01:00",
    "battery_power": -1.0764027833938599,
    "e_total": 21244488.28888889,
    "grid_power": 3281.3,
    "load_power": -3621.0146911621096,
    "pv_power": 367.0415267944336,
    "rel_autonomy": 9.381754014731245,
    "rel_selfconsumption": 100,
    "soc": 5.7
  },
  {
    "_time": "2026-01-03T13:30:00+01:00",
    "battery_power": -1.154301643371582,
    "e_total": 21244571.87361111,
    "grid_power": 632.9,
    "load_power": -974.2569030761719,
    "pv_power": 368.1311340332031,
    "rel_autonomy": 35.03766840125566,
    "rel_selfconsumption": 100,
    "soc": 5.7
  },
  {
    "_time": "2026-01-03T13:45:00+01:00",
    "battery_power": -0.7406191229820251,
    "e_total": 21244656.93,
    "grid_power": 741.7,
    "load_power": -1097.46220703125,
    "pv_power": 377.348876953125,
    "rel_autonomy": 32.4168071348556,
    "rel_selfconsumption": 100,
    "soc": 5.6
  },
  {
    "_time": "2026-01-03T14:00:00+01:00",
    "battery_power": 0.47905969619750977,
    "e_total": 21244743.624166667,
    "grid_power": 1681.1,
    "load_power": -2059.3977294921874,
    "pv_power": 399.08870697021484,
    "rel_autonomy": 18.369337990164208,
    "rel_selfconsumption": 100,
    "soc": 5.6
  },
  {
    "_time": "2026-01-03T14:15:00+01:00",
    "battery_power": -2.1202738285064697,
    "e_total": 21244842.809166666,
    "grid_power": 3168.4,
    "load_power": -3699.89462890625,
    "pv_power": 555.0286254882812,
    "rel_autonomy": 14.365128799988788,
    "rel_selfconsumption": 100,
    "soc": 5.6
  },
  {
    "_time": "2026-01-03T14:30:00+01:00",
    "battery_power": -2.2001636028289795,
    "e_total": 21244976.914444443,
    "grid_power": 559.8,
    "load_power": -1091.276318359375,
    "pv_power": 586.0524291992188,
    "rel_autonomy": 48.70226810734761,
    "rel_selfconsumption": 100,
    "soc": 5.6
  },
  {
    "_time": "2026-01-03T14:45:00+01:00",
    "battery_power": -1.2448539733886719,
    "e_total": 21245115.9525,
    "grid_power": 1502.9,
    "load_power": -2030.5593627929688,
    "pv_power": 560.3932189941406,
    "rel_autonomy": 25.985911688254724,
    "rel_selfconsumption": 100,
    "soc": 5.5
  },
  {
    "_time": "2026-01-03T15:00:00+01:00",
    "battery_power": -2.3780441284179688,
    "e_total": 21245246.50583333,
    "grid_power": 901.7,
    "load_power": -1388.0771362304688,
    "pv_power": 518.8811798095703,
    "rel_autonomy": 35.03963313964659,
    "rel_selfconsumption": 100,
    "soc": 5.5
  },
  {
    "_time": "2026-01-03T15:15:00+01:00",
    "battery_power": 0.48123934864997864,
    "e_total": 21245337.403611112,
    "grid_power": 3501.7,
    "load_power": -3524.048735809326,
    "pv_power": 45.15704345703125,
    "rel_autonomy": 0.6341778302391611,
    "rel_selfconsumption": 100,
    "soc": 5.5
  },
  {
    "_time": "2026-01-03T15:30:00+01:00",
    "battery_power": 1.0225929021835327,
    "e_total": 21245341.387222223,
    "grid_power": 1896,
    "load_power": -1914.5147724151611,
    "pv_power": 40.88371658325195,
    "rel_autonomy": 0.9670738863928817,
    "rel_selfconsumption": 100,
    "soc": 5.4
  },
  {
    "_time": "2026-01-03T15:45:00+01:00",
    "battery_power": 1.1340588331222534,
    "e_total": 21245344.074722223,
    "grid_power": 1274.7,
    "load_power": -1285.9455577850342,
    "pv_power": 32.384583473205566,
    "rel_autonomy": 0.8744971913433095,
    "rel_selfconsumption": 100,
    "soc": 5.4
  },
  {
    "_time": "2026-01-03T16:00:00+01:00",
    "battery_power": 0.13066019117832184,
    "e_total": 21245345.495833334,
    "grid_power": 4693.8,
    "load_power": -4698.506987380982,
    "pv_power": 28.416129112243652,
    "rel_autonomy": 0.10018049124164846,
    "rel_selfconsumption": 100,
    "soc": 5.4
  },
  {
    "_time": "2026-01-03T16:15:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 4619.1,
    "load_power": -4619.1,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5.3
  },
  {
    "_time": "2026-01-03T16:30:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 5125.3,
    "load_power": -5125.3,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5.3
  },
  {
    "_time": "2026-01-03T16:45:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 5160,
    "load_power": -5160,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5.3
  },
  {
    "_time": "2026-01-03T17:00:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 5167.3,
    "load_power": -5167.3,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5.2
  },
  {
    "_time": "2026-01-03T17:15:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 5151.9,
    "load_power": -5151.9,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5.2
  },
  {
    "_time": "2026-01-03T17:30:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 5119.8,
    "load_power": -5119.8,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5.2
  },
  {
    "_time": "2026-01-03T17:45:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 5988.8,
    "load_power": -5988.8,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5.1
  },
  {
    "_time": "2026-01-03T18:00:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 4866.6,
    "load_power": -4866.6,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5.1
  },
  {
    "_time": "2026-01-03T18:15:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 5170.5,
    "load_power": -5170.5,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5.1
  },
  {
    "_time": "2026-01-03T18:30:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 5109.7,
    "load_power": -5109.7,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5.1
  },
  {
    "_time": "2026-01-03T18:45:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 4886.2,
    "load_power": -4886.2,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5
  },
  {
    "_time": "2026-01-03T19:00:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 4755.7,
    "load_power": -4755.7,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5
  },
  {
    "_time": "2026-01-03T19:15:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 9187,
    "load_power": -9187,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 5
  },
  {
    "_time": "2026-01-03T19:30:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 4830.2,
    "load_power": -4830.2,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.9
  },
  {
    "_time": "2026-01-03T19:45:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 5278.8,
    "load_power": -5278.8,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.9
  },
  {
    "_time": "2026-01-03T20:00:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 5261.5,
    "load_power": -5261.5,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.9
  },
  {
    "_time": "2026-01-03T20:15:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 5453.8,
    "load_power": -5453.8,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.8
  },
  {
    "_time": "2026-01-03T20:30:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 5174.1,
    "load_power": -5174.1,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.8
  },
  {
    "_time": "2026-01-03T20:45:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 1374.1,
    "load_power": -1374.1,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.8
  },
  {
    "_time": "2026-01-03T21:00:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 1724.5,
    "load_power": -1724.5,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.7
  },
  {
    "_time": "2026-01-03T21:15:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 886.7,
    "load_power": -886.7,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.7
  },
  {
    "_time": "2026-01-03T21:30:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 885.7,
    "load_power": -885.7,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.7
  },
  {
    "_time": "2026-01-03T21:45:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 1727.1,
    "load_power": -1727.1,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.6
  },
  {
    "_time": "2026-01-03T22:00:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 855.3,
    "load_power": -855.3,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.6
  },
  {
    "_time": "2026-01-03T22:15:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 1128.7,
    "load_power": -1128.7,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.6
  },
  {
    "_time": "2026-01-03T22:30:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 1482.2,
    "load_power": -1482.2,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.5
  },
  {
    "_time": "2026-01-03T22:45:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 959.5,
    "load_power": -959.5,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.5
  },
  {
    "_time": "2026-01-03T23:00:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 945.6,
    "load_power": -945.6,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.5
  },
  {
    "_time": "2026-01-03T23:15:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 3455,
    "load_power": -3455,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.5
  },
  {
    "_time": "2026-01-03T23:30:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 953.3,
    "load_power": -953.3,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.4
  },
  {
    "_time": "2026-01-03T23:45:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 1127.2,
    "load_power": -1127.2,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.4
  },
  {
    "_time": "2026-01-04T00:00:00+01:00",
    "battery_power": 0,
    "e_total": 21245345.6575,
    "grid_power": 725.5,
    "load_power": -725.5,
    "pv_power": 0,
    "rel_autonomy": 0,
    "rel_selfconsumption": 0,
    "soc": 4.4
  }


]

const COLORS = {
  pv: '#1EAFF3',
  load: '#474646',
  feedIn: '#2FBF71',
  battery: '#F39C12',
}

type Mode = 'day' | 'month' | 'year'

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function modeFromSelection(s: DateSelection): Mode {
  if (s.month === null) return 'year'
  if (s.day === null) return 'month'
  return 'day'
}

function apiParamsFromSelection(s: DateSelection): { endpoint: string; query: Record<string, string> } {
  const mode = modeFromSelection(s)
  const y = s.year

  if (mode === 'day') {
    const m = (s.month ?? 0) + 1
    const d = s.day ?? 1
    const date = `${y}-${pad2(m)}-${pad2(d)}`
    return { endpoint: '/api/pv/daily', query: { date } }
  }

  if (mode === 'month') {
    const m = (s.month ?? 0) + 1
    const month = `${y}-${pad2(m)}`
    return { endpoint: '/api/pv/monthly', query: { month } }
  }

  return { endpoint: '/api/pv/yearly', query: { year: String(y) } }
}

function toBatteryWattsMaybe(v: number) {
  if (typeof v !== 'number' || Number.isNaN(v)) return 0
  const abs = Math.abs(v)
  if (abs > 0 && abs < 50) return v * 1000
  return v
}

function fmtW(v: number) {
  const n = Number.isFinite(v) ? v : 0
  return `${Math.round(n)} W`
}

function axisLabelForIso(iso: string, mode: Mode) {
  const d = new Date(iso)

  if (mode === 'day') return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  if (mode === 'month') return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`
  return new Intl.DateTimeFormat('de-AT', { month: 'short' }).format(d)
}

function tooltipLabelForIso(iso: string, mode: Mode) {
  const d = new Date(iso)

  if (mode === 'day') return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`

  const date = `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${String(d.getFullYear()).slice(-2)}`
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`

  if (mode === 'month') return `${date} ${time}`

  const mon = new Intl.DateTimeFormat('de-AT', { month: 'short' }).format(d)
  return `${mon} ${pad2(d.getDate())} ${time}`
}

type ChartRow = {
  x: number
  axisLabel: string
  tipLabel: string
  pv: number
  load: number
  feedIn: number
  battery: number
  t: number
}

type Selected = {
  index: number
  label: string
  pv: number
  load: number
  feedIn: number
  battery: number
}

function monthTickStep(daysInMonth: number) {
  const targetTicks = 10
  const raw = Math.ceil(daysInMonth / targetTicks)
  if (raw <= 2) return 2
  if (raw === 3) return 3
  if (raw === 4) return 4
  return Math.min(7, raw)
}

function getDaysInMonth(year: number, month0Based: number) {
  return new Date(year, month0Based + 1, 0).getDate()
}

export const DDiagram: React.FC<Props> = ({
  selection,
  data = TEST_DATA,
  showBattery = true,
}) => {
  const { width: screenWidth } = useWindowDimensions()
  const font = useFont(require('../../assets/fonts/Inter.ttf'), 11)

  const [selected, setSelected] = useState<Selected | null>(null)

  const mode = useMemo(() => modeFromSelection(selection), [selection])
  const api = useMemo(() => apiParamsFromSelection(selection), [selection])

  const prepared = useMemo(() => {
    const rows: ChartRow[] = (data ?? []).map((p, i) => {
      const pv = Math.max(0, p.pv_power ?? 0)
      const load = Math.max(0, Math.abs(p.load_power ?? 0))

      const gp = p.grid_power ?? 0
      const feedIn = gp < 0 ? Math.abs(gp) : 0

      const battery = Math.max(0, Math.abs(toBatteryWattsMaybe(p.battery_power ?? 0)))

      const t = new Date(p._time).getTime()

      return {
        x: i,
        axisLabel: axisLabelForIso(p._time, mode),
        tipLabel: tooltipLabelForIso(p._time, mode),
        pv,
        load,
        feedIn,
        battery,
        t,
      }
    })

    const maxY = Math.max(
      100,
      ...rows.map(r => r.pv),
      ...rows.map(r => r.load),
      ...rows.map(r => r.feedIn),
      ...(showBattery ? rows.map(r => r.battery) : []),
    )
    const yMax = Math.ceil(maxY / 500) * 500

    return { rows, yMax }
  }, [data, showBattery, mode])

  const title = useMemo(() => {
    if (mode === 'day') return 'Energieverlauf (Tag)'
    if (mode === 'month') return 'Energieverlauf (Monat)'
    return 'Energieverlauf (Jahr)'
  }, [mode])

  const pxPerPoint = mode === 'day' ? 10 : mode === 'month' ? 2.2 : 1.2
  const chartWidth = Math.max(screenWidth, prepared.rows.length * pxPerPoint)

  const padding = { top: 20, bottom: 40, left: 55, right: 20 }
  const plotWidth = Math.max(1, chartWidth - padding.left - padding.right)
  const plotHeight = 260 - padding.top - padding.bottom

  const yKeys = useMemo(() => {
    return showBattery
      ? (['pv', 'load', 'feedIn', 'battery'] as const)
      : (['pv', 'load', 'feedIn'] as const)
  }, [showBattery])

  const selectIndex = useCallback(
    (idx: number) => {
      const row = prepared.rows[idx]
      if (!row) return
      setSelected({
        index: idx,
        label: row.tipLabel,
        pv: row.pv,
        load: row.load,
        feedIn: row.feedIn,
        battery: row.battery,
      })
    },
    [prepared.rows],
  )

  const xTickValues = useMemo(() => {
    const n = prepared.rows.length
    if (n === 0) return []

    if (mode === 'day') {
      const approxLabels = 12
      const stepRaw = Math.max(1, Math.round(n / approxLabels))
      const niceSteps = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96]
      const step = niceSteps.reduce(
        (best, s) => (Math.abs(s - stepRaw) < Math.abs(best - stepRaw) ? s : best),
        niceSteps[0],
      )
      const ticks: number[] = []
      for (let i = 0; i < n; i += step) ticks.push(i)
      return ticks
    }

    if (mode === 'month') {
      const y = selection.year
      const m0 = selection.month ?? 0
      const dim = getDaysInMonth(y, m0)
      const dayStep = monthTickStep(dim)

      const ticks: number[] = []
      for (let i = 0; i < n; i++) {
        const row = prepared.rows[i]
        const d = new Date(row.t)
        const day = d.getDate()
        const hour = d.getHours()
        const min = d.getMinutes()
        if ((day - 1) % dayStep === 0 && hour === 0 && min === 0) ticks.push(i)
      }

      if (ticks.length === 0) {
        const approxLabels = 10
        const step = Math.max(1, Math.round(n / approxLabels))
        for (let i = 0; i < n; i += step) ticks.push(i)
      }

      return ticks
    }

    const ticks: number[] = []
    let lastMonth = -1
    for (let i = 0; i < n; i++) {
      const d = new Date(prepared.rows[i].t)
      const month = d.getMonth()
      const day = d.getDate()
      const hour = d.getHours()
      if (month !== lastMonth && day === 1 && hour === 0) {
        ticks.push(i)
        lastMonth = month
      }
    }

    if (ticks.length === 0) {
      const approxLabels = 12
      const step = Math.max(1, Math.round(n / approxLabels))
      for (let i = 0; i < n; i += step) ticks.push(i)
    }

    return ticks
  }, [prepared.rows, mode, selection.year, selection.month])

  const formatXLabel = useCallback(
    (xIndex: number) => {
      const idx = Math.round(Number(xIndex))
      const r = prepared.rows[idx]
      return r ? r.axisLabel : ''
    },
    [prepared.rows],
  )

  const selectByTap = useCallback(
    (tapXInPlot: number, tapYInPlot: number) => {
      const n = prepared.rows.length
      if (n <= 0) return

      const xClamped = Math.max(0, Math.min(plotWidth, tapXInPlot))
      const yClamped = Math.max(0, Math.min(plotHeight, tapYInPlot))

      const idxGuess = Math.round((xClamped / plotWidth) * (n - 1))
      const yGuessW = (1 - yClamped / plotHeight) * prepared.yMax

      const window = 1

      let best = idxGuess
      let bestScore = Number.POSITIVE_INFINITY

      for (let i = Math.max(0, idxGuess - window); i <= Math.min(n - 1, idxGuess + window); i++) {
        const r = prepared.rows[i]
        const targetW = Math.max(r.load, r.pv, r.feedIn, showBattery ? r.battery : 0)

        const xSteps = Math.abs(i - idxGuess)
        const yNorm = Math.abs(targetW - yGuessW) / 500

        const score = xSteps * 1.3 + yNorm * 1.0
        if (score < bestScore) {
          bestScore = score
          best = i
        }
      }

      const bestRow = prepared.rows[best]
      const bestTarget = Math.max(bestRow.load, bestRow.pv, bestRow.feedIn, showBattery ? bestRow.battery : 0)
      const bestYNorm = Math.abs(bestTarget - yGuessW) / 500
      const bestXSteps = Math.abs(best - idxGuess)

      const ok = bestXSteps <= 1 && bestYNorm <= 2.2
      if (!ok) {
        selectIndex(idxGuess)
        return
      }

      selectIndex(best)
    },
    [prepared.rows, prepared.yMax, plotWidth, plotHeight, selectIndex, showBattery],
  )

  if (!font) return null

  const selectedIndex = selected?.index ?? -1
  const chartHeight = 260

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.legendRow}>
        <LegendDot color={COLORS.pv} label="Erzeugung" />
        <LegendDot color={COLORS.load} label="Hausverbrauch" />
        <LegendDot color={COLORS.feedIn} label="Netzeinspeisung" />
        {showBattery && <LegendDot color={COLORS.battery} label="Batterie" />}
      </View>

      <View style={styles.chartBox}>
        {selected && (
          <>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} />

            <View style={styles.inChartInfo}>
              <View style={styles.infoHeader}>
                <Text style={styles.infoTime} numberOfLines={1}>
                  {selected.label}
                </Text>
                <Pressable onPress={() => setSelected(null)} hitSlop={10}>
                  <Text style={styles.closeX}>×</Text>
                </Pressable>
              </View>

              <InfoLine color={COLORS.pv} label="Erz." value={fmtW(selected.pv)} />
              <InfoLine color={COLORS.load} label="Haus." value={fmtW(selected.load)} />
              <InfoLine color={COLORS.feedIn} label="Netz." value={fmtW(selected.feedIn)} />
              {showBattery && <InfoLine color={COLORS.battery} label="Batt." value={fmtW(selected.battery)} />}
            </View>
          </>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ width: chartWidth }}>
          <View style={{ width: chartWidth, height: chartHeight }}>
            <Pressable
              style={[styles.tapOverlay, { width: chartWidth, height: chartHeight }]}
              onPress={(e) => {
                const x = e.nativeEvent.locationX
                const y = e.nativeEvent.locationY

                const xClipped = Math.max(padding.left, Math.min(chartWidth - padding.right, x))
                const yClipped = Math.max(padding.top, Math.min(chartHeight - padding.bottom, y))

                selectByTap(xClipped - padding.left, yClipped - padding.top)
              }}
            />

            <CartesianChart
              data={prepared.rows}
              xKey="x"
              yKeys={yKeys as any}
              padding={padding}
              domain={{ x: [0, Math.max(1, prepared.rows.length - 1)], y: [0, prepared.yMax] }}
              xAxis={{
                font,
                tickValues: xTickValues,
                formatXLabel,
                labelColor: '#666',
              }}
              yAxis={[
                {
                  font,
                  tickCount: 5,
                  labelColor: '#666',
                  formatYLabel: (v) => `${Math.round(Number(v))} W`,
                },
              ]}
            >
              {({ points }) => {
                const pvPoint = selectedIndex >= 0 ? [points.pv[selectedIndex]] : []
                const loadPoint = selectedIndex >= 0 ? [points.load[selectedIndex]] : []
                const feedInPoint = selectedIndex >= 0 ? [points.feedIn[selectedIndex]] : []
                const batteryPoint = selectedIndex >= 0 ? [points.battery?.[selectedIndex]] : []

                return (
                  <>
                    <Line points={points.pv} color={COLORS.pv} strokeWidth={3} />
                    <Line points={points.load} color={COLORS.load} strokeWidth={3} />
                    <Line points={points.feedIn} color={COLORS.feedIn} strokeWidth={3} />
                    {showBattery && <Line points={points.battery} color={COLORS.battery} strokeWidth={3} />}

                    {selected && (
                      <>
                        <Scatter points={pvPoint} color={COLORS.pv} radius={5} />
                        <Scatter points={loadPoint} color={COLORS.load} radius={5} />
                        <Scatter points={feedInPoint} color={COLORS.feedIn} radius={5} />
                        {showBattery && (
                          <Scatter points={batteryPoint.filter(Boolean) as any} color={COLORS.battery} radius={5} />
                        )}
                      </>
                    )}
                  </>
                )
              }}
            </CartesianChart>
          </View>
        </ScrollView>
      </View>

      <Text style={styles.apiHint} numberOfLines={1}>
        {api.endpoint} {Object.entries(api.query).map(([k, v]) => `${k}=${v}`).join('&')}
      </Text>
    </View>
  )
}

const InfoLine: React.FC<{ color: string; label: string; value: string }> = ({ color, label, value }) => (
  <View style={styles.infoLine}>
    <View style={[styles.infoDot, { backgroundColor: color }]} />
    <Text style={styles.infoLineText} numberOfLines={1}>
      {label} {value}
    </Text>
  </View>
)

const LegendDot: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <View style={styles.legendItem}>
    <View style={[styles.dotLegend, { backgroundColor: color }]} />
    <Text style={styles.legendText}>{label}</Text>
  </View>
)

const styles = StyleSheet.create({
  wrapper: { paddingTop: 8 },
  title: { fontSize: 18, fontWeight: '900', color: '#474646', marginBottom: 10 },

  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dotLegend: { width: 10, height: 10, borderRadius: 999 },
  legendText: { fontSize: 13, fontWeight: '700', color: '#474646' },

  chartBox: {
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
    minHeight: 260,
    width: '100%',
    alignSelf: 'stretch',
  },

  tapOverlay: {
    position: 'absolute',
    zIndex: 3,
    top: 0,
    left: 0,
    backgroundColor: 'transparent',
  },

  inChartInfo: {
    position: 'absolute',
    zIndex: 7,
    top: 10,
    left: 10,
    width: 150,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  infoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  infoTime: { fontSize: 13, fontWeight: '900', color: '#474646', flex: 1, paddingRight: 8 },
  closeX: { fontSize: 18, fontWeight: '900', color: '#474646', lineHeight: 18 },

  infoLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 1 },
  infoDot: { width: 7, height: 7, borderRadius: 999 },
  infoLineText: { fontSize: 12, fontWeight: '800', color: '#474646' },

  apiHint: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
  },
})
