export const strings = {
  app_name: "Quizlet",
  card_count_unit: "个术语",
  create_card: "新建学习卡",
  create_card_title: "添加学习卡",
  study_set: "学习集",
  term: "术语",
  definition: "定义",
  save_card: "添加卡片",
} as const;

export type StringKey = keyof typeof strings;
