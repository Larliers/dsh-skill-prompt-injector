import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type {} from '@deepseek-ai/dsh-api-remotes/client';
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client';
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-plugin-manager';
import { Button, Checkbox, Input } from '@deepseek-ai/dsh-client-ui-primitives';
import { PACKAGE, remoteInfo, unwrap, type DashboardRemote } from './remote.js';
import { changeSchema, draftEnd, itemLabel, missingRefs, parseTags, promptRef, promptSchema, refKey, reorder, resolveGlobal, resolveItems, skillRef, textToAppend, type Catalog, type Change, type Combination, type GlobalConfig, type ItemRef, type Prompt, type Skill } from './model.js';
import { createClientState, type ViewState } from './client-state.js';
import css from './styles.css';

export const inject = ['remote', 'sessions', 'conversation', 'slots', 'sidebarRight', 'sidebarRightTabs'];
type Props = PropsRuntime<'sidebar.right.pane.tab'>;
type Editor = { kind: 'prompt'; prompt?: Prompt } | { kind: 'tags'; skill: Skill } | { kind: 'combinations' } | { kind: 'combination'; combination?: Combination; rename?: boolean } | { kind: 'delete'; item: Prompt | Combination; type: 'prompt' | 'combination' } | null;
function message(error: unknown) { return error instanceof Error ? error.message : String(error); }

