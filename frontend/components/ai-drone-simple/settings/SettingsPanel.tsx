import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { DRONE_SETTINGS_THEME } from "../../../src/constants/droneSettingsTheme";
import { SettingRow, type SettingRowConfig } from "./SettingRow";
import { PairedToggleRow, type PairedToggleConfig } from "./PairedToggleRow";

export type SettingsPanelRow =
  | ({ type?: "row" } & SettingRowConfig)
  | {
      type: "paired";
      key: string;
      icon?: string;
      left: PairedToggleConfig;
      right: PairedToggleConfig;
    };

type Props = {
  title: string;
  rows: SettingsPanelRow[];
  footer?: React.ReactNode;
};

export function SettingsPanel({ title, rows, footer }: Props) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{title}</Text>
      {rows.map((row, index) => {
        const showTopBorder = index > 0;
        if (row.type === "paired") {
          return (
            <PairedToggleRow
              key={row.key}
              icon={row.icon}
              left={row.left}
              right={row.right}
              showTopBorder={showTopBorder}
            />
          );
        }
        const { type: _type, ...settingRow } = row;
        return (
          <SettingRow key={settingRow.key} row={settingRow} showTopBorder={showTopBorder} />
        );
      })}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: DRONE_SETTINGS_THEME.panelBg,
    borderColor: DRONE_SETTINGS_THEME.panelBorder,
    borderWidth: 1,
    borderRadius: 16,
    marginTop: 12,
    paddingBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: DRONE_SETTINGS_THEME.label,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
});
