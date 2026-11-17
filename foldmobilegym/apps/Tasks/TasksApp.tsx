import React, { useCallback } from 'react';
import './tasks-adaptive.css';
import { ArrowLeft, CalendarDays, CheckCircle2, Circle, ListTodo, Plus, Save, Star, Sun, Tag } from 'lucide-react';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { useAppNavigate } from './navigation';
import { useTasksGestures } from './hooks/useTasksGestures';
import { useTasksStore } from './state';

const formatDue = (value: string) => value ? value.slice(0, 16).replace('T', ' ') : '未设置';

const TaskList: React.FC<{ activeId?: string }> = ({ activeId }) => {
  const items = useTasksStore((state) => state.items);
  const beginCreate = useTasksStore((state) => state.beginCreate);
  const selectTask = useTasksStore((state) => state.selectTask);
  const { bindTap } = useTasksGestures();
  return (
    <section className="tasks-list">
      <header><div className="tasks-logo"><CheckCircle2 size={24} /></div><div><h1>Microsoft To Do</h1><small>个人帐户</small></div></header>
      <div className="tasks-filter" aria-label="智能列表"><span className="active"><Sun size={14}/>我的一天</span><span><Star size={14}/>重要</span><span>全部</span></div>
      <div className="tasks-items" data-scroll-container="tasks" data-scroll-direction="vertical">
        {items.map((item) => (
          <button key={item.id} className={activeId === item.id ? 'task-row active' : 'task-row'} {...bindTap<HTMLButtonElement>('tasks.item.open', { params: { id: item.id }, beforeTrigger: () => selectTask(item.id) })}>
            {item.completed ? <CheckCircle2 className="done" size={21} /> : <Circle size={21} />}
            <span><b>{item.title}</b><small><CalendarDays size={13} />{formatDue(item.due)} · {item.list}</small></span>
          </button>
        ))}
      </div>
      <button className="tasks-fab" aria-label="添加任务" data-benchmark-action="begin-task-form" {...bindTap<HTMLButtonElement>('tasks.new.open', { beforeTrigger: beginCreate })}><Plus size={22} /><span>添加任务</span></button>
    </section>
  );
};

const EmptyPanel: React.FC = () => <div className="tasks-empty"><ListTodo size={50} /><h2>选择一个待办</h2><p>展开屏幕可在右侧查看或创建任务。</p></div>;

const Form: React.FC = () => {
  const draft = useTasksStore((state) => state.draft);
  const updateDraft = useTasksStore((state) => state.updateDraft);
  const saveDraft = useTasksStore((state) => state.saveDraft);
  const cancelCreate = useTasksStore((state) => state.cancelCreate);
  const { bindTap, go } = useTasksGestures();
  const save = () => { const id = saveDraft(); if (id) go('tasks.item.open', { id }); };
  return (
    <section className="task-panel" data-benchmark-route="task-form">
      <header><button aria-label="取消" {...bindTap<HTMLButtonElement>('tasks.list.open', { beforeTrigger: cancelCreate })}><ArrowLeft size={22} /></button><div><b>添加任务</b><small>任务</small></div></header>
      <main className="task-form">
        <label><span>标题</span><input autoFocus data-action="tasks.form.title.input" data-benchmark-field="task-title" value={draft.title} onChange={(e) => updateDraft({ title: e.target.value })} placeholder="需要完成什么？" /></label>
        <label><span>截止时间</span><input data-action="tasks.form.due.input" data-benchmark-field="task-due" type="datetime-local" value={draft.due} onChange={(e) => updateDraft({ due: e.target.value })} /></label>
        <label><span>列表</span><select data-action="tasks.form.list.input" data-benchmark-field="task-list" value={draft.list} onChange={(e) => updateDraft({ list: e.target.value })}><option>工作</option><option>学习</option><option>购物</option><option>训练</option><option>个人</option></select></label>
        <label><span>备注</span><textarea data-action="tasks.form.note.input" data-benchmark-field="task-note" value={draft.note} onChange={(e) => updateDraft({ note: e.target.value })} placeholder="补充说明" rows={5} /></label>
      </main>
      <footer><button data-benchmark-action="save-task" data-keep-keyboard disabled={!draft.title.trim() || !draft.due} {...bindTap<HTMLButtonElement>({ kind: 'action', id: 'tasks.form.save' }, { onTrigger: save })}><Save size={18} />保存待办</button></footer>
    </section>
  );
};

const Detail: React.FC = () => {
  const { id = '' } = useParams();
  const item = useTasksStore((state) => state.items.find((task) => task.id === id));
  const beginCreate = useTasksStore((state) => state.beginCreate);
  const toggleTask = useTasksStore((state) => state.toggleTask);
  const { bindTap } = useTasksGestures();
  if (!item) return <div className="task-panel task-missing">未找到待办</div>;
  return (
    <section className="task-panel" data-benchmark-task-id={item.id}>
      <header><button aria-label="返回" {...bindTap<HTMLButtonElement>('tasks.list.open')}><ArrowLeft size={22} /></button><div><b>待办详情</b><small>{item.completed ? '已完成' : '未完成'}</small></div></header>
      <main className="task-detail"><button className="detail-state" {...bindTap<HTMLButtonElement>({ kind: 'action', id: 'tasks.detail.complete.toggle' }, { params: { taskId: item.id }, onTrigger: () => toggleTask(item.id) })}>{item.completed ? <CheckCircle2 size={26} /> : <Circle size={26} />}<h1>{item.title}</h1></button><dl><dt><CalendarDays size={17} />截止时间</dt><dd>{formatDue(item.due)}</dd><dt><Tag size={17} />列表</dt><dd>{item.list}</dd><dt>备注</dt><dd>{item.note || '无'}</dd></dl></main>
      <footer><button {...bindTap<HTMLButtonElement>('tasks.new.open', { beforeTrigger: beginCreate })}><Plus size={18} />新建另一个待办</button></footer>
    </section>
  );
};

