import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock3, FileText, FolderOpen, Search, ShieldCheck, Star } from 'lucide-react';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { useAppNavigate } from './navigation';
import { useWorkspaceDocsGestures } from './hooks/useWorkspaceDocsGestures';
import { IcLauncher } from './res/icons';
import { useWorkspaceDocsStore, type WorkspaceDocument } from './state';

const DocumentList: React.FC<{ activeId?: string }> = ({ activeId }) => {
  const documents = useWorkspaceDocsStore((state) => state.documents);
  const selectDocument = useWorkspaceDocsStore((state) => state.selectDocument);
  const { bindTap } = useWorkspaceDocsGestures();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => documents.filter((doc) => doc.title.includes(query) || doc.body.includes(query)), [documents, query]);
  return (
    <section className="docs-list" aria-label="文档列表">
      <div className="docs-brand"><div className="docs-logo"><IcLauncher className="docs-logo-icon" /></div><div><strong>WPS Office</strong><small>最近</small></div></div>
      <label className="docs-search"><Search size={17} /><input aria-label="搜索文档" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题或正文" /></label>
      <nav className="docs-filter" aria-label="文档分类"><span className="active"><Clock3 size={14}/>最近</span><span><Star size={14}/>已加星标</span><span><FolderOpen size={14}/>项目</span></nav>
      <div className="docs-items" data-scroll-container="documents" data-scroll-direction="vertical">
        {filtered.map((doc) => (
          <button key={doc.id} className={activeId === doc.id ? 'docs-item active' : 'docs-item'} {...bindTap<HTMLButtonElement>('workspace_docs.document.open', { params: { id: doc.id }, beforeTrigger: () => selectDocument(doc.id) })}>
            <span className="docs-file"><FileText size={20} /></span><span><b>{doc.title}</b><small>{doc.category} · {doc.updated}</small></span>
          </button>
        ))}
      </div>
      <div className="docs-safe"><ShieldCheck size={16} /> 文件已保存到此设备</div>
    </section>
  );
};

const Reader: React.FC<{ document: WorkspaceDocument }> = ({ document }) => {
  const verifiedIds = useWorkspaceDocsStore((state) => state.verifiedIds);
  const verifyDocument = useWorkspaceDocsStore((state) => state.verifyDocument);
  const closeDocument = useWorkspaceDocsStore((state) => state.closeDocument);
  const { bindTap } = useWorkspaceDocsGestures();
  const verified = verifiedIds.includes(document.id);
  return (
    <article className="docs-reader" data-benchmark-document-id={document.id}>
      <header><button aria-label="返回文档列表" {...bindTap<HTMLButtonElement>('workspace_docs.library.open', { beforeTrigger: closeDocument })}><ArrowLeft size={22} /></button><div><b>{document.title}</b><small>只读 · {document.updated}</small></div><span className="docs-reader-mode">阅读模式</span></header>
      <main data-scroll-container="document" data-scroll-direction="vertical"><div className="docs-paper"><span className="docs-category">{document.category}</span><h1>{document.title}</h1><div className="docs-meta"><FileText size={14}/>工作空间 / 项目资料</div><div className="docs-body">{document.body}</div></div></main>
      <footer><button data-benchmark-action="verify-source-facts" className={verified ? 'verified' : ''} {...bindTap<HTMLButtonElement>({ kind: 'action', id: 'workspaceDocs.document.fact.verify' }, { onTrigger: () => verifyDocument(document.id) })}><CheckCircle2 size={18} />{verified ? '已完成阅读' : '完成阅读'}</button></footer>
    </article>
  );
};

const LibraryPage: React.FC = () => <div className="docs-layout"><DocumentList /><div className="docs-empty"><FileText size={48} /><h2>选择一份工作文档</h2><p>展开屏幕时，文档将在右侧保持可见。</p></div></div>;

const DocumentPage: React.FC = () => {
  const { id = '' } = useParams();
  const document = useWorkspaceDocsStore((state) => state.documents.find((item) => item.id === id));
  const selectDocument = useWorkspaceDocsStore((state) => state.selectDocument);
  useEffect(() => { if (document) selectDocument(document.id); }, [document, selectDocument]);
  if (!document) return <div className="docs-missing">未找到文档</div>;
  return <div className="docs-layout document-open"><DocumentList activeId={document.id} /><Reader document={document} /></div>;
};

const NavigationHandler: React.FC = () => {
  const { back } = useAppNavigate();
  const location = useLocation();
  const closeDocument = useWorkspaceDocsStore((state) => state.closeDocument);
  const onBack = useCallback(() => {
    if (location.pathname === '/') return false;
    closeDocument(); back(); return true;
  }, [back, closeDocument, location.pathname]);
  useAppNavigationHandler('workspace_docs', { onBack });
  return null;
};

