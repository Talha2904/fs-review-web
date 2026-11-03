import React, { useEffect, useState } from 'react';
import AppShell from '../components/AppShell';
import UsersTab from './UsersTab';
import CheckRulesTab from './CheckRulesTab';
import ChecklistsTab from './ChecklistsTab';
import ActivityLogTab from './ActivityLogTab';
import AiSettingsTab from './AiSettingsTab';
import { connectStore } from '../lib/engagements';

const CRUMB = { users: 'Users and Roles', rules: 'Check Rules', checklists: 'Disclosure Checklists', ai: 'AI Settings', activity: 'Activity Log' };

// The Administrator's area: user accounts and the firm's check rules.
export default function AdminConsole({ user, auth, onSignOut }) {
  const [tab, setTab] = useState('users');
  const [store, setStore] = useState(null);
  useEffect(() => { let gone = false; connectStore().then(s => { if (!gone) setStore(s); }); return () => { gone = true; }; }, []);
  const tabs = [{ id: 'users', label: 'Users and Roles', count: '' }, { id: 'rules', label: 'Check Rules', count: '' }, { id: 'checklists', label: 'Disclosure Checklists', count: '' }, { id: 'ai', label: 'AI Settings', count: '' }, { id: 'activity', label: 'Activity Log', count: '' }];

  return (
    <AppShell root="Administration" crumb={CRUMB[tab]} sidebar={{ tabs, tab, onTab: setTab, user, onSignOut, meta: [], navTitle: 'Administration', subtitle: 'Administration' }}>
        {tab === 'users' && <UsersTab auth={auth} me={user} />}
        {tab === 'rules' && <CheckRulesTab store={store} />}
        {tab === 'checklists' && <ChecklistsTab store={store} />}
        {tab === 'ai' && <AiSettingsTab auth={auth} me={user} />}
        {tab === 'activity' && <ActivityLogTab />}
    </AppShell>
  );
}
