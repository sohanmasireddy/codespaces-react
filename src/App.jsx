import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isToday, isYesterday, isThisWeek } from 'date-fns';
import { nanoid } from 'nanoid';
import { saveAs } from 'file-saver';
import { Button, Modal, TextInput, TextArea, Select, SelectItem, Toggle } from '@carbon/react';
import {
  MessageSquarePlus,
  Search,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
  MoreHorizontal,
  Trash2,
  Pencil,
  Download,
  Upload,
  Sparkles,
  Sun,
  Moon,
  Monitor,
  X,
} from 'lucide-react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Toaster, toast } from 'sonner';
import { useAppStore, useSettingsStore } from './stores/appStore';
import { clearConversations, listConversations, removeConversation, saveConversation } from './lib/database';
import ChatPanel from './components/chat/ChatPanel';
import './App.css';

function getTitle(conversation) {
  return conversation.title || 'New conversation';
}

function groupLabel(conversation) {
  const date = new Date(conversation.updatedAt || conversation.createdAt);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isThisWeek(date)) return 'Previous 7 days';
  return 'Earlier';
}

function exportJson(conversations) {
  const contents = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), conversations }, null, 2);
  saveAs(new Blob([contents], { type: 'application/json' }), 'carbon-chat-export.json');
}

function exportMarkdown(conversation) {
  const sections = (conversation.messages || []).map((message) => {
    const body = (message.parts || [])
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n');
    const role = message.role === 'user' ? 'You' : 'Assistant';
    return `## ${role}\n\n${body}`;
  });
  saveAs(new Blob([`# ${getTitle(conversation)}\n\n${sections.join('\n\n---\n\n')}`], { type: 'text/markdown;charset=utf-8' }), `${getTitle(conversation).replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'conversation'}.md`);
}