export async function apply(ctx: Context) {
  const off = await ctx.remote.$mount(remoteInfo);
  ctx.effect(() => off);
  ctx.inject(['remote.skillDashboard'], scope => mount(scope));
  ctx.effect(() => {
    const style = document.createElement('style'); style.dataset.plugin = PACKAGE; style.textContent = css;
    document.head.appendChild(style); return () => { style.remove(); };
  });
}
function mount(ctx: Context) {
  const remote = (ctx.remote as unknown as { skillDashboard: DashboardRemote }).skillDashboard;
  const client = createClientState();
  ctx.effect(() => ctx.sidebarRightTabs.register({ id: PACKAGE, kind: 'skill-prompt-injector', title: () => '技能与快捷提示',
    guide: [{ id: 'dashboard', order: 35, title: () => '技能与快捷提示', description: () => '搜索并选择 Skill 与 Prompt，一键注入当前对话' }], keepMounted: true }));

  function Dashboard(props: Props) {
    const store = client.forSession(props.sessionId);
    const view = useSyncExternalStore(store.subscribe, store.getSnapshot);
    const library = useSyncExternalStore(client.library.subscribe, client.library.getSnapshot);
    const [catalog, setCatalog] = useState<Catalog>({ skills: [], complete: true });
    const [catalogError, setCatalogError] = useState('');
    const [dataError, setDataError] = useState('');
    const [globalReady, setGlobalReady] = useState(true);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
    const [editor, setEditor] = useState<Editor>(null);
    const [epoch, setEpoch] = useState(0);
    const [height, setHeight] = useState(600);
    const [dragOver, setDragOver] = useState<number | null>(null);
    const root = useRef<HTMLDivElement>(null);
    const generation = useRef(0);
    const drag = useRef(-1);
    const inFlight = useRef(false);
    const { tab } = props.useTabInfo();
    const phase = props.useInput(s => s.phase);
    const contextKey = props.useSessions(s => s.byId[props.sessionId]?.cwd);
    const update = (patch: Partial<ViewState>) => store.set({ ...store.getSnapshot(), ...patch });
    const announce = (text: string, error = false) => setNotice({ text, error });
    const refresh = useCallback(() => { generation.current++; setEpoch(n => n + 1); }, []);
    const loadData = useCallback(async () => {
      const data = unwrap(await remote.read()); client.library.set(data); setDataError(''); return data;
    }, []);

    useEffect(() => {
      const resize = new ResizeObserver(entries => setHeight(entries[0].contentRect.height));
      if (root.current) resize.observe(root.current); return () => resize.disconnect();
    }, []);
    useEffect(() => {
      const offPreset = ctx.remote.$on('agent-preset/selected', refresh);
      const offPlugins = ctx.remote.$on('plugin-manager/changed', refresh);
      const offConnection = ctx.on('connection/reset', refresh);
      const offMounted = ctx.sidebarRight.mounted.subscribe(() => { generation.current++; });
      window.addEventListener('focus', refresh);
      return () => { offPreset(); offPlugins(); offConnection(); offMounted(); window.removeEventListener('focus', refresh); generation.current++; };
    }, [refresh]);
    useEffect(() => {
      if (!tab.visible) return;
      const timer = window.setInterval(refresh, 15000); return () => window.clearInterval(timer);
    }, [tab.visible, refresh]);
    useEffect(() => {
      generation.current++;
      const abort = new AbortController(); let active = true;
      setLoading(true);
      Promise.allSettled([
        remote.catalog({ sessionId: props.sessionId }, abort.signal).then(unwrap),
        remote.read().then(unwrap),
        remote.health().then(unwrap),
      ]).then(([skills, data, health]) => {
        if (!active) return;
        if (skills.status === 'fulfilled') { setCatalog(skills.value); setCatalogError(''); } else setCatalogError(message(skills.reason));
        if (data.status === 'fulfilled') { client.library.set(data.value); setDataError(''); } else setDataError(message(data.reason));
        setGlobalReady(health.status === 'fulfilled' ? health.value.systemPrompt : false);
        setLoading(false);
      });
      return () => { active = false; abort.abort(); };
    }, [props.sessionId, contextKey, epoch]);

    async function run(work: () => Promise<void>) {
      if (inFlight.current) return false;
      inFlight.current = true; setBusy(true); setNotice(null);
      try { await work(); return true; } catch (error) { announce(message(error), true); return false; }
      finally { inFlight.current = false; setBusy(false); }
    }
    async function change(value: Change) {
      const parsed = changeSchema.parse(value);
      client.library.set(unwrap(await remote.change(parsed))); setDataError('');
    }
    function toggle(ref: ItemRef) {
      if (busy) return;
      const items = store.getSnapshot().items;
      update({ items: items.some(i => refKey(i) === refKey(ref)) ? items.filter(i => refKey(i) !== refKey(ref)) : [...items, ref] });
    }
    const phaseLabel = (value: string) => value === 'submitting' ? '正在提交' : value === 'claimed' ? '正在处理命令' : value === 'adjudicating' ? '正在解析指令' : '正忙';
    async function injectItems() {
      const selected = [...store.getSnapshot().items];
      const target = ctx.sessions.binding(props.sessionId);
      const gen = generation.current;
      await run(async () => {
        if (!target || !selected.length) throw new Error('请先选择要填入的条目');
        if (catalogError && selected.some(ref => ref.kind === 'skill')) throw new Error(`Skill 目录读取失败（${catalogError}），当前只能注入 Prompt；请刷新后重试`);
        const [current, currentCatalog] = await Promise.all([loadData(), catalogError ? Promise.resolve({ skills: [], complete: false }) : remote.catalog({ sessionId: props.sessionId }).then(unwrap)]);
        if (ctx.sessions.binding(props.sessionId) !== target || gen !== generation.current) throw new Error('会话已切换，本次未填入，请在目标会话重试');
        setCatalog(currentCatalog);
        const resolved = resolveItems(selected, current, currentCatalog.skills);
        if (resolved.missing.length) throw new Error(`有 ${resolved.missing.length} 个条目已删除或当前不可用，请移除或替换红色缺项`);
        const read = () => ctx.conversation.input.for(target.ctx).state.getSnapshot();
        const input = read();
        if (input.phase !== 'plain') throw new Error(`输入框${phaseLabel(input.phase)}，请等这次提交结束后再试`);
        const end = draftEnd(input);
        const ok = props.inputActions.insertText(textToAppend(input.draft, resolved.text), { start: end, end, draftRev: input.draftRev });
        if (!ok) {
          const after = read();
          throw new Error(after.draftRev !== input.draftRev ? '草稿在写入前被改动，本次未填入，请重试' : after.phase !== 'plain' ? `输入框${phaseLabel(after.phase)}，本次未填入，请稍后再试` : '输入框拒绝了这次写入，请重试');
        }
        const landed = read();
        if (!landed.draft.includes(resolved.text.split('\n')[0] ?? '')) throw new Error('已尝试写入，但内容没有落到目标会话输入框，请重试');
        update({ items: [], combinationId: undefined });
        try { props.inputActions.persistDraft(); } catch { announce('已填入输入框，但草稿持久化失败，请保持当前窗口', true); return; }
        announce(`已追加 ${selected.length} 项到输入框，请检查后手动发送`);
      });
    }
    const skills = catalog.skills;
    const prompts = library?.prompts.prompts ?? [];
    const skillMeta = (s: Skill) => library?.library.skillMeta.find(m => m.id === s.id) ?? { id: s.id, name: s.name, tags: [], favorite: false };
    const globalConfig = library?.library.global;
    const globalView = library ? resolveGlobal(library) : { entries: [] as ReturnType<typeof resolveGlobal>['entries'], missing: [] as ItemRef[], text: '' };
    // Skill 目录读取失败时只把"Prompt 缺失"算缺项：Skill 一律在注入时报目录不可用，不把整块界面变成红色。
    const missing = new Set(library ? missingRefs(view.items, library, skills, { catalogFailed: !!catalogError }).map(refKey) : []);
    const matches = (name: string, description: string, tags: string[], favorite: boolean) => (!view.favorites || favorite) && (!view.tag || tags.includes(view.tag)) && `${name}\n${description}\n${tags.join(' ')}`.toLocaleLowerCase().includes(view.query.trim().toLocaleLowerCase());
    const visibleSkills = skills.filter(s => { const m = skillMeta(s); return matches(s.name, s.description, m.tags, m.favorite); });
    const visiblePrompts = prompts.filter(p => matches(p.title, p.body, p.tags, p.favorite));
    const allTags = [...new Set(view.tab === 'skills' ? skills.flatMap(s => skillMeta(s).tags) : view.tab === 'prompts' ? prompts.flatMap(p => p.tags) : [])].sort((a,b) => a.localeCompare(b, 'zh'));
    const selected = new Set(view.items.map(refKey));
    const collapsed = view.collapsed || height < 280;
    const locked = busy || !!dataError || !library;
    const combination = library?.library.combinations.find(c => c.id === view.combinationId);
    const move = (from: number, to: number) => { if (!busy) update({ items: reorder(store.getSnapshot().items, from, to) }); };
    const closeEditor = () => setEditor(null);
    // 按钮能不能点，以及点不了时的原因；原因会显示在按钮下方，不再只是灰着。
    const disabledReason = busy ? '正在处理上一条操作…'
      : dataError ? '本地数据读取失败，请点右上角刷新重试'
      : !library ? '正在读取本地数据…'
      : !view.items.length ? '先在列表里勾选条目'
      : missing.size ? `有 ${missing.size} 个缺项，请先移除或替换`
      : '';
    async function saveGlobal(next: GlobalConfig) {
      if (!library) return;
      await run(async () => { await change({ type: 'global.save', revision: library.library.revision, global: next }); });
    }
    async function setGlobalItems() {
      const chosen = [...store.getSnapshot().items];
      if (!library || !globalConfig || !chosen.length) return;
      const items = [...globalConfig.items];
      const skillFacts = { ...globalConfig.skillFacts };
      for (const ref of chosen) {
        if (!items.some(existing => refKey(existing) === refKey(ref))) items.push(ref);
        if (ref.kind === 'skill') {
          const skill = skills.find(candidate => candidate.id === ref.id);
          if (skill) skillFacts[ref.id] = { description: skill.description, ...(skill.path ? { path: skill.path } : {}) };
        }
      }
      const ok = await run(async () => { await change({ type: 'global.save', revision: library.library.revision, global: { ...globalConfig, items, skillFacts } }); announce(`已加入全局注入（共 ${items.length} 项）`); });
      if (ok) update({ items: [], combinationId: undefined });
    }
    const moveGlobal = (from: number, to: number) => { if (globalConfig && !busy) void saveGlobal({ ...globalConfig, items: reorder(globalConfig.items, from, to) }); };
    const removeGlobal = (index: number) => { if (globalConfig && !busy) void saveGlobal({ ...globalConfig, items: globalConfig.items.filter((_, n) => n !== index) }); };
    const toggleGlobal = async () => { if (!globalConfig) return; await run(async () => { await change({ type: 'global.save', revision: library!.library.revision, global: { ...globalConfig, enabled: !globalConfig.enabled } }); announce(globalConfig.enabled ? '已停用全局注入' : '已启用全局注入'); }); };

    return <div ref={root} className="sd" data-skill-dashboard data-short={height < 440}>
      <header className="sd-header">
        <div className="sd-row"><h3 className="sd-title">技能与快捷提示</h3><Button size="sm" aria-label="刷新 Skill 与本地数据" disabled={busy} onClick={refresh}>{loading ? '读取中…' : '↻ 刷新'}</Button></div>
        <div className="sd-tabs" role="tablist" aria-label="条目类型">
          <Button size="sm" role="tab" aria-selected={view.tab === 'skills'} onClick={() => { update({ tab: 'skills', tag: '' }); closeEditor(); }}>Skills · {skills.length}</Button>
          <Button size="sm" role="tab" aria-selected={view.tab === 'prompts'} onClick={() => { update({ tab: 'prompts', tag: '' }); closeEditor(); }}>Prompts · {prompts.length}</Button>
          <Button size="sm" role="tab" aria-selected={view.tab === 'global'} onClick={() => { update({ tab: 'global', tag: '' }); closeEditor(); }}>全局 · {globalConfig?.items.length ?? 0}</Button>
        </div>
        {view.tab !== 'global' && <Input className="sd-search" aria-label="搜索名称、描述或标签" placeholder="搜索名称、描述、标签…" type="search" value={view.query} onChange={e => update({ query: e.target.value })}/>}
        {view.tab !== 'global' && <div className="sd-row sd-toolbar">
          <Button size="sm" aria-pressed={view.favorites} onClick={() => update({ favorites: !view.favorites })}>{view.favorites ? '★' : '☆'} 收藏</Button>
          <select aria-label="标签筛选" value={view.tag} onChange={e => update({ tag: e.target.value })}><option value="">全部标签</option>{allTags.map(t => <option key={t}>{t}</option>)}</select>
          <Button className="sd-combos" size="sm" aria-expanded={editor?.kind === 'combinations'} disabled={!library} onClick={() => setEditor(editor?.kind === 'combinations' ? null : { kind: 'combinations' })}>组合 ▾</Button>
          {view.tab === 'prompts' && <Button size="sm" disabled={locked} onClick={() => setEditor({ kind: 'prompt' })}>＋新建</Button>}
        </div>}
      </header>
      {dataError && <p className="sd-notice" role="alert" data-error>{dataError}</p>}
      {catalogError && <p className="sd-notice" role="alert" data-error>Skill 读取失败：{catalogError}，请刷新重试</p>}
      {!catalog.complete && <p className="sd-notice">部分 Skill 来源未完成读取，仅展示已确认条目，可刷新重试。</p>}
      <main className="sd-main" aria-label="条目与编辑区">
        {editor?.kind === 'prompt' && <PromptForm key={editor.prompt?.id ?? 'new'} initial={editor.prompt} busy={busy} cancel={closeEditor} save={async value => {
          const ok = await run(async () => { if (!library) return; await change({ type: 'prompt.save', revision: library.prompts.revision, prompt: value }); announce('Prompt 已保存'); }); if (ok) closeEditor();
        }}/>}
        {editor?.kind === 'tags' && <NameForm title={`编辑标签：${editor.skill.name}`} label="标签（用逗号分隔）" initial={skillMeta(editor.skill).tags.join('，')} busy={busy} cancel={closeEditor} save={async value => {
          const ok = await run(async () => { if (!library) return; await change({ type: 'skill.meta', revision: library.library.revision, meta: { ...skillMeta(editor.skill), tags: parseTags(value) } }); }); if (ok) closeEditor();
        }}/>}
        {editor?.kind === 'combination' && <NameForm title={editor.rename ? '重命名组合' : editor.combination ? '覆盖保存组合' : '保存新组合'} label="组合名称" initial={editor.combination?.name ?? ''} required busy={busy} cancel={closeEditor} save={async value => {
          const ok = await run(async () => { if (!library) return; await change({ type: 'combination.save', revision: library.library.revision, combination: { ...(editor.combination ? { id: editor.combination.id } : {}), name: value, items: editor.rename ? editor.combination!.items : store.getSnapshot().items } }); announce('组合已保存'); }); if (ok) closeEditor();
        }}/>}
        {editor?.kind === 'delete' && <div className="sd-editor"><h4>删除“{'title' in editor.item ? editor.item.title : editor.item.name}”？</h4><p className="sd-hint">{editor.type === 'prompt' ? '引用此 Prompt 的组合会保留缺项，修正后才能填入。' : '组合中的原始 Skill 和 Prompt 继续保留。'}</p><div className="sd-row"><Button size="sm" disabled={busy} onClick={closeEditor}>取消</Button><Button size="sm" disabled={locked} onClick={async () => { const ok = await run(async () => { if (!library) return; await change(editor.type === 'prompt' ? { type: 'prompt.delete', revision: library.prompts.revision, id: editor.item.id } : { type: 'combination.delete', revision: library.library.revision, id: editor.item.id }); }); if (ok) closeEditor(); }}>确认删除</Button></div></div>}
        {editor?.kind === 'combinations' && <div className="sd-editor"><div className="sd-row"><h4 className="sd-title">已保存组合</h4><Button size="sm" onClick={closeEditor}>返回列表</Button></div>
          {!library?.library.combinations.length && <p className="sd-empty">多选条目后，点击下方“保存组合”。</p>}
          {library?.library.combinations.map(c => { const absent = resolveItems(c.items, library, skills).missing.length; return <section key={c.id} className="sd-combination"><h4>{c.name}</h4><p className="sd-hint">{c.items.length} 项{absent ? ` · ${absent} 项当前不可用` : ''}</p><div className="sd-row"><Button size="sm" disabled={busy} onClick={() => { update({ items: [...c.items], combinationId: c.id, collapsed: false }); closeEditor(); announce(absent ? '组合已载入，请修正红色缺项' : `已载入“${c.name}”`); }}>载入</Button><Button size="sm" disabled={locked} onClick={() => setEditor({ kind: 'combination', combination: c, rename: true })}>重命名</Button><Button size="sm" disabled={locked} onClick={() => setEditor({ kind: 'delete', type: 'combination', item: c })}>删除</Button></div></section>; })}
        </div>}
        {!editor && view.tab === 'skills' && <>
          <p className="sd-hint">当前会话可用 · {visibleSkills.length} 项</p>
          {!visibleSkills.length && <p className="sd-empty">{loading ? '正在读取 Skill…' : catalogError ? '暂时无法读取 Skill，请刷新。' : skills.length ? '没有匹配的 Skill，试试清除筛选。' : '当前会话没有可调用的 Skill。'}</p>}
          <div className="sd-grid">
          {visibleSkills.map(s => { const meta = skillMeta(s); const ref = skillRef(s); return <article className="sd-card" key={s.id} data-selected={selected.has(refKey(ref))}>
            <div className="sd-card-head"><div className="sd-choice"><Checkbox checked={selected.has(refKey(ref))} disabled={busy} onChange={() => toggle(ref)} label={s.name}/></div><Button size="sm" aria-label={`${meta.favorite ? '取消收藏' : '收藏'} ${s.name}`} aria-pressed={meta.favorite} disabled={locked} onClick={() => run(async () => { if (library) await change({ type: 'skill.meta', revision: library.library.revision, meta: { ...meta, favorite: !meta.favorite } }); })}>{meta.favorite ? '★' : '☆'}</Button></div>
            <p className="sd-desc">{s.description || '暂无描述'}</p><div className="sd-tags">{meta.tags.map(t => <span key={t} className="sd-tag">{t}</span>)}</div>
            <details><summary>详情</summary><div className="sd-detail">{s.description}{s.whenToUse && <p>{s.whenToUse}</p>}<p>来源：{s.origin}</p>{s.path && <p>{s.path}</p>}<div className="sd-row"><Button size="sm" disabled={locked} onClick={() => setEditor({ kind: 'tags', skill: s })}>编辑标签</Button>{s.path && <Button size="sm" onClick={() => ctx.sidebarRight.openResource(`dsh-resource://file/session/${encodeURIComponent(props.sessionId)}/${s.path!.split('/').map(p => encodeURIComponent(p).replace(/%3A/gi, ':')).join('/')}`)}>打开 SKILL.md</Button>}</div></div></details>
          </article>; })}
          </div>
        </>}
        {!editor && view.tab === 'prompts' && <>
          <p className="sd-hint">本地 Prompt · {visiblePrompts.length} 项</p>
          {!visiblePrompts.length && <p className="sd-empty">{loading ? '正在读取 Prompt…' : prompts.length ? '没有匹配的 Prompt，试试清除筛选。' : '还没有 Prompt，点击“＋新建”保存常用文本。'}</p>}
          <div className="sd-grid">
          {visiblePrompts.map(p => { const ref = promptRef(p); return <article className="sd-card" key={p.id} data-selected={selected.has(refKey(ref))}>
            <div className="sd-card-head"><div className="sd-choice"><Checkbox checked={selected.has(refKey(ref))} disabled={busy} onChange={() => toggle(ref)} label={p.title}/></div><Button size="sm" aria-label={`${p.favorite ? '取消收藏' : '收藏'} ${p.title}`} aria-pressed={p.favorite} disabled={locked} onClick={() => run(async () => { if (library) await change({ type: 'prompt.save', revision: library.prompts.revision, prompt: { ...p, favorite: !p.favorite } }); })}>{p.favorite ? '★' : '☆'}</Button></div>
            <p className="sd-desc">{p.body}</p><div className="sd-tags">{p.tags.map(t => <span key={t} className="sd-tag">{t}</span>)}</div><div className="sd-card-actions"><details><summary>全文</summary><div className="sd-detail">{p.body}</div></details><div className="sd-row"><Button size="sm" disabled={locked} onClick={() => setEditor({ kind: 'prompt', prompt: p })}>编辑</Button><Button size="sm" disabled={locked} onClick={() => setEditor({ kind: 'delete', type: 'prompt', item: p })}>删除</Button></div></div>
          </article>; })}
          </div>
        </>}
        {!editor && view.tab === 'global' && <>
          <div className="sd-row sd-global-head">
            <Button size="sm" aria-pressed={globalConfig?.enabled ?? false} disabled={locked || !globalConfig || !globalReady} onClick={toggleGlobal}>{globalConfig?.enabled ? '全局注入已启用' : '全局注入已停用'}</Button>
            <span className="sd-hint">{globalView.text ? `${globalView.text.length} 字符` : '当前为空，不会进入系统提示'}</span>
          </div>
          <p className="sd-hint">每次模型请求都会带着这些内容，对所有对话生效；改完即时生效。</p>
          {!globalReady && <p className="sd-notice" data-error>当前 DSH 组合没有提供系统提示服务，全局注入不会生效。</p>}
          {globalView.text.length > 20000 && <p className="sd-notice" data-error>全局注入已 {globalView.text.length} 字符，会明显占用每个对话的上下文。</p>}
          {!globalView.entries.length && <p className="sd-empty">还没有全局条目。在 Skills 或 Prompts 里勾选后，点下方「设为全局」。</p>}
          {globalView.entries.length > 0 && <ol className="sd-tray-list" aria-label="全局注入条目">{globalView.entries.map((entry, i) => <li key={refKey(entry.ref)} className="sd-tray-item" data-missing={entry.missing !== null}>
            <span className="sd-tray-label">{i + 1}. {entry.ref.kind === 'skill' ? 'Skill' : 'Prompt'}：{entry.label}{entry.missing === 'prompt' && <small>（已删除，会被跳过）</small>}{entry.missing === 'skill' && <small>（没有描述快照，只写名称）</small>}</span>
            <div className="sd-order"><Button size="sm" aria-label={`上移第 ${i + 1} 项`} disabled={locked || i === 0} onClick={() => moveGlobal(i, i - 1)}>↑</Button><Button size="sm" aria-label={`下移第 ${i + 1} 项`} disabled={locked || i === globalView.entries.length - 1} onClick={() => moveGlobal(i, i + 1)}>↓</Button><Button size="sm" aria-label={`从全局移除第 ${i + 1} 项`} disabled={locked} onClick={() => removeGlobal(i)}>×</Button></div>
          </li>)}</ol>}
          {!!globalView.text && <details><summary>预览写入系统提示的文本</summary><pre className="sd-detail sd-pre">{globalView.text}</pre></details>}
        </>}
      </main>
      {notice && <p className="sd-notice" role={notice.error ? 'alert' : 'status'} data-error={notice.error}>{notice.text}</p>}
      <footer className="sd-footer">
        <div className="sd-row sd-tray-head"><strong>已选 {view.items.length} 项</strong><div className="sd-row">{view.tab !== 'global' && <Button size="sm" disabled={locked || !view.items.length} onClick={setGlobalItems}>设为全局</Button>}<Button size="sm" disabled={locked || !view.items.length} onClick={() => setEditor({ kind: 'combination' })}>保存组合</Button>{combination && <Button size="sm" disabled={locked || !view.items.length} onClick={() => setEditor({ kind: 'combination', combination })}>覆盖</Button>}<Button size="sm" disabled={busy || !view.items.length} onClick={() => update({ items: [], combinationId: undefined })}>清空</Button><Button size="sm" aria-label={collapsed ? '展开已选条目' : '收起已选条目'} aria-expanded={!collapsed} onClick={() => update({ collapsed: !view.collapsed })}>{collapsed ? '▴' : '▾'}</Button></div></div>
        {!collapsed && view.items.length > 0 && <ol className="sd-tray-list" aria-label="已选条目，按填入顺序排列">{view.items.map((ref, i) => <li key={refKey(ref)} className="sd-tray-item" data-missing={missing.has(refKey(ref))} data-drop={dragOver === i} onDragOver={e => { if (busy || drag.current < 0) return; e.preventDefault(); setDragOver(i); }} onDrop={e => { e.preventDefault(); move(drag.current, i); drag.current = -1; setDragOver(null); }}>
          <span className="sd-drag" draggable={!busy} title="拖动排序，也可使用上移、下移按钮" onDragStart={e => { drag.current = i; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); }} onDragEnd={() => { drag.current = -1; setDragOver(null); }}>⠿</span><span className="sd-tray-label">{i + 1}. {ref.kind === 'skill' ? 'Skill' : 'Prompt'}：{itemLabel(ref, library, skills)}{missing.has(refKey(ref)) && <small>（缺项，请移除或重新选择）</small>}</span><div className="sd-order"><Button size="sm" aria-label={`上移第 ${i+1} 项`} disabled={busy || i === 0} onClick={() => move(i, i-1)}>↑</Button><Button size="sm" aria-label={`下移第 ${i+1} 项`} disabled={busy || i === view.items.length-1} onClick={() => move(i, i+1)}>↓</Button><Button size="sm" aria-label={`移除第 ${i+1} 项`} disabled={busy} onClick={() => update({ items: view.items.filter((_, n) => n !== i) })}>×</Button></div>
        </li>)}</ol>}
        <Button className="sd-inject" variant="primary" disabled={!!disabledReason} title={phase !== 'plain' ? `输入框${phaseLabel(phase)}，此时不能写入` : undefined} onClick={injectItems}>{busy ? '正在处理…' : missing.size ? `请先修正 ${missing.size} 个缺项` : loading ? '追加（读取中…）' : '追加到当前对话输入框'}</Button>
        {!!disabledReason && <p className="sd-hint sd-reason">{disabledReason}</p>}
      </footer>
    </div>;
  }
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: PACKAGE }, Dashboard)));
}

