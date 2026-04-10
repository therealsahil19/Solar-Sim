import { SettingsManager } from '../../src/managers/SettingsManager';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('SettingsManager', () => {
    let storageBackup: any;

    beforeEach(() => {
        storageBackup = { ...localStorage };
        localStorage.clear();
    });

    it('should fall back to defaults when validation fails', () => {
        // Prepare corrupted invalid JSON data in localStorage
        localStorage.setItem('solar_sim_settings', JSON.stringify({
            'textures': 'not-a-boolean',
            'speed': '123'
        }));

        const manager = new SettingsManager();
        
        // It should use defaults instead of types crashing
        expect(manager.get('textures')).toBe(true);
        expect(manager.get('speed')).toBe(1.0);
    });

    it('should propagate errors from notifyListeners', () => {
        const manager = new SettingsManager();
        
        manager.subscribe(() => {
            throw new Error('Listener crashed');
        });

        // The manager rethrows the error synchronously when mutating settings
        expect(() => {
            manager.set('textures', false);
        }).toThrow('Listener crashed');
    });
});