function SettingsDialog({ open, onClose, settings, updateSettings, config, onExportAll, onClear }) {
  const [confirmClear, setConfirmClear] = useState(false);
  if (!open) return null;

  return (
    <Modal
      open
      onRequestClose={onClose}
      modalHeading="Settings"
      passiveModal
      size="md"
      className="settings-modal"
    >
      <div className="settings-content">
        <section className="settings-section">
          <div className="settings-heading">
            <div className="settings-icon"><Sun size={17} /></div>
            <div><h3>Appearance</h3><p>Choose how Carbon Chat looks.</p></div>
          </div>
          <div className="theme-options" role="group" aria-label="Appearance theme">
            {[
              ['light', Sun, 'Light'],
              ['dark', Moon, 'Dark'],
              ['system', Monitor, 'System'],
            ].map(([value, Icon, label]) => (
              <button
                type="button"
                key={value}
                className={`theme-option ${settings.theme === value ? 'selected' : ''}`}
                onClick={() => updateSettings({ theme: value })}
                aria-pressed={settings.theme === value}
              >
                <Icon size={17} /><span>{label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-heading">
            <div className="settings-icon"><Sparkles size={17} /></div>
            <div><h3>Model & generation</h3><p>{config.configured ? `Connected to ${config.model || 'configured model'}.` : 'Set server-side provider configuration to activate chat.'}</p></div>
          </div>
          <TextInput
            id="model-name"
            labelText="Model override (optional)"
            helperText="Leave blank to use the model configured in Cloudflare."
            value={settings.model}
            onChange={(event) => updateSettings({ model: event.target.value })}
            placeholder={config.model || 'Provider default'}
          />
          <label className="range-setting">
            <span>Temperature <strong>{settings.temperature.toFixed(1)}</strong></span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.temperature}
              onChange={(event) => updateSettings({ temperature: Number(event.target.value) })}
            />
            <span className="setting-help">Lower values are more focused; higher values are more varied.</span>
          </label>
          <Select
            id="max-output-tokens"
            labelText="Maximum response length"
            value={settings.maxOutputTokens}
            onChange={(event) => updateSettings({ maxOutputTokens: Number(event.target.value) })}
          >
            <SelectItem value={1024} text="1,024 tokens" />
            <SelectItem value={2048} text="2,048 tokens" />
            <SelectItem value={4096} text="4,096 tokens" />
            <SelectItem value={8192} text="8,192 tokens" />
          </Select>
          <TextArea
            id="system-prompt"
            labelText="System instructions"
            rows={4}
            value={settings.systemPrompt}
            onChange={(event) => updateSettings({ systemPrompt: event.target.value })}
          />
        </section>

        <section className="settings-section settings-row">
          <div><h3>Web search</h3><p>{config.searchAvailable ? 'Search the web with DuckDuckGo. No API key is required.' : 'Web search is unavailable.'}</p></div>
          <Toggle
            id="web-search-toggle"
            labelText=""
            labelA="Off"
            labelB="On"
            toggled={settings.webSearch}
            disabled={!config.searchAvailable}
            onToggle={(webSearch) => updateSettings({ webSearch })}
          />
        </section>

        <section className="settings-section data-actions">
          <div className="settings-heading">
            <div className="settings-icon"><Download size={17} /></div>
            <div><h3>Your data</h3><p>Conversations are stored in this browser.</p></div>
          </div>
          <Button kind="secondary" size="sm" renderIcon={Download} onClick={onExportAll}>Export conversations</Button>
          {confirmClear ? (
            <div className="confirm-clear">
              <span>Delete every saved conversation?</span>
              <Button kind="danger" size="sm" onClick={() => { onClear(); setConfirmClear(false); }}>Delete all</Button>
              <Button kind="ghost" size="sm" onClick={() => setConfirmClear(false)}>Cancel</Button>
            </div>
          ) : (
            <Button kind="danger--tertiary" size="sm" renderIcon={Trash2} onClick={() => setConfirmClear(true)}>Clear all conversations</Button>
          )}
        </section>
      </div>
    </Modal>
  );
}

function ConversationItem({ conversation, active, onSelect, onRename, onDelete }) {
  return (
    <div className={`conversation-item ${active ? 'active' : ''}`}>
      <button type="button" className="conversation-select" onClick={onSelect}>
        <MessageSquarePlus size={16} aria-hidden="true" />
        <span>{getTitle(conversation)}</span>
      </button>
      <div className="conversation-actions">
        <button type="button" aria-label={`Rename ${getTitle(conversation)}`} title="Rename" onClick={onRename}>
          <Pencil size={14} />
        </button>
        <button type="button" aria-label={`Delete ${getTitle(conversation)}`} title="Delete" onClick={onDelete}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const {
    conversations,
    activeId,
    query,
    sidebarOpen,
    config,
    setConversations,
    setActiveId,
    setQuery,
    setSidebarOpen,
    setConfig,
    upsertConversation,
    forgetConversation,
  } = useAppStore();
  const { settings, updateSettings } = useSettingsStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const importRef = useRef(null);
  const searchRef = useRef(null);
  const composerRef = useRef(null);
  const initializationRef = useRef(null);
  const activeConversation = conversations.find((item) => item.id === activeId);

  const refreshConversations = useCallback(async () => {
    const list = await listConversations();
    setConversations(list);
    return list;
  }, [setConversations]);

  const refreshConfig = useCallback(async () => {
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not check the Worker configuration');
    const remoteConfig = await response.json();
    setConfig(remoteConfig);
    return remoteConfig;
  }, [setConfig]);

  const createConversation = useCallback(async () => {
    const conversation = {
      id: nanoid(),
      title: 'New conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    await saveConversation(conversation);
    upsertConversation(conversation);
    setActiveId(conversation.id);
    return conversation;
  }, [upsertConversation, setActiveId]);

  useEffect(() => {
    let active = true;
    if (!initializationRef.current) {
      initializationRef.current = Promise.all([
        refreshConversations(),
        refreshConfig().catch(() => null),
      ]);
    }
    initializationRef.current.then(async ([list, remoteConfig]) => {
      if (!active) return;
      if (remoteConfig) setConfig(remoteConfig);
      if (!list.length) {
        await createConversation();
      } else {
        setActiveId(useAppStore.getState().activeId || list[0].id);
      }
      setLoaded(true);
    }).catch(() => {
      if (active) {
        toast.error('Could not load local conversations');
        setLoaded(true);
      }
    });
    return () => { active = false; };
  }, [refreshConversations, refreshConfig, createConversation, setConfig, setActiveId]);

  useEffect(() => {
    const resolved = settings.theme === 'system'
      ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : settings.theme;
    document.documentElement.dataset.theme = resolved;
  }, [settings.theme]);

  useHotkeys('mod+shift+o', (event) => { event.preventDefault(); createConversation(); }, { enableOnFormTags: false });
  useHotkeys('mod+k', (event) => { event.preventDefault(); searchRef.current?.focus(); }, { enableOnFormTags: true });
  useHotkeys('mod+shift+m', (event) => { event.preventDefault(); composerRef.current?.focus(); }, { enableOnFormTags: true });
  useHotkeys('mod+shift+s', (event) => { event.preventDefault(); setSidebarOpen(!useAppStore.getState().sidebarOpen); }, { enableOnFormTags: true });
  useHotkeys('escape', () => { if (settingsOpen) setSettingsOpen(false); }, { enableOnFormTags: true });

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? conversations.filter((conversation) =>
          getTitle(conversation).toLowerCase().includes(normalized) ||
          (conversation.messages || []).some((message) =>
            (message.parts || []).some((part) =>
              part.type === 'text' && typeof part.text === 'string' && part.text.toLowerCase().includes(normalized),
            ),
          ),
        )
      : conversations;
  }, [conversations, query]);

  const grouped = useMemo(() => {
    const groups = new Map();
    filtered.forEach((conversation) => {
      const label = groupLabel(conversation);
      groups.set(label, [...(groups.get(label) || []), conversation]);
    });
    return groups;
  }, [filtered]);

  const saveCurrent = useCallback(async () => {
    await refreshConversations();
  }, [refreshConversations]);

  const deleteConversation = async (conversation) => {
    if (!window.confirm(`Delete “${getTitle(conversation)}”? This cannot be undone.`)) return;
    await removeConversation(conversation.id);
    forgetConversation(conversation.id);
    const remaining = await refreshConversations();
    if (activeId === conversation.id) {
      if (remaining.length) setActiveId(remaining[0].id);
      else await createConversation();
    }
    toast.success('Conversation deleted');
  };

  const renameConversation = async (conversation) => {
    const title = window.prompt('Rename conversation', getTitle(conversation));
    if (!title?.trim()) return;
    const updated = { ...conversation, title: title.trim().slice(0, 100) };
    await saveConversation(updated);
    upsertConversation(updated);
    toast.success('Conversation renamed');
  };

  const importConversations = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Import file exceeds 10 MB');
      const input = JSON.parse(await file.text());
      const records = Array.isArray(input) ? input : input.conversations;
      if (!Array.isArray(records) || records.length > 500) throw new Error('This is not a valid Carbon Chat export');
      const normalized = records.map((record) => {
        if (!record || typeof record.id !== 'string' || typeof record.title !== 'string' || !Array.isArray(record.messages)) {
          throw new Error('One or more conversations are invalid');
        }
        return {
          id: nanoid(),
          title: record.title.slice(0, 100),
          createdAt: Number(record.createdAt) || Date.now(),
          updatedAt: Number(record.updatedAt) || Date.now(),
          messages: record.messages,
        };
      });
      for (const conversation of normalized) await saveConversation(conversation);
      await refreshConversations();
      toast.success(`${normalized.length} conversation${normalized.length === 1 ? '' : 's'} imported`);
    } catch (error) {
      toast.error(error.message || 'Could not import conversations');
    }
  };

  const clearAll = async () => {
    await clearConversations();
    setConversations([]);
    await createConversation();
    toast.success('Conversation history cleared');
  };

  const startImport = () => importRef.current?.click();

  return (
    <div className="app-shell">
      <Toaster position="bottom-right" richColors closeButton />
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`} aria-label="Conversation navigation">
        <div className="sidebar-top">
          <button type="button" className="brand" onClick={() => createConversation()} aria-label="Create a new conversation">
            <span className="brand-glyph">✳</span>
            <span>carbon<span className="brand-light">chat</span></span>
          </button>
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            renderIcon={sidebarOpen ? PanelLeftClose : PanelLeftOpen}
            iconDescription={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="collapse-sidebar"
          />
        </div>
        {sidebarOpen && (
          <>
            <Button
              kind="secondary"
              size="md"
              renderIcon={MessageSquarePlus}
              className="new-chat-button"
              onClick={() => createConversation()}
            >
              New conversation
              <span className="shortcut-hint">⇧⌘O</span>
            </Button>
            <div className="sidebar-search">
              <Search size={16} aria-hidden="true" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search conversations"
                aria-label="Search conversations"
              />
              {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={14} /></button>}
              <kbd>⌘K</kbd>
            </div>
            <div className="conversation-list">
              {[...grouped.entries()].map(([label, items]) => (
                <section key={label} className="conversation-group">
                  <h2>{label}</h2>
                  {items.map((conversation) => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      active={conversation.id === activeId}
                      onSelect={() => setActiveId(conversation.id)}
                      onRename={() => renameConversation(conversation)}
                      onDelete={() => deleteConversation(conversation)}
                    />
                  ))}
                </section>
              ))}
              {filtered.length === 0 && <p className="empty-search">{query ? 'No matching conversations' : 'Your conversations will appear here'}</p>}
            </div>
            <div className="sidebar-bottom">
              <input ref={importRef} type="file" accept="application/json,.json" className="visually-hidden" onChange={importConversations} />
              <button type="button" className="sidebar-link" onClick={startImport}><Upload size={16} /> Import conversations</button>
              <button type="button" className="sidebar-link" onClick={() => setSettingsOpen(true)}><Settings2 size={16} /> Settings <span className="shortcut-hint">⌘,</span></button>
              <div className="sidebar-footer">
                <div className="provider-dot" data-ready={config.configured} />
                <span>{config.configured ? config.model || 'Provider ready' : 'Provider not connected'}</span>
                <button type="button" aria-label="Open settings" title="Settings" onClick={() => setSettingsOpen(true)}><MoreHorizontal size={17} /></button>
              </div>
            </div>
          </>
        )}
      </aside>

      <div className="workspace">
        <header className="topbar">
          {!sidebarOpen && (
            <Button kind="ghost" size="sm" hasIconOnly renderIcon={PanelLeftOpen} iconDescription="Open sidebar" onClick={() => setSidebarOpen(true)} />
          )}
          <div className="topbar-title">{activeConversation ? getTitle(activeConversation) : 'New conversation'}</div>
          {activeConversation?.messages?.length > 0 && (
            <Button kind="ghost" size="sm" renderIcon={Download} onClick={() => exportMarkdown(activeConversation)}>
              <span className="export-label">Export</span>
            </Button>
          )}
        </header>
        {loaded && activeConversation ? (
          <ChatPanel
            key={activeConversation.id}
            conversation={activeConversation}
            settings={settings}
            config={config}
            onRefreshConfig={refreshConfig}
            onSave={saveCurrent}
            composerRef={composerRef}
          />
        ) : (
          <main className="loading-state"><div className="loading-orb"><Sparkles size={20} /></div></main>
        )}
      </div>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        updateSettings={updateSettings}
        config={config}
        onExportAll={() => {
          exportJson(conversations);
          toast.success('Export downloaded');
        }}
        onClear={clearAll}
      />
      <span className="keyboard-hint" aria-hidden="true">⌘⇧M Focus composer</span>
    </div>
  );
}
