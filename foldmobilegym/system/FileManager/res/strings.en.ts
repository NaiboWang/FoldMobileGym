import type { StringKey } from './strings';

export const stringsEn: Partial<Record<StringKey, string>> = {
  document_picker_title: 'Select a document',
  document_picker_storage: 'Internal storage',
  document_picker_hint: 'Read-only simulated files. No access to files on your computer.',
  document_picker_no_request: 'Open this picker from another app’s file selection control.',
  document_picker_refresh: 'Refresh files',
  document_picker_empty: 'No matching files',
  document_picker_stale: 'The file changed or no longer exists. Refresh and select again.',
  document_picker_search: 'Search files in this directory',
  document_picker_back: 'Go up or cancel selection',
  app_name: 'Files',

  // ============================================================================
  // Tab bar
  // ============================================================================
  tab_recent: 'Recent',
  tab_browse: 'Browse',
  tab_cloud: 'Cloud',
  directory_label: 'File directory',
  directory_title: 'File Manager',
  directory_settings: 'Settings',
  directory_favorites: 'Favorites',
  directory_private: 'Private files',
  favorites_empty: 'No favorite files',
  favorites_remove: 'Remove favorite',
  private_empty: 'No private files',
  private_remove: 'Remove from private',
  directory_my_files: 'My files',
  directory_tags: 'Tags',
  directory_quick_access: 'Quick access',
  directory_apps: 'Apps',
  directory_archives: 'Archives',
  directory_count_prefix: 'Total',
  directory_sort_time: 'Sort by time',
  settings_sync: 'File data sync',
  settings_enabled: 'Enabled',
  settings_mobile_data: 'Use mobile data',
  settings_mobile_data_detail: 'Allow sync over mobile data when WLAN is unavailable',
  settings_small_images: 'Filter small images',
  settings_small_images_detail: 'Filter small images under Browse > Images',
  settings_no_filter: 'No filtering',
  settings_hidden_files: 'Show hidden files',
  settings_hidden_files_detail: 'Show files and folders beginning with a dot',
  settings_system_hidden: 'Show system-hidden files',
  settings_system_hidden_detail: 'Show media inside folders containing .nomedia',
  settings_auto_collect: 'Auto-collect documents',
  settings_auto_collect_detail: 'Collect documents downloaded by apps',
  settings_clear_cache: 'Clear cache',
  settings_clear_cache_detail: 'Clear thumbnails and temporary files',
  settings_extended: 'Extended services',
  settings_about: 'About',
  settings_cloud_notice: 'File Manager uses only local simulator files and does not connect to a real cloud service.',

  // ============================================================================
  // Browse home page — categories
  // ============================================================================
  section_file_type: 'File types',
  section_more: 'More',
  category_documents: 'Documents',
  category_images: 'Images',
  category_videos: 'Videos',
  category_audio: 'Music',
  category_audio_alt: 'Audio',
  search_archives: 'Archives',
  search_packages: 'Installers',
  search_apps: 'Apps',
  search_apps_unavailable: 'App filtering is not supported yet',
  category_files: 'Files',

  // ============================================================================
  // Browse home page — storage
  // ============================================================================
  section_internal_storage: 'Internal storage',
  internal_storage_device: 'Internal storage',
  item_count_suffix: ' items',

  // ============================================================================
  // Folder aliases
  // ============================================================================
  alias_android: 'Android',
  alias_backups: 'ES File Explorer Backup',
  alias_baidu_netdisk: 'Baidu Netdisk',
  alias_dcim: 'Camera Roll',

  // ============================================================================
  // Selection mode
  // ============================================================================
  selected_count: '${count} selected',
  select_items_prompt: 'Select items',
  select_single_item_required: 'Please select only one item',

  // ============================================================================
  // Toolbar icon labels
  // ============================================================================
  toolbar_search: 'Search',
  toolbar_filter: 'Filter',
  toolbar_more: 'More',
  toolbar_new_folder: 'New folder',

  // ============================================================================
  // Bottom action bar
  // ============================================================================
  action_send: 'Send',
  action_move: 'Move',
  action_delete: 'Delete',
  action_more: 'More',

  // ============================================================================
  // Action menu options
  // ============================================================================
  menu_copy: 'Copy',
  menu_set_private: 'Set as private',
  toast_private_added: 'Set as private',
  menu_favorite: 'Favorite',
  menu_rename: 'Rename',
  menu_compress: 'Compress',
  menu_add_to_widget: 'Add to widget',
  menu_open_with_other_app: 'Open with other app',
  menu_details: 'Details',

  // ============================================================================
  // Dialog — common buttons
  // ============================================================================
  dialog_confirm: 'OK',
  dialog_cancel: 'Cancel',
  dialog_got_it: 'Got it',
  dialog_invalid_name: 'Enter a valid name: not . or .., no / or null characters, and at most 255 UTF-8 bytes.',
  dialog_operation_failed: 'Operation did not complete. Check for a name conflict and try again.',

  // ============================================================================
  // Dialog — delete confirmation
  // ============================================================================
  delete_title: 'Delete',
  delete_failed_summary: 'Deleted ${deleted} items; ${failed} failed. Retry or cancel.',
  delete_changed_summary: 'Deleted ${deleted}; ${changed} changed and were not deleted; ${failed} failed. Close and reselect changed items; failed items can be retried.',
  delete_in_progress: 'Deleting. Closing this window does not undo operations already started.',
  delete_dismiss: 'Close',
  delete_confirm_selected: 'Are you sure you want to delete ${count} selected items?',
  delete_confirm_folder: 'Deleting a folder will also delete all files inside it. Are you sure?',
  delete_confirm_file: 'Are you sure you want to delete this file?',

  // ============================================================================
  // Dialog — rename
  // ============================================================================
  rename_title: 'Rename',

  // ============================================================================
  // Dialog — new folder
  // ============================================================================
  new_folder_title: 'New folder',
  new_folder_placeholder: 'Folder name',
  new_folder_confirm: 'Create',

  // ============================================================================
  // Transfer sheet
  // ============================================================================
  transfer_copy_title: 'Copy to...',
  transfer_move_title: 'Move to...',
  transfer_new_folder: 'New folder',
  transfer_no_subfolders: 'No subfolders available',
  transfer_copy_success: 'Copied successfully',
  transfer_copy_failed: 'Copy failed',
  transfer_move_success: 'Moved successfully',
  transfer_move_failed: 'Move failed',

  // ============================================================================
  // File details dialog
  // ============================================================================
  detail_location: 'Location: ',
  detail_size: 'Size: ',
  detail_type: 'Type: ',
  detail_directory: 'Folder',
  detail_type_unavailable: 'Type not provided',
  detail_time: 'Date: ',
  detail_readable: 'Readable: ',
  detail_writable: 'Writable: ',
  detail_hidden: 'Hidden: ',
  detail_yes: 'Yes',
  detail_no: 'No',

  // ============================================================================
  // Toast messages
  // ============================================================================
  toast_deleted_items: '${count} items deleted',
  toast_rename_success: 'Renamed successfully',
  toast_rename_failed: 'Rename failed',
  toast_paste_success: 'Pasted successfully',
  toast_paste_failed: 'Paste failed',
  toast_folder_exists: 'Folder already exists',
  toast_folder_created: 'Folder created',
  toast_set_private: 'Set as private',
  toast_action_unavailable: 'This feature is not supported yet',
  toast_added_to_favorites: 'Added to favorites',
  toast_favorite_failed: 'Could not add to favorites. The file may have changed.',
  toast_send_no_image: 'Only image files are supported for sending',
  toast_send_source_changed: 'Selected files changed or became unavailable. Nothing was shared. Go back, refresh the file list and select again.',
  toast_send_unavailable: 'No compatible local receiver is available or sharing could not open. Nothing was sent.',
  toast_compressing: 'Compressing...',
  toast_added: 'Added',
  toast_searching_apps: 'Searching for apps...',

  // ============================================================================
  // Clipboard
  // ============================================================================
  clipboard_copied: 'Copied',
  clipboard_cut: 'Cut',
  clipboard_item_count: '${count} items',
  clipboard_paste: 'Paste',

  // ============================================================================
  // Folder page — empty state
  // ============================================================================
  folder_empty: 'Folder is empty',

  // ============================================================================
  // Text preview page
  // ============================================================================
  text_preview_no_file: 'No file selected',
  text_preview_loading: 'Opening...',
  text_preview_failed: 'Unable to open this text file',
  text_preview_empty: '(Empty file)',

  // ============================================================================
  // PDF preview page
  // ============================================================================
  pdf_preview_no_file: 'No file selected',
  pdf_preview_loading: 'Opening...',
  pdf_preview_failed: 'Unable to open this PDF file',

  // ============================================================================
  // Category page — empty state
  // ============================================================================
  category_empty_prefix: 'No ',
  category_file_count: '${count} files',

  // ============================================================================
  // Cloud page
  // ============================================================================
  cloud_not_connected: 'Cloud drive not connected',

  // ============================================================================
  // Recent page — date groups
  // ============================================================================
  date_today: 'Today',
  date_yesterday: 'Yesterday',
  date_days_ago: '${count} days ago',
  date_full: '${month}/${day}/${year}',

  // ============================================================================
  // Recent page — source labels
  // ============================================================================
  source_screenshot: 'Screenshots',
  source_camera: 'Camera',
  source_download: 'Downloads',
  source_wechat: 'WeChat',
  source_internal_storage: 'Internal storage',

  // ============================================================================
  // Template helpers — date formatting
  // ============================================================================
  date_days_ago_suffix: ' days ago',
  date_year_suffix: '/',
  date_month_suffix: '/',
  date_day_suffix: '',

  // ============================================================================
  // Template helpers — selection toolbar
  // ============================================================================
  selected_prefix: '',

  // ============================================================================
  // Template helpers — delete dialog
  // ============================================================================
  delete_confirm_prefix: 'Delete ',
  delete_confirm_suffix: ' items?',

  // ============================================================================
  // Template helpers — toast: deleted items
  // ============================================================================
  toast_deleted_prefix: 'Deleted ',
  toast_deleted_suffix: ' items',

  // ============================================================================
  // Category page — file count suffix
  // ============================================================================
  fm_file_count_suffix: ' files',
  search_all: 'All',
  search_back: 'Back',
  search_clear: 'Clear search',
  search_filter_label: 'File type',
  search_placeholder: 'Search filenames',
  search_result_count: '{{count}} files found',
  search_no_results: 'No matching files',
  search_open_folder: 'Open containing folder',
};
