import { useCallback, useMemo, useState } from 'react'

import {
  readCodexPetSettingsPresetCatalog,
  selectCodexPetSettingsPreset,
  type CodexPetSettingsPresetCatalog,
  type CodexPetSettingsPresetRuntime,
} from './settingsPresets'

export interface CodexPetPresetSession {
  readonly appliedCatalog: CodexPetSettingsPresetCatalog
  readonly catalog: CodexPetSettingsPresetCatalog
  readonly loadGeneration: number
  readonly loadSelectedPreset: () => void
  readonly selectedPresetName: string | null
  readonly selectPreset: (presetName: string | null) => void
  readonly updateCatalog: (catalog: CodexPetSettingsPresetCatalog) => void
}

export function useCodexPetPresetSession(
  runtime: CodexPetSettingsPresetRuntime,
): CodexPetPresetSession {
  const [initialCatalog] = useState(() =>
    readCodexPetSettingsPresetCatalog(undefined, runtime),
  )
  const [catalog, setCatalog] = useState(initialCatalog)
  const [selectedPresetName, setSelectedPresetName] = useState(
    initialCatalog.activePresetName,
  )
  const [appliedPresetName, setAppliedPresetName] = useState<string | null>(
    null,
  )
  const [loadGeneration, setLoadGeneration] = useState(0)

  const appliedCatalog = useMemo<CodexPetSettingsPresetCatalog>(() => ({
    ...catalog,
    activePresetName:
      appliedPresetName && catalog.presets[appliedPresetName]
        ? appliedPresetName
        : null,
  }), [appliedPresetName, catalog])

  const selectPreset = useCallback((presetName: string | null) => {
    const nextSelection =
      presetName && catalog.presets[presetName] ? presetName : null
    setSelectedPresetName(nextSelection)

    if (nextSelection === null) {
      const nextCatalog = selectCodexPetSettingsPreset(null, undefined, runtime)
      setCatalog(nextCatalog)
      setAppliedPresetName(null)
      setLoadGeneration((generation) => generation + 1)
    }
  }, [catalog.presets, runtime])

  const loadSelectedPreset = useCallback(() => {
    if (!selectedPresetName) {
      return
    }

    const nextCatalog = selectCodexPetSettingsPreset(
      selectedPresetName,
      undefined,
      runtime,
    )
    if (!nextCatalog.presets[selectedPresetName]) {
      setCatalog(nextCatalog)
      setSelectedPresetName(null)
      setAppliedPresetName(null)
      setLoadGeneration((generation) => generation + 1)
      return
    }

    setCatalog(nextCatalog)
    setAppliedPresetName(selectedPresetName)
    setLoadGeneration((generation) => generation + 1)
  }, [runtime, selectedPresetName])

  const updateCatalog = useCallback((nextCatalog: CodexPetSettingsPresetCatalog) => {
    setCatalog(nextCatalog)
    setSelectedPresetName(nextCatalog.activePresetName)
    setAppliedPresetName(nextCatalog.activePresetName)
  }, [])

  return {
    appliedCatalog,
    catalog,
    loadGeneration,
    loadSelectedPreset,
    selectedPresetName,
    selectPreset,
    updateCatalog,
  }
}
