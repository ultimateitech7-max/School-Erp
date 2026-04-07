'use client';

import { useEffect, useState } from 'react';
import type {
  SchoolModuleToggleRecord,
  SchoolModulesFormPayload,
} from '@/utils/api';

interface ModuleToggleListProps {
  modules: SchoolModuleToggleRecord[];
  isSubmitting: boolean;
  onSubmit: (payload: SchoolModulesFormPayload) => Promise<void>;
}

export function ModuleToggleList({
  modules,
  isSubmitting,
  onSubmit,
}: ModuleToggleListProps) {
  const [state, setState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setState(
      modules.reduce<Record<string, boolean>>((accumulator, moduleToggle) => {
        accumulator[moduleToggle.key] = moduleToggle.enabled;
        return accumulator;
      }, {}),
    );
  }, [modules]);

  const handleToggle = (key: string, enabled: boolean) => {
    setState((current) => ({
      ...current,
      [key]: enabled,
    }));
  };

  const handleSubmit = async () => {
    await onSubmit({
      modules: modules.map((moduleToggle) => ({
        key: moduleToggle.key,
        enabled: state[moduleToggle.key] ?? moduleToggle.enabled,
      })),
    });
  };

  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Module Toggles</h2>
          <p className="muted-text">
            Enable or disable school features with clear module visibility.
          </p>
        </div>
        <button
          className="primary-button"
          disabled={isSubmitting}
          onClick={() => void handleSubmit()}
          type="button"
        >
          {isSubmitting ? 'Saving...' : 'Save Module Settings'}
        </button>
      </div>

      <div className="checkbox-grid">
        {modules.map((moduleToggle) => (
          <label className="checkbox-card" key={moduleToggle.key}>
            <input
              checked={state[moduleToggle.key] ?? moduleToggle.enabled}
              type="checkbox"
              onChange={(event) =>
                handleToggle(moduleToggle.key, event.target.checked)
              }
            />
            <span>
              <strong>{moduleToggle.label}</strong>
              <small>{moduleToggle.description}</small>
              <small>
                {moduleToggle.enabled ? 'Currently enabled' : 'Currently disabled'}
              </small>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
