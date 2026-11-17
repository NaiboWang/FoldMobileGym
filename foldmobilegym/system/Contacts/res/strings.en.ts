import type { StringKey } from './strings';

export const stringsEn: Partial<Record<StringKey, string>> = {
  // Contact editor
  edit_contact_title: 'Edit contact',
  contact_editor_label: 'Label',
  contact_editor_primary: 'Default',
  contact_editor_add_phone: 'Add phone number',
  contact_editor_remove_phone: 'Remove phone number',
  contact_editor_add_email: 'Add email',
  contact_editor_remove_email: 'Remove email',
  contact_editor_save: 'Save contact',
  contact_editor_source_changed: 'This contact has changed or was deleted. Return to details and reopen the editor to avoid overwriting newer information.',
  contact_editor_discard_title: 'Discard changes?',
  contact_editor_discard_message: 'Unsaved contact information will be discarded.',
  contact_editor_discard: 'Discard changes',
  contact_editor_close: 'Close editor',
  contact_menu_title: 'Contact actions',
  contact_more_action: 'More',
  contact_editor_name: 'Name',
  contact_editor_company: 'Company',
  contact_editor_job: 'Job title',
  contact_editor_phone: 'Phone',
  contact_editor_email: 'Email',
  contact_editor_notes: 'Notes',

  dialpad_create_contact: 'Create new contact',
  dialpad_choose_existing: 'Choose a contact',
  dialpad_add_existing: 'Save to existing contact',
  dialpad_video_call: 'Video call',
  dialpad_send_message: 'Send message',
  dialpad_action_unavailable: 'Not available in the simulator yet',
  simulated_call_status: 'Simulated call — no real call is placed',
  simulated_call_end: 'End simulated call',
  simulated_call_unsupported: 'Unavailable in a simulated call',
  simulated_call_record: 'Record',
  simulated_call_ai: 'AI answer',
  simulated_call_add: 'Add call',
  simulated_call_video: 'Video call',
  simulated_call_mute: 'Mute',
  simulated_call_more: 'More',
  simulated_call_keypad: 'Keypad',
  simulated_call_speaker: 'Speaker',
  simulated_call_mute_active: 'Muted (simulated)',
  simulated_call_speaker_active: 'Speaker on (simulated)',

  // Bottom tabs
  dialerIconLabel: 'Calls',
  contactsAllLabel: 'Contacts',
  contactsCount: '{count} contacts',
  contactsIndexLabel: 'Contacts index',
  businessHallLabel: 'Mobile Services',

  // Tabs / Title
  contactsList: 'Contacts',
  frequentList: 'Frequent',
  favoritesList: 'Favorites',
  personalFavoritesLabel: 'Favorites',

  // Search
  searchHint: 'Search contacts',
  searchSearching: 'Searching…',
  searchNoResults: 'No contacts found',
  clearSearchHistory: 'Clear search history',

  // Empty state
  contactsUnavailableAddAccount: 'Sign in to sync contacts',
  contactsUnavailableImportSimContacts: 'Import SIM contacts',
  contactsUnavailableImportFromOldDevice: 'Import from old device',
  contactsUnavailableImportContacts: 'Import vCard from storage',
  contactsUnavailableCreateContact: 'Create contact',

  // Common
  cancel: 'Cancel',
  done: 'Done',
  edit: 'Edit',
  delete: 'Delete',
  add: 'Add',

  // ContactsPage header & special entries
  contactsFilterAll: 'All contacts',
  bluetoothChat: 'Offline Chat',
  myCard: 'My Profile',
  myGroups: 'My Groups',
  scanBusinessCard: 'Scan business card',
  wide_select_title: 'Select an item to view details',
  wide_select_subtitle: 'Call and contact details appear here',

  // SearchPage
  search_no_history: 'No search history',
  search_contacts_header: 'Contacts',

  // PhoneSettingsHomePage
  settings_contacts_title: 'Contacts settings',
  settings_calls_title: 'Phone settings',
  settings_opening: 'Opening settings…',

  // NewContactPage
  new_contact_title: 'New Mi Account Contact',
  new_contact_name_required: 'Please enter a name',
  new_contact_placeholder_name: 'Name',
  new_contact_placeholder_company: 'Company',
  new_contact_placeholder_job_title: 'Job title',
  new_contact_label_mobile: 'Mobile',
  new_contact_placeholder_phone: 'Phone',
  new_contact_label_work: 'Work',
  new_contact_placeholder_email: 'Email',
  new_contact_label_group: 'Group name',

  // ContactDetailPage
  contact_not_found: 'Contact does not exist',
  contact_qr_title: 'Contact QR code',
  contact_qr_hint: 'Scan to add this contact',
  contact_qr_close: 'Close QR code',
  contact_qr_error: 'Could not generate the QR code. Please try again.',
  action_call: 'Call',
  dialpad_title: 'Dial pad',
  close_dialpad: 'Close dial pad',
  dialpad_number: 'Phone number',
  dialpad_pinyin_search: 'Pinyin search supported',
  action_sms: 'SMS',
  action_video: 'Video',
  default_ringtone: 'Default',
  phone_ringtone: 'Phone ringtone',
  contact_no_phone: 'This contact has no phone number',
  contact_email_unavailable: 'The email address is unavailable or changed. Reopen the contact to check it.',
  section_phones: 'Phone',
  section_email: 'Email',
  section_notes: 'Notes',
  section_call_logs: 'Call log',
  contact_no_call_logs: 'No call logs',
  contact_deleted_toast: 'Deleted',
  contact_delete_btn: 'Delete contact',

  // CallDetailPage
  call_detail_title: 'Call detail',
  call_log_not_found: 'Record does not exist',
  call_type_incoming: 'Incoming',
  call_type_outgoing: 'Outgoing',
  call_type_missed: 'Missed',
  call_type_normal: 'Call',

  // CallsPage header
  callFilterAll: 'All calls',

  // CallsPage
  call_official_badge: 'Official',
  sim_card_1: 'SIM 1',
  sim_card_2: 'SIM 2',

  // BusinessHallPage
  bh_data_remaining: 'Data remaining',
  bh_data_usage_analysis: 'Data usage analysis',
  bh_balance: 'Balance',
  bh_yuan_unit: ' CNY',
  bh_voice_used: 'Voice used',
  bh_minutes_unit: ' min',
  bh_greeting_prefix: '',
  bh_greeting_suffix: ' user',
  bh_recharge_title: 'Top up',
  bh_other_number_recharge: 'Top up another number',

  // PhonePreferenceScreenPage
  settings_selected: 'Selected',
  delete_contact_title: 'Delete contact?',
  delete_contact_message: 'Remove this contact from the simulated device:',
  delete_contact_cancel: 'Cancel',
  delete_contact_confirm: 'Delete',
  sms_choose_number: 'Choose a message recipient',
};