const ListPage = () => <div className="tasks-layout"><TaskList /><EmptyPanel /></div>;
const FormPage = () => <div className="tasks-layout panel-open"><TaskList /><Form /></div>;
const DetailPage = () => { const { id } = useParams(); return <div className="tasks-layout panel-open"><TaskList activeId={id} /><Detail /></div>; };

const NavigationHandler: React.FC = () => {
  const { back } = useAppNavigate();
  const location = useLocation();
  const cancelCreate = useTasksStore((state) => state.cancelCreate);
  const onBack = useCallback(() => {
    if (location.pathname === '/') return false;
    if (location.pathname === '/new') cancelCreate();
    back(); return true;
  }, [back, cancelCreate, location.pathname]);
  useAppNavigationHandler('tasks', { onBack });
  return null;
};

const styles = `
  .tasks-root{height:100%;width:100%;container-type:inline-size;background:#f5f7fb;color:#252423;font-family:Inter,"Microsoft YaHei",sans-serif}.tasks-layout{height:100%;display:grid;grid-template-columns:1fr;overflow:hidden}
  .tasks-list{height:100%;position:relative;display:flex;flex-direction:column;background:#fff;overflow:hidden}.tasks-list>header{display:flex;align-items:center;gap:11px;padding:20px 18px 10px}.tasks-list h1{font-size:24px;margin:0}.tasks-list header small{color:#605e5c}.tasks-logo{width:41px;height:41px;border-radius:12px;display:grid;place-items:center;background:#2564cf;color:#fff}
  .tasks-filter{display:flex;gap:7px;padding:7px 14px 12px;overflow:auto}.tasks-filter span{display:flex;align-items:center;gap:5px;white-space:nowrap;border-radius:999px;padding:7px 12px;background:#f3f6fb;color:#605e5c;font-size:12px}.tasks-filter span.active{background:#e5f0fb;color:#2564cf;font-weight:600}
  .tasks-items{overflow:auto;padding:0 10px 86px}.task-row{width:100%;display:flex;gap:12px;align-items:flex-start;text-align:left;border:0;background:transparent;padding:14px 10px;border-radius:10px;color:#605e5c}.task-row.active,.task-row:hover{background:#edf4fc;color:#2564cf}.task-row .done{color:#2564cf}.task-row>span{display:flex;flex-direction:column;min-width:0;color:#252423}.task-row b{font-size:15px}.task-row small{display:flex;align-items:center;gap:4px;margin-top:6px;color:#797775}
  .tasks-fab{position:absolute;left:14px;right:14px;bottom:16px;height:50px;border-radius:10px;border:0;background:#eef5fc;color:#2564cf;display:flex;align-items:center;justify-content:flex-start;gap:10px;padding:0 15px;font-weight:600;box-shadow:0 3px 12px #2564cf20}.tasks-empty{display:none}
  .task-panel{height:100%;display:flex;flex-direction:column;background:#fff;overflow:hidden}.task-panel>header{height:62px;border-bottom:1px solid #edebe9;display:flex;align-items:center;gap:10px;padding:0 14px}.task-panel>header button{border:0;background:transparent;padding:7px}.task-panel>header>div{display:flex;flex-direction:column}.task-panel header small{color:#797775}.task-form{flex:1;overflow:auto;padding:20px 18px}.task-form label{display:flex;flex-direction:column;gap:7px;margin-bottom:18px}.task-form label>span{font-size:13px;color:#605e5c;font-weight:600}.task-form input,.task-form select,.task-form textarea{border:1px solid #d2d0ce;border-radius:9px;padding:12px;font:inherit;outline:none;background:#fff}.task-form input:focus,.task-form textarea:focus{border-color:#2564cf;box-shadow:0 0 0 3px #2564cf1a}.task-panel>footer{padding:12px 18px 18px;border-top:1px solid #edebe9}.task-panel>footer button{width:100%;border:0;border-radius:10px;padding:12px;background:#2564cf;color:white;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:600}.task-panel>footer button:disabled{opacity:.4}
  .task-detail{flex:1;overflow:auto;padding:28px 22px}.detail-state{width:100%;display:flex;align-items:flex-start;gap:13px;color:#2564cf;background:transparent;border:0;text-align:left;padding:0}.detail-state h1{font-size:25px;margin:0;color:#252423}.task-detail dl{margin-top:30px}.task-detail dt{display:flex;gap:7px;align-items:center;color:#605e5c;font-size:13px;margin-top:20px}.task-detail dd{margin:6px 0 0;font-size:16px;white-space:pre-wrap}.task-missing{display:grid;place-content:center}
  @container (min-width:600px){.tasks-layout{grid-template-columns:320px minmax(0,1fr)}.tasks-list{border-right:1px solid #e5e0eb}.tasks-empty{display:grid;place-content:center;text-align:center;color:#8c8496}.tasks-empty h2{color:#433d4b;margin:14px 0 4px}.task-panel>header button{display:none}}
  @container (max-width:599px){.panel-open .tasks-list{display:none}}
`;

const TasksApp: React.FC = () => (
  <div className="tasks-root pt-10" data-status-bar-foreground="dark" data-reference-pattern="MicrosoftToDo-Android"><style>{styles}</style><MemoryRouter><NavigationHandler /><Routes><Route path="/" element={<ListPage />} /><Route path="/new" element={<FormPage />} /><Route path="/task/:id" element={<DetailPage />} /></Routes></MemoryRouter></div>
);
export default TasksApp;
