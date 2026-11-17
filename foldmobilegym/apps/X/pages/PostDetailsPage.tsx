import React from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useXStore, selectUser } from '../state';
import { useXAllUsers, useXRepliesForPost, useXResolvedPost } from '../data/view';
import { useXGestures } from '../hooks/useXGestures';
import { XImage, XVideo } from '../components/XMedia';
import { BookmarkToast } from '../components/BookmarkToast';
import { useXOverlayControls } from '../hooks/useXOverlayControls';
import { XPostActionBar } from '../components/XPostActionBar';
import { useXStrings } from '../hooks/useXStrings';
import {
  IcMore, IcChevronDown, IcCheck,
} from '../res/icons';
import type { XPost } from '../types';
import { orderXReplies } from '../utils/postOrdering';
import { getXSheet } from '../utils/overlayState';
import { XSheetFrame } from '../components/XSheetFrame';
import { XDataNotice } from '../components/XDataNotice';
import { useXPostData } from '../hooks/useXPostData';

export const PostDetailsPage: React.FC = () => {
  const { id } = useParams();
  const location = useLocation();
  const post = useXResolvedPost(id || '');
  const data = useXPostData(id || '');
  const user = useXStore(selectUser);
  // 顶层一次订阅 user 字典, 传给所有 ReplyItem, 避免每条回复独立订阅。
  const allUsers = useXAllUsers();
  const mergedReplies = useXRepliesForPost(id || '');
  const { bindBack, bindTap, go, back } = useXGestures();
  const s = useXStrings();
  const { openOnce, claim } = useXOverlayControls();
  const [sortMethod, setSortMethod] = React.useState<'relevant' | 'recent' | 'likes'>('relevant');
  const showSortMenu = getXSheet(location.pathname, location.search) === 'replySort';
  const [showBookmarkToast, setShowBookmarkToast] = React.useState(false);
  const retryProps = bindTap({ kind: 'action', id: 'status.data.retry.submit' }, { onTrigger: data.retry });

  const sortedReplies = React.useMemo(() => {
    return orderXReplies(mergedReplies, sortMethod);
  }, [mergedReplies, sortMethod]);

  const getSortLabel = (method: string) => {
    if (method === 'recent') return s.post_sort_recent;
    if (method === 'likes') return s.post_sort_likes;
    return s.post_sort_relevant;
  };

  const selectSort = (method: 'recent' | 'relevant' | 'likes') => {
    if (!showSortMenu || !claim()) return;
    setSortMethod(method); back();
  };
  const sortOptions = [
    { value: 'recent', label: s.post_sort_recent, props: bindTap({ kind: 'action', id: 'status.replies.sort.select.recent' }, { params: { id: id || '' }, onTrigger: () => selectSort('recent') }) },
    { value: 'relevant', label: s.post_sort_relevant, props: bindTap({ kind: 'action', id: 'status.replies.sort.select.relevant' }, { params: { id: id || '' }, onTrigger: () => selectSort('relevant') }) },
    { value: 'likes', label: s.post_sort_likes, props: bindTap({ kind: 'action', id: 'status.replies.sort.select.likes' }, { params: { id: id || '' }, onTrigger: () => selectSort('likes') }) },
  ];

  if (!post) {
    // Reply id 深链 (r_p_xxx) 进入时, post 解析依赖 replies map 加载完成;
    // 加载中显示 loading 占位, 避免错误闪现 "未找到帖子"。
    return (
      <div className="flex flex-col bg-app-bg min-h-full text-app-text pt-10 px-4">
        <div className="flex items-center py-2">
          <button className="text-app-text mr-4" {...bindBack()}>←</button>
          <div className="font-bold text-lg">{s.post_title}</div>
        </div>
        <div className="mt-6 text-gray-500">
          <XDataNotice {...data} retryProps={retryProps} />
          {data.ready && s.post_not_found}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
    <div data-x-page-background inert={showSortMenu} className="flex h-full min-h-0 flex-col bg-app-bg text-app-text pt-10">
      {/* Header */}
      <div className="flex items-center px-4 py-2 border-b border-app-border sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <button className="text-app-text mr-6" {...bindBack()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5 fill-current">
            <g><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" /></g>
          </svg>
        </button>
        <div className="font-bold text-lg">{s.post_title}</div>
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto no-scrollbar"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {/* Main Post */}
        <div className="px-4 pt-4 pb-2 border-b border-app-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div
                className="w-10 h-10 rounded-full bg-gray-200 mr-3 overflow-hidden"
                {...bindTap('user.open.fromPost', { params: { id: post.authorId } })}
              >
                {post.author.avatar
                  ? <XImage src={post.author.avatar} alt={post.author.name} className="w-full h-full object-cover" />
                  : null}
              </div>
              <div className="flex flex-col">
                <div className="font-bold text-app-text flex items-center">
                  {post.author.name}
                  {post.author.verified && <span className="text-blue-400 ml-1">✓</span>}
                </div>
                <div className="text-gray-500 text-sm">{`@${post.author.id}`}</div>
              </div>
            </div>
            <button className="text-gray-500" aria-label="More options">
              <IcMore size={20} />
            </button>
          </div>

          <div className="text-app-text text-lg whitespace-pre-wrap mb-3 leading-normal">{post.content}</div>

          {post.image && (
            <div className="mb-3 rounded-xl overflow-hidden border border-app-border w-full">
              <XImage src={post.image} alt="Post image" className="w-full h-auto object-cover max-h-(--app-feed-image-max-height)" />
            </div>
          )}

          {post.video && (
            <div className="mb-3 rounded-xl overflow-hidden border border-app-border w-full">
              <XVideo src={post.video} className="w-full h-auto max-h-(--app-feed-image-max-height)" />
            </div>
          )}

          {post.quotedPost && (
            <div
              className="mb-3 rounded-xl overflow-hidden border border-app-border w-full p-3 cursor-pointer active:bg-gray-100/50"
              {...bindTap('status.open', { params: { id: post.quotedPost.id } })}
            >
              <div className="flex items-center gap-1 mb-1">
                <div className="w-5 h-5 rounded-full bg-gray-200 overflow-hidden">
                  {post.quotedPost.author.avatar && (
                    <XImage src={post.quotedPost.author.avatar} alt={post.quotedPost.author.name} className="w-full h-full object-cover" />
                  )}
                </div>
                <span className="font-bold text-sm text-app-text">{post.quotedPost.author.name}</span>
                <span className="text-gray-500 text-sm">{`@${post.quotedPost.author.id}`}</span>
                <span className="text-gray-500 text-sm">· {post.quotedPost.time}</span>
              </div>
              <div className="text-app-text text-sm line-clamp-3">{post.quotedPost.content}</div>
            </div>
          )}

          <div
            className="text-gray-500 text-sm py-3 border-b border-app-border active:bg-black/5 cursor-pointer"
            {...bindTap('status.activity.open', { params: { id: post.id } })}
          >
            {post.time} · {post.stats.views} {s.post_views_suffix}
          </div>

          <div className="py-3 border-b border-app-border px-4">
            <XPostActionBar
              postId={post.id}
              stats={post.stats}
              actionIds={{
                retweet: 'post.item.retweet',
                like: 'status.post.like',
                bookmark: 'status.post.bookmark',
                share: 'post.item.share',
              }}
              showCounts
              className="mt-0 max-w-none"
              retweetTapProps={bindTap('status.retweet.menu.open', { params: { id: id || '', sheetPostId: post.id }, stopPropagation: true, onTrigger: () => openOnce(() => go('status.retweet.menu.open', { id: id || '', sheetPostId: post.id })) })}
              onBookmarkAdded={() => setShowBookmarkToast(true)}
            />
          </div>

          {/* Sorting Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-app-border">
            <button type="button"
              className="flex items-center gap-1 font-bold text-app-text cursor-pointer"
              {...bindTap('status.replies.sort.open', { params: { id: id || '' }, onTrigger: () => openOnce(() => go('status.replies.sort.open', { id: id || '' })) })}
            >
              <span>{getSortLabel(sortMethod)}</span>
              <IcChevronDown size={16} />
            </button>
            <button type="button" className="text-gray-500 text-sm flex items-center gap-1 cursor-pointer active:opacity-60" {...bindTap('status.activity.open', { params: { id: post.id } })}>
              <span>{s.post_view_quotes}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4 fill-current">
                <g><path d="M17.207 11.293l-7.5-7.5c-.39-.39-1.023-.39-1.414 0s-.39 1.023 0 1.414L15.086 12l-6.793 6.793c-.39.39-.39 1.023 0 1.414.195.195.45.293.707.293s.512-.098.707-.293l7.5-7.5c.39-.39.39-1.023 0-1.414z" /></g>
              </svg>
            </button>
          </div>
        </div>

        {/* Replies List — loading / list / empty 三态互斥 */}
        <div className="pb-20">
          {!data.ready ? (
            <XDataNotice {...data} retryProps={retryProps} />
          ) : sortedReplies.length > 0 ? (
            sortedReplies.map((reply: XPost) => (
              <ReplyItem key={reply.id} reply={reply} users={allUsers} />
            ))
          ) : (
            <div className="p-8 text-center text-gray-500">{s.post_no_replies}</div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Reply Bar */}
      <div className="shrink-0 border-t border-app-border bg-app-bg z-40">
        <div
          className="flex items-center px-4 py-2"
          {...bindTap('reply.open', { params: { id: post.id } })}
        >
          <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden mr-3 shrink-0">
            {user.avatar
              ? <XImage src={user.avatar} alt="Current user avatar" className="w-full h-full object-cover" />
              : null}
          </div>
          <div className="flex-1 bg-app-surface rounded-full h-9 flex items-center px-4 text-gray-500">
            {s.post_reply_placeholder}
          </div>
        </div>
      </div>

      <BookmarkToast visible={showBookmarkToast} onClose={() => setShowBookmarkToast(false)} />
    </div>
    {showSortMenu && <XSheetFrame kind="replySort" title={s.post_sort_replies}>
      <div role="radiogroup">{sortOptions.map(option => <button type="button" role="radio" aria-checked={sortMethod === option.value}
        key={option.value} {...option.props} className="w-full flex items-center justify-between p-4 rounded-xl active:bg-app-surface">
        <span className="font-bold text-base">{option.label}</span>{sortMethod === option.value && <IcCheck size={20} className="text-blue-500" />}
      </button>)}</div>
    </XSheetFrame>}
    </div>
  );
};

interface ReplyItemProps {
  reply: XPost & { author?: { id: string; name: string; avatar?: string; verified?: boolean } };
  // Parent 一次性传入用户字典, 避免每个回复实例各自订阅整个 user table。
  users: Record<string, any>;
}

const ReplyItem: React.FC<ReplyItemProps> = ({ reply, users }) => {
  const { bindTap, go } = useXGestures();
  const { id } = useParams();
  const { openOnce } = useXOverlayControls();
  const author = reply.author ?? users[reply.authorId];

  return (
    <div className="border-b border-app-border p-4 flex">
      <div
        className="w-10 h-10 rounded-full bg-gray-200 mr-3 overflow-hidden shrink-0"
        {...bindTap('user.open.fromPost', { params: { id: reply.authorId } })}
      >
        {author?.avatar
          ? <XImage src={author.avatar} alt={author.name} className="w-full h-full object-cover" />
          : null}
      </div>
      <div className="flex-1">
        <div className="flex items-center text-gray-500 text-sm">
          <span className="font-bold text-app-text mr-1">{author?.name ?? 'Unknown'}</span>
          {author?.verified && <span className="text-blue-400 mr-1">✓</span>}
          <span className="mr-1">{author?.id ? `@${author.id}` : '@unknown'}</span>
          <span>· {reply.time}</span>
        </div>
        <div className="mt-1 text-app-text whitespace-pre-wrap">{reply.content}</div>

        <XPostActionBar
          postId={reply.id}
          stats={reply.stats}
          actionIds={{
            retweet: 'post.item.retweet',
            like: 'post.item.like',
          }}
          showCounts
          showBookmark={false}
          iconSize={16}
          className="mt-3 max-w-[300px]"
          retweetTapProps={bindTap('status.retweet.menu.open', { params: { id: id || '', sheetPostId: reply.id }, stopPropagation: true, onTrigger: () => openOnce(() => go('status.retweet.menu.open', { id: id || '', sheetPostId: reply.id })) })}
        />

        {/* Nested Replies */}
        {reply.replies && reply.replies.length > 0 && (
          <div className="mt-3">
            {reply.replies.map(subReply => (
              <ReplyItem key={subReply.id} reply={subReply} users={users} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
