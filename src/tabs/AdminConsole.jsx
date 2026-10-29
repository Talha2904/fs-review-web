import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import UsersTab from './UsersTab';
import CheckRulesTab from './CheckRulesTab';
import ChecklistsTab from './ChecklistsTab';
import ActivityLogTab from './ActivityLogTab';
import AiSettingsTab from './AiSettingsTab';
import { connectStore } from '../lib/engagements';
import { body, muted } from '../components/ui';

const CRUMB = { users: 'Users and Roles', rules: 'Check Rules', checklists: 'Disclosure Checklists', ai: 'AI Settings', activity: 'Activity Log' };

// The Administrator's area: user accounts and the firm's check rules.
export default function AdminConsole({ user, auth, onSignOut }) {
  const [tab, setTab] = useState('users');
  const [store, setStore] = useState(null);
  useEffect(() => { let gone = false; connectStore().then(s => { if (!gone) setStore(s); }); return () => { gone = true; }; }, []);
  const tabs = [{ id: 'users', label: 'Users and Roles', count: '' }, { id: 'rules', label: 'Check Rules', count: '' }, { id: 'checklists', label: 'Disclosure Checklists', count: '' }, { id: 'ai', label: 'AI Settings', count: '' }, { id: 'activity', label: 'Activity Log', count: '' }];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'stretch' }}>
      <Sidebar tabs={tabs} tab={tab} onTab={setTab} user={user} onSignOut={onSignOut} meta={[]} navTitle="Administration" subtitle="Administration" />
      <main style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ minHeight: 68, padding: '12px 28px', display: 'flex', alignItems: 'center', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1)' }}>
          <div style={{ ...body, display: 'flex', gap: 8 }}>
            <span style={muted}>Administration</span><span style={{ color: 'var(--snow-black-20)' }}>/</span><span style={{ fontWeight: 600 }}>{CRUMB[tab]}</span>
          </div>
        </header>
        {tab === 'users' && <UsersTab auth={auth} me={user} />}
        {tab === 'rules' && <CheckRulesTab store={store} />}
        {tab === 'checklists' && <ChecklistsTab store={store} />}
        {tab === 'ai' && <AiSettingsTab auth={auth} me={user} />}
        {tab === 'activity' && <ActivityLogTab />}
      </main>
    </div>
  );
}