function PromptForm({ initial, busy, cancel, save }: { initial?: Prompt; busy: boolean; cancel(): void; save(value: Omit<Prompt, 'id'> & { id?: string }): Promise<void> }) {
  const [title, setTitle] = useState(initial?.title ?? ''); const [body, setBody] = useState(initial?.body ?? ''); const [tags, setTags] = useState(initial?.tags.join('，') ?? ''); const [error, setError] = useState('');
  async function submit(e: FormEvent) { e.preventDefault(); const value = { title, body, tags: parseTags(tags), favorite: initial?.favorite ?? false }; const valid = promptSchema.omit({ id: true }).safeParse(value); if (!valid.success) { setError(valid.error.issues.map(i => i.message).join('；')); return; } setError(''); await save({ ...valid.data, ...(initial ? { id: initial.id } : {}) }); }
  return <form className="sd-editor" onSubmit={submit}><h4>{initial ? '编辑 Prompt' : '新建 Prompt'}</h4><label className="sd-field">标题<Input required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} autoFocus/></label><label className="sd-field">正文<textarea required value={body} onChange={e => setBody(e.target.value)} maxLength={65536} rows={6}/></label><label className="sd-field">标签（用逗号分隔）<Input value={tags} onChange={e => setTags(e.target.value)}/></label>{error && <p role="alert" className="sd-hint">{error}</p>}<div className="sd-row sd-editor-actions"><Button disabled={busy} type="button" onClick={cancel}>取消</Button><Button disabled={busy} type="submit" variant="primary">保存 Prompt</Button></div></form>;
}
function NameForm({ title, label, initial, required, busy, cancel, save }: { title: string; label: string; initial: string; required?: boolean; busy: boolean; cancel(): void; save(value: string): Promise<void> }) {
  const [value, setValue] = useState(initial);
  return <form className="sd-editor" onSubmit={e => { e.preventDefault(); void save(value); }}><h4>{title}</h4><label className="sd-field">{label}<Input required={required} value={value} onChange={e => setValue(e.target.value)} autoFocus/></label><div className="sd-row sd-editor-actions"><Button type="button" disabled={busy} onClick={cancel}>取消</Button><Button type="submit" variant="primary" disabled={busy}>保存</Button></div></form>;
}