const styles = `
  .docs-root{height:100%;width:100%;container-type:inline-size;background:#f3f6fb;color:#172033;font-family:Inter,"Microsoft YaHei",sans-serif}
  .docs-layout{height:100%;display:grid;grid-template-columns:1fr;overflow:hidden}.docs-list{height:100%;display:flex;flex-direction:column;background:#fff;overflow:hidden}
  .docs-brand{display:flex;align-items:center;gap:11px;padding:20px 18px 12px}.docs-brand>div:last-child{display:flex;flex-direction:column}.docs-brand strong{font-size:21px}.docs-brand small,.docs-item small{color:#788296;margin-top:3px}
  .docs-logo{width:40px;height:40px;border-radius:10px;background:#ef3340;color:white;display:grid;place-items:center}.docs-logo-icon{width:30px;height:30px}.docs-search{margin:0 16px 12px;display:flex;align-items:center;gap:8px;background:#f1f4f9;border:1px solid #e2e7ef;border-radius:12px;padding:10px 12px}.docs-search input{border:0;outline:0;background:transparent;width:100%;font-size:14px}
  .docs-filter{display:flex;gap:7px;padding:0 15px 12px;overflow:auto}.docs-filter span{display:flex;align-items:center;gap:5px;white-space:nowrap;padding:7px 10px;border-radius:999px;background:#f1f4f9;color:#697386;font-size:12px}.docs-filter .active{background:#e5efff;color:#1d5fc8;font-weight:700}.docs-items{overflow:auto;padding:0 10px 12px}.docs-item{width:100%;min-height:64px;display:flex;align-items:center;gap:12px;text-align:left;border:0;background:transparent;border-radius:13px;padding:12px 10px;color:inherit}.docs-item:hover,.docs-item.active{background:#eaf1ff}.docs-item>span:last-child{display:flex;flex-direction:column;min-width:0}.docs-file{width:38px;height:42px;border-radius:8px;background:#e7efff;color:#2563eb;display:grid;place-items:center;flex:none}
  .docs-safe{margin:auto 15px 16px;padding:11px;border-radius:11px;background:#eefbf4;color:#26734a;font-size:12px;display:flex;gap:7px;align-items:center}.docs-empty{display:none}
  .docs-reader{height:100%;display:flex;flex-direction:column;background:#f3f6fb;overflow:hidden}.docs-reader header{height:62px;border-bottom:1px solid #e4e8ef;display:flex;align-items:center;gap:10px;padding:0 14px;background:#fff}.docs-reader header button{border:0;background:transparent;padding:7px}.docs-reader header div{display:flex;flex-direction:column;min-width:0}.docs-reader header b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.docs-reader header small{color:#7b8494}.docs-reader-mode{margin-left:auto;padding:6px 9px;border-radius:8px;background:#edf3ff;color:#2563eb;font-size:12px}.docs-reader main{flex:1;overflow:auto;padding:24px}.docs-paper{max-width:720px;min-height:calc(100% - 32px);margin:0 auto;background:#fff;border:1px solid #e5eaf1;border-radius:8px;padding:34px 38px;box-shadow:0 6px 24px #1e3a5f0d}.docs-reader h1{font-size:27px;margin:15px 0 8px}.docs-meta{display:flex;align-items:center;gap:6px;color:#8a94a5;font-size:12px;margin-bottom:26px}.docs-category{color:#2563eb;background:#e8f0ff;border-radius:999px;padding:5px 10px;font-size:12px}.docs-body{white-space:pre-wrap;font-size:17px;line-height:1.9}.docs-reader footer{padding:12px 18px 18px;border-top:1px solid #edf0f4;background:#fff}.docs-reader footer button{width:100%;min-height:44px;border:0;border-radius:12px;background:#2563eb;color:white;padding:12px;display:flex;justify-content:center;align-items:center;gap:8px;font-weight:600}.docs-reader footer button.verified{background:#168354}
  @container (min-width:600px){.docs-layout{grid-template-columns:310px minmax(0,1fr)}.docs-list{border-right:1px solid #dfe5ee}.docs-empty{display:grid;place-content:center;text-align:center;color:#8590a3}.docs-empty h2{margin:14px 0 4px;color:#354057}.docs-reader header button{display:none}}
  @container (max-width:599px){.document-open .docs-list{display:none}.docs-reader main{padding:14px}.docs-paper{border:0;box-shadow:none;padding:24px 18px;min-height:100%}.docs-reader h1{font-size:23px}.docs-reader-mode{display:none}}
`;

const WorkspaceDocsApp: React.FC = () => (
  <div className="docs-root pt-10" data-status-bar-foreground="dark" data-reference-pattern="WPSOffice-Android"><style>{styles}</style><MemoryRouter><NavigationHandler /><Routes><Route path="/" element={<LibraryPage />} /><Route path="/document/:id" element={<DocumentPage />} /></Routes></MemoryRouter></div>
);
export default WorkspaceDocsApp;
