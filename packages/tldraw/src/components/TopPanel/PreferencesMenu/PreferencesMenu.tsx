import * as React from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { Divider } from '~components/Primitives/Divider'
import { DMCheckboxItem, DMSubMenu } from '~components/Primitives/DropdownMenu'
import { useTldrawApp } from '~hooks'
import { styled } from '~styles'
import { TDDockPosition, TDExportBackground, TDSnapshot } from '~types'

const settingsSelector = (s: TDSnapshot) => s.settings

const DockPosition = ['bottom', 'left', 'right', 'top']

export function PreferencesMenu() {
  const app = useTldrawApp()
  const intl = useIntl()

  const settings = app.useStore(settingsSelector)

  const toggleDebugMode = React.useCallback(() => {
    app.setSetting('isDebugMode', (v) => !v)
  }, [app])

  const toggleDarkMode = React.useCallback(() => {
    app.setSetting('isDarkMode', (v) => !v)
  }, [app])

  const toggleFocusMode = React.useCallback(() => {
    app.setSetting('isFocusMode', (v) => !v)
  }, [app])

  const toggleGrid = React.useCallback(() => {
    app.setSetting('showGrid', (v) => !v)
  }, [app])

  const toggleSketchAutorun = React.useCallback(() => {
    app.setSetting('sketchAutorun', (v) => !v)
  }, [app])
  const toggleSendUsageData = React.useCallback(() => {
    app.setSetting('sendUsageData', 'Prompt')
  }, [app])
  const toggleSimulationPause = React.useCallback(() => {
    app.setSetting('simulationPause', (v) => !v)
  }, [app])
  const toggleKeepStyleMenuOpen = React.useCallback(() => {
    app.setSetting('keepStyleMenuOpen', (v) => !v)
  }, [app])

  const toggleCadSelectMode = React.useCallback(() => {
    app.setSetting('isCadSelectMode', (v) => !v)
  }, [app])

  const handleChangeDockPosition = React.useCallback(
    (position: TDDockPosition) => {
      app.setSetting('dockPosition', position)
    },
    [app]
  )

  const selectExportBackground = React.useCallback(
    (background: TDExportBackground) => {
      app.setSetting('exportBackground', background)
    },
    [app]
  )

  return (
    <DMSubMenu label={intl.formatMessage({ id: 'menu.preferences' })} id="TD-MenuItem-Preferences">
      <DMCheckboxItem
        checked={settings.sketchAutorun}
        onCheckedChange={toggleSketchAutorun}
        kbd=""
        id="TD-MenuItem-Preferences-SketchAutorun"
      >
        <FormattedMessage id="preferences.sketchAutorun" />
      </DMCheckboxItem>
      <DMCheckboxItem
        checked={settings.simulationPause}
        onCheckedChange={toggleSimulationPause}
        kbd=""
        id="TD-MenuItem-Preferences-SimulationPause"
      >
        <FormattedMessage id="preferences.simulationPause" />
      </DMCheckboxItem>
      <DMCheckboxItem
        checked={settings.sendUsageData == 'Enabled'}
        onCheckedChange={toggleSendUsageData}
        kbd=""
        id="TD-MenuItem-Preferences-SendUsageData"
      >
        <FormattedMessage id="preferences.sendUsageData" />
      </DMCheckboxItem>
      <DMCheckboxItem
        checked={settings.isDarkMode}
        onCheckedChange={toggleDarkMode}
        kbd="#⇧D"
        id="TD-MenuItem-Preferences-Dark_Mode"
      >
        <FormattedMessage id="preferences.dark.mode" />
      </DMCheckboxItem>
      <DMCheckboxItem
        checked={settings.isFocusMode}
        onCheckedChange={toggleFocusMode}
        kbd="#."
        id="TD-MenuItem-Preferences-Focus_Mode"
      >
        <FormattedMessage id="preferences.focus.mode" />
      </DMCheckboxItem>
      <DMCheckboxItem
        checked={settings.isDebugMode}
        onCheckedChange={toggleDebugMode}
        id="TD-MenuItem-Preferences-Debug_Mode"
      >
        <FormattedMessage id="preferences.debug.mode" />
      </DMCheckboxItem>
      <Divider />
      <DMCheckboxItem
        checked={settings.showGrid}
        onCheckedChange={toggleGrid}
        kbd="#⇧G"
        id="TD-MenuItem-Preferences-Grid"
      >
        <FormattedMessage id="preferences.show.grid" />
      </DMCheckboxItem>
      <DMCheckboxItem
        checked={settings.isCadSelectMode}
        onCheckedChange={toggleCadSelectMode}
        id="TD-MenuItem-Preferences-Cad_Selection"
      >
        <FormattedMessage id="preferences.use.cad.selection" />
      </DMCheckboxItem>
      <DMCheckboxItem
        checked={settings.keepStyleMenuOpen}
        onCheckedChange={toggleKeepStyleMenuOpen}
        id="TD-MenuItem-Preferences-Style_menu"
      >
        <FormattedMessage id="preferences.keep.stylemenu.open" />
      </DMCheckboxItem>
      <DMSubMenu label={intl.formatMessage({ id: 'dock.position' })}>
        {DockPosition.map((position) => (
          <DMCheckboxItem
            key={position}
            checked={settings.dockPosition === position}
            onCheckedChange={() => handleChangeDockPosition(position as TDDockPosition)}
            id={`TD-MenuItem-DockPosition-${position}`}
          >
            <StyledText>
              <FormattedMessage id={position} />
            </StyledText>
          </DMCheckboxItem>
        ))}
      </DMSubMenu>
      <DMSubMenu label={intl.formatMessage({ id: 'export.background' })}>
        {Object.values(TDExportBackground).map((exportBackground) => (
          <DMCheckboxItem
            key={exportBackground}
            checked={settings.exportBackground === exportBackground}
            onCheckedChange={() => selectExportBackground(exportBackground as TDExportBackground)}
            id={`TD-MenuItem-ExportBackground-${exportBackground}`}
          >
            <StyledText>
              <FormattedMessage id={exportBackground as string} />
            </StyledText>
          </DMCheckboxItem>
        ))}
      </DMSubMenu>
    </DMSubMenu>
  )
}

const StyledText = styled('span', {
  textTransform: 'capitalize',
})
