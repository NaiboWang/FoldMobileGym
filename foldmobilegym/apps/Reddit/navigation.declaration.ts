import type { NavigationDeclaration } from './navigation.types';


export const NAVIGATION_DECLARATION = {
  app: 'reddit',
  
  routes: [
    {
      path: '/',
      component: 'HomePage',
      description: '主页',
      entryPoint: 'home',
      params: {},
      queryParams: {},
      scrollContainers: [
        { name: 'main', direction: 'vertical', description: '主内容流' }
      ],
      uiStates: [
        {
          id: 'home.base',
          search: {},
          description: '主页',
          actions: [
            {
              id: 'homeFeed.item.save.toggle',
              label: 'Save or unsave a feed post',
              behavior: 'toggle',
              scope: 'item',
              paramsSchema: { postId: 'string' }
            },
            {
              id: 'homeFeed.item.vote.select.up',
              label: '信息流-帖子-点踩/点赞：赞',
              behavior: 'select',
              scope: 'item',
              paramsSchema: { postId: 'string' }
            },
            {
              id: 'homeFeed.item.vote.select.down',
              label: '信息流-帖子-点踩/点赞：踩',
              behavior: 'select',
              scope: 'item',
              paramsSchema: { postId: 'string' }
            },
            {
              id: 'homeFeed.item.join.toggle',
              label: '信息流-加入社区',
              behavior: 'toggle',
              scope: 'item',
              paramsSchema: { communityId: 'string' }
            },
            {
              id: 'homeFeed.item.share',
              label: '信息流-分享帖子',
              behavior: 'other',
              scope: 'item',
              paramsSchema: { postId: 'string' }
            }
          ]
        },
        {
          id: 'home.menu.home',
          search: { menu: 'home' },
          description: '主页-Home 菜单',
          actions: [],
        },
        {
          id: 'home.menu.drawer',
          search: { menu: 'drawer' },
          description: '主页-左侧抽屉菜单',
          actions: [],
        }
      ],
    },
    {
      path: '/search',
      component: 'SearchPage',
      description: '搜索',
      entryPoint: 'none',
      params: {},
      queryParams: { q: 'string', community: 'string' },
      scrollContainers: [
        { name: 'main', direction: 'vertical', description: '搜索结果列表' }
      ],
      uiStates: [
        {
          id: 'search.base',
          search: {},
          description: '搜索页',
          actions: [{ id: 'search.query.input', label: '输入搜索词', behavior: 'input', paramsSchema: { value: 'string' } }, { id: 'search.retry.submit', label: '重试加载内容', behavior: 'submit' }],
        },
        { id: 'search.posts', search: { tab: 'posts' }, description: '搜索帖子', actions: [{ id: 'search.posts.query.input', label: '输入帖子搜索词', behavior: 'input', paramsSchema: { value: 'string' } }, { id: 'search.posts.retry.submit', label: '重试加载内容', behavior: 'submit' }] },
        { id: 'search.communities', search: { tab: 'communities' }, description: '搜索社区', actions: [{ id: 'search.communities.query.input', label: '输入社区搜索词', behavior: 'input', paramsSchema: { value: 'string' } }, { id: 'search.communities.retry.submit', label: '重试加载内容', behavior: 'submit' }] },
        { id: 'search.comments', search: { tab: 'comments' }, description: '搜索评论', actions: [{ id: 'search.comments.query.input', label: '输入评论搜索词', behavior: 'input', paramsSchema: { value: 'string' } }, { id: 'search.comments.retry.submit', label: '重试加载内容', behavior: 'submit' }] },
      ],
    },
    {
      path: '/communities',
      component: 'CommunitiesPage',
      description: 'Reddit Answers',
      entryPoint: 'none',
      params: {},
      queryParams: {},
      scrollContainers: [
        { name: 'main', direction: 'vertical', description: '社区列表' }
      ],
      uiStates: [
        {
          id: 'communities.base',
          search: {},
          description: 'Reddit Answers',
          actions: [
            {
              id: 'communities.item.join.toggle',
              label: '社区列表-加入社区',
              behavior: 'toggle',
              scope: 'item',
              paramsSchema: { communityId: 'string' }
            }
          ]
        },
        {
          id: 'communities.menu.drawer',
          search: { menu: 'drawer' },
          description: 'Answers页-左侧抽屉菜单',
          actions: []
        }
      ],
    },
    {
      path: '/create',
      component: 'CreatePage',
      description: '发布',
      entryPoint: 'none',
      params: {},
      queryParams: {},
      scrollContainers: [{ name: 'main', direction: 'vertical', description: '发帖编辑器' }, { name: 'attachments', direction: 'horizontal', description: '已选图片' }, { name: 'flairs', direction: 'vertical', description: '可选社区标签' }],
      uiStates: [
        {
          id: 'create.base',
          search: {},
          description: '发布页',
          actions: [
            { id: 'create.title.input', label: '编辑帖子标题', behavior: 'input', paramsSchema: { value: 'string' } },
            { id: 'create.body.input', label: '编辑帖子正文', behavior: 'input', paramsSchema: { value: 'string' } },
            { id: 'create.post.submit', label: '发布当前本地帖子', behavior: 'submit' },
            { id: 'create.image.open', label: '选择虚拟图片', behavior: 'other' },
            { id: 'create.image.item.remove', label: '移除当前草稿图片', behavior: 'other', scope: 'item', paramsSchema: { uri: 'string' } },
          ]
        },
        { id: 'create.flair', search: { sheet: 'flair' }, description: 'URL 标签选择弹层', actions: [
          { id: 'create.flair.choose', label: '选择待应用标签', behavior: 'other', scope: 'item', paramsSchema: { flair: 'string' } },
          { id: 'create.flair.query.input', label: '过滤原社区标签目录', behavior: 'input', paramsSchema: { value: 'string' } },
          { id: 'create.flair.apply', label: '应用实际标签选择', behavior: 'submit' },
        ] },
        { id: 'create.discard', search: { sheet: 'discard' }, description: '放弃未发布草稿确认', actions: [
          { id: 'create.discard.confirm', label: '确认丢弃本次草稿', behavior: 'submit' },
        ] },
      ],
    },
    {
      path: '/create/community',
      component: 'SelectCommunityPage',
      description: '选择社区',
      entryPoint: 'none',
      params: {},
      queryParams: {},
      scrollContainers: [
        { name: 'main', direction: 'vertical', description: '社区列表' }
      ],
      uiStates: [
        {
          id: 'selectCommunity.base',
          search: {},
          description: '选择社区页',
          actions: [
            { id: 'create.community.query.input', label: '查找发帖社区', behavior: 'input', paramsSchema: { value: 'string' } },
            { id: 'create.community.item.submit', label: '选定实际发帖社区', behavior: 'submit', scope: 'item', paramsSchema: { communityId: 'string' } },
          ]
        }
      ],
    },
    {
      path: '/chat',
      component: 'ChatPage',
      description: '聊天',
      entryPoint: 'none',
      params: {},
      queryParams: {},
      scrollContainers: [
        { name: 'main', direction: 'vertical', description: '聊天列表' }
      ],
      uiStates: [
        {
          id: 'chat.messages',
          search: { tab: 'messages' },
          description: 'Messages Tab',
          actions: [
            {
              id: 'chat.fab.create',
              label: '聊天页-FAB-创建聊天',
              behavior: 'other'
            },
            {
              id: 'chat.welcome.explore',
              label: '聊天页-探索频道',
              behavior: 'other'
            }
          ]
        },
        {
          id: 'chat.unread',
          search: { tab: 'unread' },
          description: 'Unread Tab',
          actions: []
        },
        {
          id: 'chat.requests',
          search: { tab: 'requests' },
          description: 'Requests Tab',
          actions: []
        },
        {
          id: 'chat.threads',
          search: { tab: 'threads' },
          description: 'Threads Tab',
          actions: []
        },
        {
          id: 'chat.messages.menu.drawer',
          search: { tab: 'messages', menu: 'drawer' },
          description: 'Messages Tab-左侧抽屉菜单',
          actions: []
        },
        {
          id: 'chat.unread.menu.drawer',
          search: { tab: 'unread', menu: 'drawer' },
          description: 'Unread Tab-左侧抽屉菜单',
          actions: []
        },
        {
          id: 'chat.requests.menu.drawer',
          search: { tab: 'requests', menu: 'drawer' },
          description: 'Requests Tab-左侧抽屉菜单',
          actions: []
        },
        {
          id: 'chat.threads.menu.drawer',
          search: { tab: 'threads', menu: 'drawer' },
          description: 'Threads Tab-左侧抽屉菜单',
          actions: []
        }
      ],
    },
    {
      path: '/chat/new',
      component: 'NewChatPage',
      description: '新建聊天',
      entryPoint: 'none',
      params: {},
      queryParams: {},
      scrollContainers: [],
      uiStates: [
        {
          id: 'chatNew.base',
          search: {},
          description: '新建聊天页',
          actions: []
        }
      ],
    },
    {
      path: '/chat/:username',
      component: 'ChatThreadPage',
      description: '聊天详情',
      entryPoint: 'none',
      params: { username: 'string' },
      queryParams: {},
      scrollContainers: [
        { name: 'main', direction: 'vertical', description: '消息列表' }
      ],
      uiStates: [
        {
          id: 'chatThread.base',
          search: {},
          description: '聊天会话页',
          actions: [
            {
              id: 'chatThread.message.submit',
              label: '会话-发送消息',
              behavior: 'submit',
              paramsSchema: { username: 'string', body: 'string' }
            },
            {
              id: 'chatThread.message.longPress.open',
              label: '会话-长按消息-打开菜单',
              behavior: 'other',
              scope: 'item',
              paramsSchema: { username: 'string', messageId: 'string' }
            },
            {
              id: 'chatThread.message.menu.reply',
              label: '会话-消息菜单-回复',
              behavior: 'other',
              scope: 'item',
              paramsSchema: { username: 'string', messageId: 'string' }
            },
            {
              id: 'chatThread.message.menu.copy',
              label: '会话-消息菜单-复制文本',
              behavior: 'other',
              scope: 'item',
              paramsSchema: { username: 'string', messageId: 'string' }
            },
            {
              id: 'chatThread.message.menu.share',
              label: '会话-消息菜单-分享',
              behavior: 'other',
              scope: 'item',
              paramsSchema: { username: 'string', messageId: 'string' }
            },
            {
              id: 'chatThread.message.menu.delete',
              label: '会话-消息菜单-删除消息',
              behavior: 'other',
              scope: 'item',
              paramsSchema: { username: 'string', messageId: 'string' }
            }
          ]
        }
      ],
    },
    {
      path: '/chat/:username/thread/:messageId',
      component: 'ChatMessageThreadPage',
      description: '消息 Thread（回复列表）',
      entryPoint: 'none',
      params: { username: 'string', messageId: 'string' },
      queryParams: {},
      scrollContainers: [
        { name: 'main', direction: 'vertical', description: 'thread 内容区' }
      ],
      uiStates: [
        {
          id: 'chatMessageThread.base',
          search: {},
          description: '消息 Thread',
          actions: [
            {
              id: 'chatThread.reply.submit',
              label: 'Thread-发送回复',
              behavior: 'submit',
              paramsSchema: { username: 'string', messageId: 'string', body: 'string' }
            }
          ]
        }
      ],
    },
    {
      path: '/inbox',
      component: 'InboxPage',
      description: '收件箱',
      entryPoint: 'none',
      params: {},
      queryParams: {},
      scrollContainers: [
        { name: 'main', direction: 'vertical', description: '通知列表' }
      ],
      uiStates: [
        {
          id: 'inbox.notifications',
          search: { tab: 'notifications' },
          description: '通知 Tab',
          actions: []
        },
        {
          id: 'inbox.messages',
          search: { tab: 'messages' },
          description: '消息 Tab',
          actions: []
        },
        {
          id: 'inbox.notifications.menu.drawer',
          search: { tab: 'notifications', menu: 'drawer' },
          description: '通知 Tab-左侧抽屉菜单',
          actions: []
        },
        {
          id: 'inbox.messages.menu.drawer',
          search: { tab: 'messages', menu: 'drawer' },
          description: '消息 Tab-左侧抽屉菜单',
          actions: []
        }
      ],
    },
    {
      path: '/me',
      component: 'ProfilePage',
      description: '我的主页',
      entryPoint: 'none',
      params: {},
      queryParams: {},
      scrollContainers: [
        { name: 'main', direction: 'vertical', description: '个人主页内容' }
      ],
      uiStates: [
        {
          id: 'profile.posts',
          search: { tab: 'posts' },
          description: '个人主页-Posts',
          actions: []
        },
        {
          id: 'profile.comments',
          search: { tab: 'comments' },
          description: '个人主页-Comments',
          actions: []
        },
        {
          id: 'profile.about',
          search: { tab: 'about' },
          description: '个人主页-About',
          actions: []
        }
      ],
    },
    {
      path: '/me/edit',
      component: 'EditProfilePage',
      description: '编辑个人资料',
      entryPoint: 'none',
      params: {},
      queryParams: {},
      scrollContainers: [
        { name: 'main', direction: 'vertical', description: '编辑资料内容' }
      ],
      uiStates: [
        {
          id: 'editProfile.base',
          search: {},
          description: '编辑个人资料页',
          actions: [
            {
              id: 'editProfile.displayName.input',
              label: '编辑资料-显示名称输入',
              behavior: 'input',
              paramsSchema: { value: 'string' },
            },
            {
              id: 'editProfile.bio.input',
              label: '编辑资料-个人介绍输入',
              behavior: 'input',
              paramsSchema: { value: 'string' },
            },
            {
              id: 'editProfile.save.submit',
              label: '编辑资料-保存',
              behavior: 'submit',
            }
          ]
        }
      ],
    },
    {
      path: '/me/settings',
      component: 'SettingsPage',
      description: '设置',
      entryPoint: 'none',
      params: {},
      queryParams: {},
      scrollContainers: [
        { name: 'main', direction: 'vertical', description: '设置内容' }
      ],
      uiStates: [
        {
          id: 'settings.base',
          search: {},
          description: '设置页',
          actions: [
            // Dark Mode
            {
              id: 'settings.theme.select.light',
              label: '设置-主题：浅色',
              behavior: 'select',
            },
            {
              id: 'settings.theme.select.dark',
              label: '设置-主题：深色',
              behavior: 'select',
            },
            {
              id: 'settings.theme.select.auto',
              label: '设置-主题：自动',
              behavior: 'select',
            },
            // View Options
            {
              id: 'settings.showNSFW.toggle',
              label: '设置-显示NSFW内容：开关',
              behavior: 'toggle',
            },
            {
              id: 'settings.blurNSFW.toggle',
              label: '设置-模糊NSFW图片：开关',
              behavior: 'toggle',
            },
            {
              id: 'settings.showCommunityStyles.toggle',
              label: '设置-显示社区样式：开关',
              behavior: 'toggle',
            },
            // Autoplay
            {
              id: 'settings.autoplayVideo.select.always',
              label: '设置-视频自动播放：始终',
              behavior: 'select',
            },
            {
              id: 'settings.autoplayVideo.select.wifi',
              label: '设置-视频自动播放：仅WiFi',
              behavior: 'select',
            },
            {
              id: 'settings.autoplayVideo.select.never',
              label: '设置-视频自动播放：从不',
              behavior: 'select',
            },
            {
              id: 'settings.quietAudio.toggle',
              label: '设置-静音模式：开关',
              behavior: 'toggle',
            },
            // Notifications
            {
              id: 'settings.inboxNotifications.toggle',
              label: '设置-收件箱通知：开关',
              behavior: 'toggle',
            },
            {
              id: 'settings.commentReplyNotifications.toggle',
              label: '设置-评论回复通知：开关',
              behavior: 'toggle',
            },
            {
              id: 'settings.upvoteNotifications.toggle',
              label: '设置-点赞通知：开关',
              behavior: 'toggle',
            },
            {
              id: 'settings.mentionNotifications.toggle',
              label: '设置-提及通知：开关',
              behavior: 'toggle',
            },
            {
              id: 'settings.chatMessageNotifications.toggle',
              label: '设置-聊天消息通知：开关',
              behavior: 'toggle',
            },
            {
              id: 'settings.communityAlerts.toggle',
              label: '设置-社区提醒：开关',
              behavior: 'toggle',
            },
            {
              id: 'settings.trendingNotifications.toggle',
              label: '设置-热门帖子通知：开关',
              behavior: 'toggle',
            },
            // Content Preferences
            {
              id: 'settings.defaultCommentSort.select.best',
              label: '设置-默认评论排序：最佳',
              behavior: 'select',
            },
            {
              id: 'settings.defaultCommentSort.select.top',
              label: '设置-默认评论排序：热门',
              behavior: 'select',
            },
            {
              id: 'settings.defaultCommentSort.select.new',
              label: '设置-默认评论排序：最新',
              behavior: 'select',
            },
            {
              id: 'settings.defaultCommentSort.select.controversial',
              label: '设置-默认评论排序：争议',
              behavior: 'select',
            },
            {
              id: 'settings.rememberPerPostSort.toggle',
              label: '设置-记住每帖排序：开关',
              behavior: 'toggle',
            },
            // Privacy
            {
              id: 'settings.homeFeedRecommendations.toggle',
              label: '设置-首页推荐：开关',
              behavior: 'toggle',
            },
            {
              id: 'settings.showOnlineStatus.toggle',
              label: '设置-显示在线状态：开关',
              behavior: 'toggle',
            },
            {
              id: 'settings.allowCookies.toggle',
              label: '设置-允许Cookie：开关',
              behavior: 'toggle',
            },
            {
              id: 'settings.personalizedAds.toggle',
              label: '设置-个性化广告：开关',
              behavior: 'toggle',
            },
            // Accessibility
            {
              id: 'settings.textSize.select.small',
              label: '设置-文字大小：小',
              behavior: 'select',
            },
            {
              id: 'settings.textSize.select.default',
              label: '设置-文字大小：默认',
              behavior: 'select',
            },
            {
              id: 'settings.textSize.select.large',
              label: '设置-文字大小：大',
              behavior: 'select',
            },
            {
              id: 'settings.textSize.select.extraLarge',
              label: '设置-文字大小：超大',
              behavior: 'select',
            },
            {
              id: 'settings.reduceAnimations.toggle',
              label: '设置-减少动画：开关',
              behavior: 'toggle',
            },
            {
              id: 'settings.openLinks.select.inApp',
              label: '设置-打开链接方式：应用内',
              behavior: 'select',
            },
            {
              id: 'settings.openLinks.select.defaultBrowser',
              label: '设置-打开链接方式：默认浏览器',
              behavior: 'select',
            },
            {
              id: 'settings.savedImageAttribution.toggle',
              label: '设置-已保存图片来源标注：开关',
              behavior: 'toggle',
            },
            {
              id: 'settings.defaultMarkdown.toggle',
              label: '设置-默认Markdown编辑器：开关',
              behavior: 'toggle',
            },
          ]
        }
      ],
    },
    {
      path: '/user/:username',
      component: 'UserProfilePage',
      description: '他人主页',
      entryPoint: 'none',
      params: { username: 'string' },
      queryParams: {},
      scrollContainers: [
        { name: 'main', direction: 'vertical', description: '用户主页内容' }
      ],
      uiStates: [
        {
          id: 'userProfile.posts',
          search: { tab: 'posts' },
          description: '用户主页-Posts',
          actions: []
        },
        {
          id: 'userProfile.comments',
          search: { tab: 'comments' },
          description: '用户主页-Comments',
          actions: []
        },
        {
          id: 'userProfile.about',
          search: { tab: 'about' },
          description: '用户主页-About',
          actions: []
        }
      ],
    },
    {
      path: '/post/:postId',
      component: 'PostCommentsPage',
      description: '帖子详情与评论',
      entryPoint: 'none',
      params: { postId: 'string' },
      queryParams: { commentId: 'string', selectedComment: 'string' },
      scrollContainers: [
        { name: 'main', direction: 'vertical', description: '评论列表' },
        { name: 'commentMenu', direction: 'vertical', description: '评论操作菜单' },
      ],
      uiStates: [
        {
          id: 'postComments.base',
          search: {},
          description: '评论页',
          actions: [
            {
              id: 'postComments.post.vote.select.up',
              label: '帖子-顶',
              behavior: 'select',
              paramsSchema: { postId: 'string' }
            },
            {
              id: 'postComments.post.vote.select.down',
              label: '帖子-踩',
              behavior: 'select',
              paramsSchema: { postId: 'string' }
            },
            {
              id: 'postComments.post.share',
              label: '帖子-分享',
              behavior: 'other',
              paramsSchema: { postId: 'string' }
            },
            {
              id: 'postComments.community.join',
              label: '帖子详情-加入/退出社区',
              behavior: 'submit',
              paramsSchema: { communityId: 'string' }
            },
            {
              id: 'postComments.comment.submit',
              label: '评论页-发送评论/回复',
              behavior: 'submit',
              paramsSchema: { postId: 'string', body: 'string', parentId: 'string' }
            },
            {
              id: 'postComments.item.vote.select.up',
              label: '评论-顶',
              behavior: 'select',
              scope: 'item',
              paramsSchema: { postId: 'string', commentId: 'string' }
            },
            {
              id: 'postComments.item.vote.select.down',
              label: '评论-踩',
              behavior: 'select',
              scope: 'item',
              paramsSchema: { postId: 'string', commentId: 'string' }
            }
          ]
        },
        { id: 'postComments.sort', search: { sheet: 'sort' }, description: '评论排序弹层', actions: [
          { id: 'postComments.sort.select.best', label: '评论排序-默认', behavior: 'select' },
          { id: 'postComments.sort.select.top', label: '评论排序-热门', behavior: 'select' },
          { id: 'postComments.sort.select.new', label: '评论排序-最新', behavior: 'select' },
          { id: 'postComments.sort.select.controversial', label: '评论排序-争议', behavior: 'select' },
        ] },
        { id: 'postComments.menu', search: { sheet: 'comment' }, description: '评论操作菜单', actions: [
          { id: 'postComments.item.share', label: '评论-转发', behavior: 'other', scope: 'item', paramsSchema: { postId: 'string', commentId: 'string' } },
          { id: 'postComments.item.copyText', label: '评论-复制文本', behavior: 'other', scope: 'item', paramsSchema: { postId: 'string', commentId: 'string' } },
        ] },
        { id: 'postComments.delete', search: { sheet: 'delete' }, description: '评论删除确认', actions: [
          { id: 'postComments.item.delete.submit', label: '删除自己的评论', behavior: 'submit', scope: 'item', paramsSchema: { postId: 'string', commentId: 'string' } },
        ] },
      ],
    },
    {
      path: '/post/:postId/reply/:commentId',
      component: 'CommentReplyPage',
      description: '回复评论',
      entryPoint: 'none',
      params: { postId: 'string', commentId: 'string' },
      queryParams: {},
      scrollContainers: [],
      uiStates: [
        {
          id: 'commentReply.base',
          search: {},
          description: '回复页',
          actions: [
            {
              id: 'commentReply.post.submit',
              label: '回复页-发表回复',
              behavior: 'submit',
              paramsSchema: { postId: 'string', commentId: 'string', body: 'string' }
            }
          ]
        }
      ],
    },
    {
      path: '/post/:postId/edit/:commentId',
      component: 'CommentEditPage',
      description: '编辑评论',
      entryPoint: 'none',
      params: { postId: 'string', commentId: 'string' },
      queryParams: {},
      scrollContainers: [],
      uiStates: [
        {
          id: 'commentEdit.base',
          search: {},
          description: '编辑页',
          actions: [
            {
              id: 'commentEdit.post.submit',
              label: '编辑页-保存评论',
              behavior: 'submit',
              paramsSchema: { postId: 'string', commentId: 'string', body: 'string' }
            }
          ]
        }
      ],
    },
  ],
  
  transitions: [
    {
      id: 'postComments.sort.open',
      from: { path: '/post/:postId', search: { sheet: null } },
      to: '/post/:postId', search: { sheet: 'sort' }, searchParams: {}, preserveParams: ['commentId'],
      mode: 'push', params: { postId: 'string' }, label: '打开评论排序',
      ui: { placement: 'topbar', icon: 'sort', gesture: 'tap' },
    },
    {
      id: 'postComments.item.more.open',
      from: { path: '/post/:postId', search: { sheet: null } },
      to: '/post/:postId', search: { sheet: 'comment' }, searchParams: { selectedComment: 'string' }, preserveParams: ['commentId'],
      mode: 'push', params: { postId: 'string' }, label: '打开评论操作菜单',
      ui: { placement: 'content', icon: 'more', gesture: 'tap' },
    },
    {
      id: 'postComments.item.delete.open',
      from: { path: '/post/:postId', search: { sheet: 'comment' } },
      to: '/post/:postId', search: { sheet: 'delete' }, searchParams: {}, preserveParams: ['commentId', 'selectedComment'],
      mode: 'replace', params: { postId: 'string' }, label: '确认删除自己的评论',
      ui: { placement: 'content', icon: 'delete', gesture: 'tap' },
    },
    {
      id: 'search.open',
      from: ['/', '/communities', { path: '/chat', search: { tab: '*' } }, { path: '/inbox', search: { tab: '*' } }, { path: '/me', search: { tab: '*' } }],
      to: '/search',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开搜索',
      ui: { placement: 'topbar', icon: 'search', gesture: 'tap' },
    },
    {
      id: 'home.drawer.open',
      from: { path: '/', search: { menu: null } },
      to: '/',
      search: { menu: 'drawer' },
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开左侧抽屉菜单',
      ui: { placement: 'topbar', icon: 'drawer_menu', gesture: 'tap' },
    },
    {
      id: 'home.menu.open',
      from: { path: '/', search: { menu: null } },
      to: '/',
      search: { menu: 'home' },
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开 Home 菜单',
      ui: { placement: 'topbar', icon: 'home_menu', gesture: 'tap' },
    },
    {
      id: 'tab.home',
      from: [
        '/communities',
        { path: '/chat', search: { tab: '*', menu: null } },
        { path: '/inbox', search: { tab: '*' } },
        '/create',
        { path: '/me', search: { tab: '*' } },
        { path: '/user/:username', search: { tab: '*' } },
      ],
      to: '/',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '切换到主页',
      ui: { placement: 'tabbar', icon: 'home', gesture: 'tap' },
    },
    {
      id: 'tab.communities',
      from: [
        '/',
        { path: '/chat', search: { tab: '*', menu: null } },
        { path: '/inbox', search: { tab: '*' } },
        '/create',
        { path: '/me', search: { tab: '*' } },
        { path: '/user/:username', search: { tab: '*' } },
      ],
      to: '/communities',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '切换到 Answers',
      ui: { placement: 'tabbar', icon: 'users', gesture: 'tap' },
    },
    {
      id: 'tab.create',
      from: [
        '/',
        '/communities',
        { path: '/chat', search: { tab: '*', menu: null } },
        { path: '/inbox', search: { tab: '*' } },
        { path: '/me', search: { tab: '*' } },
        { path: '/user/:username', search: { tab: '*' } },
      ],
      to: '/create',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开发布',
      ui: { placement: 'tabbar', icon: 'plus', gesture: 'tap' },
    },
    {
      id: 'drawer.create.open',
      from: [
        { path: '/', search: { menu: 'drawer' } },
        { path: '/communities', search: { menu: 'drawer' } },
        { path: '/chat', search: { tab: '*', menu: 'drawer' } },
        { path: '/inbox', search: { tab: '*', menu: 'drawer' } },
      ],
      to: '/create',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '从抽屉打开发布（自动关闭抽屉）',
      ui: { placement: 'drawer', icon: 'plus', gesture: 'tap' },
    },
    {
      id: 'create.flair.open', from: { path: '/create', search: { sheet: null } }, to: '/create', search: { sheet: 'flair' },
      params: {}, searchParams: {}, mode: 'push', label: '打开社区标签弹层', ui: { placement: 'content', icon: 'tag', gesture: 'tap' },
    },
    {
      id: 'create.discard.open', from: { path: '/create', search: { sheet: null } }, to: '/create', search: { sheet: 'discard' },
      params: {}, searchParams: {}, mode: 'push', label: '确认离开未发布草稿', ui: { placement: 'content', icon: 'close', gesture: 'tap' },
    },
    {
      id: 'create.overlay.return', from: [{ path: '/create', search: { sheet: 'flair' } }, { path: '/create', search: { sheet: 'discard' } }],
      to: '/create', search: {}, params: {}, searchParams: {}, mode: 'replace', label: '冷启动弹层返回编辑器', ui: { placement: 'content', icon: 'back', gesture: 'tap' },
    },
    {
      id: 'create.home.return', from: '/create', to: '/', search: {}, params: {}, searchParams: {}, mode: 'replace',
      label: '无来源编辑器返回主页', ui: { placement: 'content', icon: 'back', gesture: 'tap' },
    },
    {
      id: 'create.community.open',
      from: '/create',
      to: '/create/community',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '选择社区',
      ui: { placement: 'content', icon: 'community', gesture: 'tap' },
    },
    {
      id: 'create.editor.return', from: '/create/community', to: '/create', params: {}, search: {}, searchParams: {},
      mode: 'replace', label: '冷启动社区选择返回编辑器', ui: { placement: 'content', icon: 'community', gesture: 'tap' },
    },
    {
      id: 'tab.chat',
      from: ['/', '/communities', { path: '/inbox', search: { tab: '*' } }, '/create', { path: '/me', search: { tab: '*' } }, { path: '/user/:username', search: { tab: '*' } }],
      to: '/chat',
      search: { tab: 'messages' },
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '切换到聊天',
      ui: { placement: 'tabbar', icon: 'message-circle', gesture: 'tap' },
    },
    {
      id: 'tab.inbox',
      from: ['/', '/communities', { path: '/chat', search: { tab: '*', menu: null } }, '/create', { path: '/me', search: { tab: '*' } }, { path: '/user/:username', search: { tab: '*' } }],
      to: '/inbox',
      search: { tab: 'notifications' },
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '切换到收件箱',
      ui: { placement: 'tabbar', icon: 'bell', gesture: 'tap' },
    },
    {
      id: 'inbox.tab.switch',
      from: { path: '/inbox', search: { tab: '*' } },
      to: '/inbox',
      search: {},
      searchParams: { tab: 'string' },
      mode: 'replace',
      params: {},
      label: '切换收件箱 Tab',
      ui: { placement: 'content', icon: '', gesture: 'tap' },
    },
    {
      id: 'communities.drawer.open',
      from: { path: '/communities', search: { menu: null } },
      to: '/communities',
      search: { menu: 'drawer' },
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开左侧抽屉菜单（Answers）',
      ui: { placement: 'topbar', icon: 'drawer_menu', gesture: 'tap' },
    },
    {
      id: 'chat.tab.switch',
      from: { path: '/chat', search: { tab: '*', menu: null } },
      to: '/chat',
      search: {},
      searchParams: { tab: 'string' },
      mode: 'replace',
      params: {},
      label: '切换 Chats Tab',
      ui: { placement: 'content', icon: '', gesture: 'tap' },
    },
    {
      id: 'chat.new.open',
      from: { path: '/chat', search: { tab: '*', menu: null } },
      to: '/chat/new',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '新建聊天',
      ui: { placement: 'fab', icon: 'plus', gesture: 'tap' },
    },
    {
      id: 'chat.thread.open',
      from: { path: '/chat', search: { tab: 'messages', menu: null } },
      to: '/chat/:username',
      search: {},
      searchParams: {},
      mode: 'push',
      params: { username: 'string' },
      label: '打开聊天会话',
      ui: { placement: 'content', icon: 'message-circle', gesture: 'tap' },
    },
    {
      id: 'chatThread.message.thread.open',
      from: '/chat/:username',
      to: '/chat/:username/thread/:messageId',
      search: {},
      searchParams: {},
      mode: 'push',
      params: { username: 'string', messageId: 'string' },
      label: '打开消息 Thread',
      ui: { placement: 'content', icon: 'reply', gesture: 'tap' },
    },
    {
      id: 'search.query.change', from: [{ path: '/search', search: { tab: null } }, { path: '/search', search: { tab: '*' } }], to: '/search', search: {}, searchParams: { q: 'string' }, params: {},
      preserveParams: ['tab', 'community'], mode: 'replace', label: '更新搜索词', ui: { placement: 'content', icon: 'search', gesture: 'tap' },
    },
    {
      id: 'search.home.return', from: [{ path: '/search', search: { tab: null } }, { path: '/search', search: { tab: '*' } }], to: '/', search: {}, searchParams: {}, params: {},
      mode: 'replace', label: '冷启动搜索返回首页', ui: { placement: 'topbar', icon: 'back', gesture: 'back' },
    },
    {
      id: 'search.tab.switch', from: [{ path: '/search', search: { tab: null } }, { path: '/search', search: { tab: '*' } }], to: '/search', search: {}, searchParams: { q: 'string' }, params: {},
      preserveParams: ['q', 'community'], mode: 'replace', label: '搜索分类', ui: { placement: 'content', icon: 'search', gesture: 'tap' },
      cases: [
        { when: { op: 'eq', left: { ref: 'param', key: 'tab' }, right: 'posts' }, to: '/search', search: { tab: 'posts' } },
        { when: { op: 'eq', left: { ref: 'param', key: 'tab' }, right: 'communities' }, to: '/search', search: { tab: 'communities' } },
        { when: { op: 'eq', left: { ref: 'param', key: 'tab' }, right: 'comments' }, to: '/search', search: { tab: 'comments' } },
        { when: { op: 'always' }, to: '/search', search: { tab: null } },
      ],
    },
    {
      id: 'search.community.open', from: [{ path: '/search', search: { tab: null } }, { path: '/search', search: { tab: '*' } }], to: '/search', search: { tab: 'posts', q: null }, searchParams: { community: 'string' }, params: {},
      mode: 'replace', label: '搜索当前社区帖子', ui: { placement: 'content', icon: 'search', gesture: 'tap' },
    },
    {
      id: 'search.community.clear', from: [{ path: '/search', search: { tab: null } }, { path: '/search', search: { tab: '*' } }], to: '/search', search: { community: null }, searchParams: {}, params: {},
      preserveParams: ['q', 'tab'], mode: 'replace', label: '清除社区筛选', ui: { placement: 'content', icon: 'search', gesture: 'tap' },
    },
    {
      id: 'post.comments.open',
      from: [
        '/',
        '/communities',
        '/search',
        { path: '/chat', search: { tab: '*', menu: null } },
        { path: '/inbox', search: { tab: '*' } },
        { path: '/me', search: { tab: '*' } },
      ],
      to: '/post/:postId',
      search: {},
      searchParams: { commentId: 'string' },
      mode: 'push',
      params: { postId: 'string' },
      label: '打开帖子评论',
      ui: { placement: 'content', icon: 'comment', gesture: 'tap' },
    },
    {
      id: 'comment.reply.open',
      from: '/post/:postId',
      to: '/post/:postId/reply/:commentId',
      search: {},
      searchParams: {},
      mode: 'push',
      params: { postId: 'string', commentId: 'string' },
      label: '打开回复页',
      ui: { placement: 'content', icon: 'reply', gesture: 'tap' },
    },
    {
      id: 'comment.edit.open',
      from: '/post/:postId',
      to: '/post/:postId/edit/:commentId',
      search: {},
      searchParams: {},
      mode: 'push',
      params: { postId: 'string', commentId: 'string' },
      label: '打开编辑页',
      ui: { placement: 'content', icon: 'edit', gesture: 'tap' },
    },
    {
      id: 'chat.drawer.open',
      from: { path: '/chat', search: { tab: '*', menu: null } },
      to: '/chat',
      search: { menu: 'drawer' },
      searchParams: {},
      preserveParams: ['tab'],
      mode: 'push',
      params: {},
      label: '打开左侧抽屉菜单（聊天）',
      ui: { placement: 'topbar', icon: 'drawer_menu', gesture: 'tap' },
    },
    {
      id: 'inbox.drawer.open',
      from: { path: '/inbox', search: { tab: '*', menu: null } },
      to: '/inbox',
      search: { menu: 'drawer' },
      searchParams: {},
      preserveParams: ['tab'],
      mode: 'push',
      params: {},
      label: '打开左侧抽屉菜单（收件箱）',
      ui: { placement: 'topbar', icon: 'drawer_menu', gesture: 'tap' },
    },
    {
      id: 'profile.me.open',
      from: ['/', '/communities', { path: '/chat', search: { tab: '*' } }, { path: '/inbox', search: { tab: '*' } }],
      to: '/me',
      search: { tab: 'posts' },
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开我的主页',
      ui: { placement: 'topbar', icon: 'avatar', gesture: 'tap' },
    },
    {
      id: 'profile.edit.open',
      from: { path: '/me', search: { tab: '*' } },
      to: '/me/edit',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开编辑个人资料',
      ui: { placement: 'content', icon: 'edit', gesture: 'tap' },
    },
    {
      id: 'profile.tab.switch',
      from: { path: '/me', search: { tab: '*' } },
      to: '/me',
      search: {},
      searchParams: { tab: 'string' },
      mode: 'replace',
      params: {},
      label: '切换个人主页 Tab',
      ui: { placement: 'content', icon: '', gesture: 'tap' },
    },
    {
      id: 'profile.settings.open',
      from: { path: '/me', search: { tab: '*' } },
      to: '/me/settings',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开设置',
      ui: { placement: 'content', icon: 'settings', gesture: 'tap' },
    },
    {
      id: 'profile.user.open',
      from: [
        '/',
        '/communities',
        { path: '/chat', search: { tab: '*', menu: null } },
        { path: '/inbox', search: { tab: '*' } },
        { path: '/me', search: { tab: '*' } },
        { path: '/user/:username', search: { tab: '*' } },
        '/post/:postId',
      ],
      to: '/user/:username',
      search: { tab: 'posts' },
      searchParams: {},
      mode: 'push',
      params: { username: 'string' },
      label: '打开他人主页',
      ui: { placement: 'content', icon: 'avatar', gesture: 'tap' },
    },
    {
      id: 'profile.user.tab.switch',
      from: { path: '/user/:username', search: { tab: '*' } },
      to: '/user/:username',
      search: {},
      searchParams: { tab: 'string' },
      mode: 'replace',
      params: { username: 'string' },
      label: '切换他人主页 Tab',
      ui: { placement: 'content', icon: '', gesture: 'tap' },
    },
  ],
  
  capabilities: {
    historyBack: true,
  },
} as const satisfies NavigationDeclaration;

export type TransitionId = (typeof NAVIGATION_DECLARATION.transitions)[number]['id'];
