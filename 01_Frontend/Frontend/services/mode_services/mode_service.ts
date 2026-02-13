import { fetchJson, postJson} from '../helper'

export enum Mode {
    MANUAL = 'MANUAL',
    TIME_CONTROLLED = 'TIME_CONTROLLED',
    AUTOMATIC = 'AUTOMATIC'
}

export interface ModeData {
    mode: Mode
}

export async function fetchModeData() : Promise<ModeData | null> {
    try {
        const data = await fetchJson<any>('/mode')
        const mode = data.mode as Mode
        
        // Validierung
        if (!Object.values(Mode).includes(mode)) {
            console.error('Invalid mode received:', data.mode)
            return null
        }
        
        return { mode }
    }
    catch(error) {
        console.error('Failed to fetch Control-Mode data:', error)
        return null;
    }
}

export async function setModeData(modeData: ModeData) : Promise<boolean> {
    try {
        const mode = modeData.mode;
        console.log('Setting Control-Mode to:', mode)
        await postJson('/mode', { mode })
        return true;
    }
    catch(error) {
        console.error('Failed to set Control-Mode data:', error)
        return false;
    }
}