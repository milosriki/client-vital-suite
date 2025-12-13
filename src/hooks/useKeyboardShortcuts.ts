import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  const shortcuts: ShortcutConfig[] = [
    // Navigation shortcuts (G then key)
    { key: '/', action: () => document.querySelector<HTMLInputElement>('input[type="search"], input[placeholder*="Search"]')?.focus(), description: 'Focus search' },
    { key: 'a', action: () => document.querySelector<HTMLButtonElement>('[data-ai-button]')?.click(), description: 'Open AI assistant' },
    { key: 'r', action: () => window.location.reload(), description: 'Refresh page' },
    { key: '?', shift: true, action: () => showShortcutsHelp(), description: 'Show keyboard shortcuts' },
  ];

  // Navigation with 'g' prefix
  const gShortcuts: Record<string, string> = {
    'd': '/',
    's': '/sales-pipeline',
    'c': '/clients',
    'p': '/ptd-control',
    't': '/stripe',
    'h': '/hubspot-live',
  };

  let gPressed = false;
  let gTimeout: NodeJS.Timeout;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if typing in input
    if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
      return;
    }

    // Handle 'g' prefix for navigation
    if (e.key === 'g' && !gPressed) {
      gPressed = true;
      gTimeout = setTimeout(() => { gPressed = false; }, 1500);
      return;
    }

    if (gPressed && gShortcuts[e.key]) {
      e.preventDefault();
      navigate(gShortcuts[e.key]);
      gPressed = false;
      clearTimeout(gTimeout);
      return;
    }

    // Handle other shortcuts
    for (const shortcut of shortcuts) {
      const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : true;
      const shiftMatch = shortcut.shift ? e.shiftKey : true;
      
      if (e.key === shortcut.key && ctrlMatch && shiftMatch) {
        e.preventDefault();
        shortcut.action();
        return;
      }
    }

    // Table navigation (j/k)
    if (e.key === 'j' || e.key === 'k') {
      const rows = document.querySelectorAll('tbody tr');
      if (rows.length === 0) return;
      
      const focused = document.querySelector('tbody tr.focused, tbody tr:focus-within');
      let index = focused ? Array.from(rows).indexOf(focused as Element) : -1;
      
      if (e.key === 'j') index = Math.min(index + 1, rows.length - 1);
      if (e.key === 'k') index = Math.max(index - 1, 0);
      
      rows.forEach(r => r.classList.remove('focused'));
      if (index >= 0) {
        rows[index].classList.add('focused');
        (rows[index] as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }

    // Enter to open focused row
    if (e.key === 'Enter') {
      const focused = document.querySelector('tbody tr.focused');
      if (focused) {
        (focused as HTMLElement).click();
      }
    }
  }, [navigate, shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

function showShortcutsHelp() {
  const help = `
Keyboard Shortcuts:
──────────────────────
Navigation (press 'g' then):
  d - Dashboard
  s - Sales Pipeline
  c - Clients
  p - PTD Control
  t - Stripe
  h - HubSpot

Actions:
  / - Focus search
  a - Open AI assistant
  r - Refresh page
  ? - Show this help

Table Navigation:
  j - Move down
  k - Move up
  Enter - Open selected
`;
  alert(help);
}
