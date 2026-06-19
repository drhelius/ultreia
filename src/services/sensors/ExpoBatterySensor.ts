import * as Battery from 'expo-battery';

import type { BatterySensor, BatterySnapshot } from './sensorTypes';

export class ExpoBatterySensor implements BatterySensor {
  async getBatterySnapshot(): Promise<BatterySnapshot | undefined> {
    const generatedAtIso = new Date().toISOString();
    const level = await Battery.getBatteryLevelAsync();
    const lowPowerMode = await Battery.isLowPowerModeEnabledAsync();

    return {
      levelPercent: Math.round(level * 100),
      lowPowerMode,
      evidence: {
        sourceType: 'sensor',
        sourceId: 'expo-battery',
        generatedAtIso,
        confidence: 'alta',
      },
    };
  }
}
