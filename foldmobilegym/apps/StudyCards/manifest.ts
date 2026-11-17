import type { AppManifest } from "@/os/types/manifest";
import { IcLauncher } from "./res/icons";
export const manifest: AppManifest = {
  id: "study_cards",
  packageName: "com.quizlet.quizletandroid",
  displayName: "Quizlet",
  displayNameEn: "Quizlet",
  aliases: ["学习卡片", "闪卡", "卡片"],
  version: "1.0.0",
  versionCode: 1,
  type: "plugin",
  icon: IcLauncher,
  iconBackground: "#4255ff",
  iconForeground: "#ffffff",
  theme: {
    colors: {
      primary: "#4255ff",
      primaryDark: "#2e3856",
      background: "#f6f7fb",
      surface: "#fff",
      textPrimary: "#2e3856",
      textSecondary: "#586380",
      border: "#d9dde8",
      statusBarForeground: "dark",
      navigationBarForeground: "dark",
    },
  },
};
