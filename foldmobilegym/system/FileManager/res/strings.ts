/**
 * FileManager 字符串资源 — 对应 AOSP res/values/strings.xml
 */
export const strings = {
  document_picker_title: '选择附件',
  document_picker_storage: '内部存储',
  document_picker_hint: '仅浏览模拟设备文件，不会访问电脑文件。',
  document_picker_no_request: '请从其他应用的文件选择入口打开此页面。',
  document_picker_refresh: '刷新文件',
  document_picker_empty: '没有可选文件',
  document_picker_stale: '文件已更改或不存在，请刷新后重新选择。',
  document_picker_search: '搜索当前目录中的文件',
  document_picker_back: '返回上一级或取消选择',
  app_name: '文件',

  // ============================================================================
  // Tab bar
  // ============================================================================
  tab_recent: '最近',
  tab_browse: '浏览',
  tab_cloud: '云盘',
  directory_label: '文件目录',
  directory_title: '文件管理',
  directory_settings: '设置',
  directory_favorites: '收藏',
  directory_private: '私密文件',
  favorites_empty: '暂无收藏文件',
  favorites_remove: '取消收藏',
  private_empty: '暂无私密文件',
  private_remove: '取消私密',
  directory_my_files: '我的文件',
  directory_tags: '标签',
  directory_quick_access: '快速访问',
  directory_apps: '应用',
  directory_archives: '压缩包',
  directory_count_prefix: '共',
  directory_sort_time: '按时间排序',
  settings_sync: '文件数据同步',
  settings_enabled: '已开启',
  settings_mobile_data: '使用移动网络数据',
  settings_mobile_data_detail: '未开启 WLAN 时，无限制使用移动数据同步',
  settings_small_images: '过滤小图片',
  settings_small_images_detail: '过滤“浏览”>“图片”中的小图片',
  settings_no_filter: '不过滤',
  settings_hidden_files: '显示隐藏文件',
  settings_hidden_files_detail: '显示以“.”开头的文件和文件夹',
  settings_system_hidden: '显示系统隐藏文件',
  settings_system_hidden_detail: '显示含“.nomedia”的文件夹中的媒体文件',
  settings_auto_collect: '文档自动收藏',
  settings_auto_collect_detail: '自动收藏应用中下载的文档',
  settings_clear_cache: '清除缓存',
  settings_clear_cache_detail: '清除缩略图等临时文件',
  settings_extended: '扩展业务',
  settings_about: '关于',
  settings_cloud_notice: '文件管理器仅使用模拟设备中的本地文件，不连接真实云服务。',

  // ============================================================================
  // Browse home page — categories
  // ============================================================================
  section_file_type: '文件类型',
  section_more: '更多',
  category_documents: '文档',
  category_images: '图片',
  category_videos: '视频',
  category_audio: '音乐',
  category_audio_alt: '音频',
  search_archives: '压缩包',
  search_packages: '安装包',
  search_apps: '应用',
  search_apps_unavailable: '应用筛选暂未支持',
  category_files: '文件',

  // ============================================================================
  // Browse home page — storage
  // ============================================================================
  section_internal_storage: '内部存储',
  internal_storage_device: '内部存储设备',
  item_count_suffix: '项',

  // ============================================================================
  // Folder aliases
  // ============================================================================
  alias_android: '安卓',
  alias_backups: 'ES浏览器备份',
  alias_baidu_netdisk: '百度云',
  alias_dcim: '相册',

  // ============================================================================
  // Selection mode
  // ============================================================================
  selected_count: '已选择${count}项',
  select_items_prompt: '请选择项目',
  select_single_item_required: '请只选择一个项目',

  // ============================================================================
  // Toolbar icon labels
  // ============================================================================
  toolbar_search: '搜索',
  toolbar_filter: '筛选',
  toolbar_more: '更多',
  toolbar_new_folder: '新建文件夹',

  // ============================================================================
  // Bottom action bar
  // ============================================================================
  action_send: '发送',
  action_move: '移动',
  action_delete: '删除',
  action_more: '更多',

  // ============================================================================
  // Action menu options
  // ============================================================================
  menu_copy: '复制',
  menu_set_private: '设为私密',
  toast_private_added: '已设为私密',
  menu_favorite: '收藏',
  menu_rename: '重命名',
  menu_compress: '压缩',
  menu_add_to_widget: '添加到小部件',
  menu_open_with_other_app: '用其他应用打开',
  menu_details: '详情',

  // ============================================================================
  // Dialog — common buttons
  // ============================================================================
  dialog_confirm: '确定',
  dialog_cancel: '取消',
  dialog_got_it: '知道了',
  dialog_invalid_name: '请输入有效名称：不能为 . 或 ..，不能包含 / 或空字符，长度不能超过 255 字节。',
  dialog_operation_failed: '操作未完成，请检查是否重名后重试。',

  // ============================================================================
  // Dialog — delete confirmation
  // ============================================================================
  delete_title: '删除',
  delete_failed_summary: '已删除 ${deleted} 项，${failed} 项未删除。可重试或取消。',
  delete_changed_summary: '已删除 ${deleted} 项；${changed} 项已变化，未删除；${failed} 项操作失败。请关闭后重新选择已变化的项目，失败项可重试。',
  delete_in_progress: '正在删除。关闭窗口不会撤销已经开始的操作。',
  delete_dismiss: '关闭',
  delete_confirm_selected: '确定要删除选中的 ${count} 个项目吗？',
  delete_confirm_folder: '删除文件夹会同时删除该文件夹下的所有文件。确定要删除吗？',
  delete_confirm_file: '确定要删除该文件吗？',

  // ============================================================================
  // Dialog — rename
  // ============================================================================
  rename_title: '重命名',

  // ============================================================================
  // Dialog — new folder
  // ============================================================================
  new_folder_title: '新建文件夹',
  new_folder_placeholder: '文件夹名称',
  new_folder_confirm: '创建',

  // ============================================================================
  // Transfer sheet
  // ============================================================================
  transfer_copy_title: '复制到...',
  transfer_move_title: '移动到...',
  transfer_new_folder: '新建文件夹',
  transfer_no_subfolders: '没有可选的子文件夹',
  transfer_copy_success: '复制成功',
  transfer_copy_failed: '复制失败',
  transfer_move_success: '移动成功',
  transfer_move_failed: '移动失败',

  // ============================================================================
  // File details dialog
  // ============================================================================
  detail_location: '位置：',
  detail_size: '大小：',
  detail_type: '类型：',
  detail_directory: '文件夹',
  detail_type_unavailable: '未提供类型',
  detail_time: '时间：',
  detail_readable: '可读：',
  detail_writable: '可写：',
  detail_hidden: '隐藏：',
  detail_yes: '是',
  detail_no: '否',

  // ============================================================================
  // Toast messages
  // ============================================================================
  toast_deleted_items: '已删除 ${count} 个项目',
  toast_rename_success: '重命名成功',
  toast_rename_failed: '重命名失败',
  toast_paste_success: '粘贴成功',
  toast_paste_failed: '粘贴失败',
  toast_folder_exists: '文件夹已存在',
  toast_folder_created: '文件夹已创建',
  toast_set_private: '已设为私密',
  toast_action_unavailable: '该功能暂未支持',
  toast_added_to_favorites: '已添加到收藏',
  toast_favorite_failed: '收藏失败，文件可能已发生变化',
  toast_send_no_image: '当前仅支持发送图片',
  toast_send_source_changed: '所选文件已改变或不可用，本次未分享。请返回并刷新文件列表后重新选择。',
  toast_send_unavailable: '没有兼容的本地接收应用或无法打开分享，未发送任何内容。',
  toast_compressing: '开始压缩...',
  toast_added: '已添加',
  toast_searching_apps: '正在查找应用...',

  // ============================================================================
  // Clipboard
  // ============================================================================
  clipboard_copied: '已复制',
  clipboard_cut: '已剪切',
  clipboard_item_count: '${count} 项',
  clipboard_paste: '粘贴',

  // ============================================================================
  // Folder page — empty state
  // ============================================================================
  folder_empty: '文件夹为空',

  // ============================================================================
  // Text preview page
  // ============================================================================
  text_preview_no_file: '未选择文件',
  text_preview_loading: '正在打开...',
  text_preview_failed: '无法打开这个文本文件',
  text_preview_empty: '（空文件）',

  // ============================================================================
  // PDF preview page
  // ============================================================================
  pdf_preview_no_file: '未选择文件',
  pdf_preview_loading: '正在打开...',
  pdf_preview_failed: '无法打开这个 PDF 文件',

  // ============================================================================
  // Category page — empty state
  // ============================================================================
  category_empty_prefix: '暂无',
  category_file_count: '${count} 个文件',

  // ============================================================================
  // Cloud page
  // ============================================================================
  cloud_not_connected: '云盘暂未连接',

  // ============================================================================
  // Recent page — date groups
  // ============================================================================
  date_today: '今天',
  date_yesterday: '昨天',
  date_days_ago: '${count}天前',
  date_full: '${year}年${month}月${day}日',

  // ============================================================================
  // Recent page — source labels
  // ============================================================================
  source_screenshot: '截屏录屏',
  source_camera: '相机',
  source_download: '下载',
  source_wechat: '微信',
  source_internal_storage: '内部存储',

  // ============================================================================
  // Template helpers — date formatting
  // ============================================================================
  date_days_ago_suffix: '天前',
  date_year_suffix: '年',
  date_month_suffix: '月',
  date_day_suffix: '日',

  // ============================================================================
  // Template helpers — selection toolbar
  // ============================================================================
  selected_prefix: '已选择',

  // ============================================================================
  // Template helpers — delete dialog
  // ============================================================================
  delete_confirm_prefix: '确定要删除选中的 ',
  delete_confirm_suffix: ' 个项目吗？',

  // ============================================================================
  // Template helpers — toast: deleted items
  // ============================================================================
  toast_deleted_prefix: '已删除 ',
  toast_deleted_suffix: ' 个项目',

  // ============================================================================
  // Category page — file count suffix
  // ============================================================================
  fm_file_count_suffix: ' 个文件',
  search_all: '全部',
  search_back: '返回',
  search_clear: '清除搜索',
  search_filter_label: '文件类型',
  search_placeholder: '搜索文件名',
  search_result_count: '找到 {{count}} 项文件',
  search_no_results: '没有找到匹配的文件',
  search_open_folder: '打开所在文件夹',
} as const;

export type StringKey = keyof typeof strings;
