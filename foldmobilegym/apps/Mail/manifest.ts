import type { AppManifest } from "@/os/types/manifest";
import { IcLauncher } from "./res/icons";
export const manifest: AppManifest = {
  id: "mail",
  packageName: "com.google.android.gm",
  displayName: "Gmail",
  displayNameEn: "Gmail",
  aliases: ["邮件", "邮箱", "谷歌邮箱"],
  version: "1.0.0",
  versionCode: 1,
  type: "plugin",
  icon: IcLauncher,
  iconBackground: "#ffffff",
  iconForeground: "#ea4335",
  queries: [{ action: "ACTION_OPEN_DOCUMENT", type: "*/*" }],
  intentFilters: [{ action: "ACTION_VIEW", scheme: "mailto", route: "/compose/to", description: "Open an independent local email draft" }],
  theme: {
    colors: {
      primary: "#0b57d0",
      primaryDark: "#0842a0",
      background: "#f6f8fc",
      surface: "#fff",
      textPrimary: "#1f1f1f",
      textSecondary: "#5f6368",
      border: "#e0e3e7",
      statusBarForeground: "dark",
      navigationBarForeground: "dark",
    },
  },
};
