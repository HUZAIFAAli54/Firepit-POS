import { useState, useRef } from 'react';
import { AlertTriangle, Trash2, Download, Upload, RefreshCw, CheckCircle, Layers } from 'lucide-react';
import { db, ensureRecoveryCode } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { logActivity } from '../../utils/logger';
import toast from 'react-hot-toast';
import ConfirmDialog from '../ui/ConfirmDialog';

type ActionKey = 'dedup' | 'reset' | 'export' | 'import' | 'reindex' | null;

export default function DeveloperTools() {
  const [confirmAction, setConfirmAction] = useState<ActionKey>(null);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const session = useAppStore(s => s.session);

  const addLog = (msg: string) => setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const deduplicateItems = async () => {
    setRunning(true);
    addLog('Scanning for duplicate menu items…');
    const items = await db.menuItems.toArray();
    const seen = new Map<string, number>();
    let removed = 0;
    for (const item of items) {
      const key = `${item.categoryId}::${item.name.trim().toLowerCase()}`;
      if (seen.has(key)) {
        await db.menuItems.delete(item.id!);
        removed++;
        addLog(`Removed duplicate: "${item.name}"`);
      } else {
        seen.set(key, item.id!);
      }
    }

    addLog('Scanning for duplicate categories…');
    const cats = await db.categories.toArray();
    const seenCats = new Map<string, number>();
    let removedCats = 0;
    for (const cat of cats) {
      const key = cat.name.trim().toLowerCase();
      if (seenCats.has(key)) {
        // Move items from duplicate to the original
        const originalId = seenCats.get(key)!;
        await db.menuItems.where('categoryId').equals(cat.id!).modify({ categoryId: originalId });
        await db.categories.delete(cat.id!);
        removedCats++;
        addLog(`Removed duplicate category: "${cat.name}" → merged into original`);
      } else {
        seenCats.set(key, cat.id!);
      }
    }

    if (removed + removedCats === 0) {
      addLog('No duplicates found. Database is clean.');
      toast.success('No duplicates found!');
    } else {
      addLog(`Done. Removed ${removed} item(s) and ${removedCats} category/categories.`);
      toast.success(`Removed ${removed + removedCats} duplicates`);
    }
    if (session) await logActivity(session.id, session.name, session.role, 'settings', 'Dev: Deduplicate', `Removed ${removed} items, ${removedCats} categories`);
    setRunning(false);
  };

  const exportData = async () => {
    setRunning(true);
    addLog('Exporting all data…');
    try {
      // Export every table generically, so new tables are never forgotten.
      // PINs stay as their stored one-way hashes (needed for restore) —
      // keep the backup file somewhere safe.
      const tables: Record<string, unknown[]> = {};
      for (const table of db.tables) {
        tables[table.name] = await table.toArray();
      }

      const payload = {
        exportedAt: new Date().toISOString(),
        app: 'firepit-pos',
        version: 2,
        tables,
      };

      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `firepit-pos-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      const counts = Object.entries(tables)
        .map(([name, rows]) => `${name}: ${rows.length}`)
        .join(', ');
      addLog(`Export complete — ${counts}`);
      toast.success('Backup downloaded!');
      if (session) await logActivity(session.id, session.name, session.role, 'settings', 'Dev: Export Data', 'Full backup exported');
    } catch (e) {
      addLog('Export failed: ' + String(e));
      toast.error('Export failed');
    }
    setRunning(false);
  };

  const importData = async (file: File) => {
    setRunning(true);
    addLog(`Reading backup file "${file.name}"…`);
    try {
      const data = JSON.parse(await file.text());
      if (!data || data.app !== 'firepit-pos' || typeof data.tables !== 'object') {
        throw new Error('This is not a valid Firepit POS backup file.');
      }
      const backupTables = Object.keys(data.tables) as string[];
      const unknown = backupTables.filter(n => !db.tables.some(t => t.name === n));
      if (unknown.length > 0) {
        throw new Error(`Backup contains unknown tables: ${unknown.join(', ')}`);
      }
      // Restore atomically: clear each table, then re-insert its rows.
      await db.transaction('rw', db.tables, async () => {
        for (const table of db.tables) {
          const rows = data.tables[table.name];
          await table.clear();
          if (Array.isArray(rows) && rows.length > 0) {
            await table.bulkAdd(rows);
          }
        }
      });
      // Old backups may lack newer settings (e.g. recovery code)
      await ensureRecoveryCode();
      addLog(`Import complete — restored ${backupTables.length} tables. Reloading…`);
      toast.success('Backup restored! Reloading…');
      if (session) await logActivity(session.id, session.name, session.role, 'settings', 'Dev: Import Data', `Backup restored from ${file.name}`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      addLog('Import failed: ' + (e instanceof Error ? e.message : String(e)));
      toast.error('Import failed — ' + (e instanceof Error ? e.message : 'invalid file'));
      setRunning(false);
    }
  };

  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (file) void importData(file);
  };

  const reindexSort = async () => {
    setRunning(true);
    addLog('Re-indexing sort orders…');
    const cats = await db.categories.orderBy('sortOrder').toArray();
    for (let i = 0; i < cats.length; i++) {
      await db.categories.update(cats[i].id!, { sortOrder: i + 1 });
    }
    const items = await db.menuItems.orderBy('sortOrder').toArray();
    for (let i = 0; i < items.length; i++) {
      await db.menuItems.update(items[i].id!, { sortOrder: i + 1 });
    }
    addLog(`Re-indexed ${cats.length} categories, ${items.length} items.`);
    toast.success('Sort orders fixed');
    setRunning(false);
  };

  const factoryReset = async () => {
    setRunning(true);
    addLog('Starting factory reset…');
    try {
      await db.delete();
      localStorage.clear();
      sessionStorage.clear();
      addLog('All data wiped. Reloading…');
      toast.success('Factory reset done. Reloading…');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      addLog('Reset failed: ' + String(e));
      toast.error('Reset failed');
      setRunning(false);
    }
  };

  const handleConfirm = async () => {
    const action = confirmAction;
    setConfirmAction(null);
    if (action === 'dedup') await deduplicateItems();
    else if (action === 'export') await exportData();
    else if (action === 'reindex') await reindexSort();
    else if (action === 'reset') await factoryReset();
  };

  const handleRun = (key: ActionKey) => {
    // Import uses a file picker instead of the confirm dialog
    if (key === 'import') fileInputRef.current?.click();
    else setConfirmAction(key);
  };

  const ACTIONS = [
    {
      key: 'dedup' as ActionKey,
      icon: Layers,
      label: 'Deduplicate Data',
      desc: 'Find and remove duplicate categories and menu items. Safe — merges items before deleting duplicates.',
      color: 'text-blue-600',
      bg: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
      dangerous: false,
    },
    {
      key: 'reindex' as ActionKey,
      icon: RefreshCw,
      label: 'Fix Sort Orders',
      desc: 'Re-index sort orders for categories and menu items. Fixes display ordering issues.',
      color: 'text-green-600',
      bg: 'bg-green-50 hover:bg-green-100 border-green-200',
      dangerous: false,
    },
    {
      key: 'export' as ActionKey,
      icon: Download,
      label: 'Export Backup',
      desc: 'Download ALL data as a JSON file (every table). Keep the file safe — it contains hashed PINs.',
      color: 'text-amber-600',
      bg: 'bg-amber-50 hover:bg-amber-100 border-amber-200',
      dangerous: false,
    },
    {
      key: 'import' as ActionKey,
      icon: Upload,
      label: 'Import Backup',
      desc: 'Restore data from a backup file. This replaces ALL current data — export first!',
      color: 'text-purple-600',
      bg: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
      dangerous: true,
    },
    {
      key: 'reset' as ActionKey,
      icon: Trash2,
      label: 'Factory Reset',
      desc: 'Wipe ALL data and reload as a fresh install. This is irreversible — export first!',
      color: 'text-red-600',
      bg: 'bg-red-50 hover:bg-red-100 border-red-200',
      dangerous: true,
    },
  ];

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-bold text-gray-800">Developer Tools</h1>
        <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-full font-medium">Admin Only</span>
      </div>
      <p className="text-sm text-gray-500 mb-6">Maintenance and recovery tools. Export a backup before running destructive operations.</p>

      <div className="grid gap-3 mb-6">
        {ACTIONS.map(({ key, icon: Icon, label, desc, color, bg, dangerous }) => (
          <div key={key!} className={`rounded-xl border p-4 flex items-start gap-4 ${bg} transition-all`}>
            <div className={`mt-0.5 p-2 rounded-lg bg-white shadow-sm ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800">{label}</span>
                {dangerous && <AlertTriangle className="w-4 h-4 text-red-500" />}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
            </div>
            <button
              disabled={running}
              onClick={() => handleRun(key)}
              className={`shrink-0 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 ${
                dangerous ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-800 hover:bg-gray-700'
              }`}
            >
              Run
            </button>
          </div>
        ))}
      </div>

      {/* Operation log */}
      {log.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Operation Log</span>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {log.map((line, i) => (
              <div key={i} className="text-xs text-green-300 font-mono">{line}</div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden file picker for Import Backup */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onImportFile}
      />

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction === 'reset' ? 'Factory Reset — Are you sure?' : 'Confirm Action'}
        message={
          confirmAction === 'reset'
            ? 'This will permanently delete ALL data including orders, staff, and settings. Export a backup first. This cannot be undone.'
            : `Run "${ACTIONS.find(a => a.key === confirmAction)?.label}"?`
        }
        confirmLabel={confirmAction === 'reset' ? 'Yes, wipe everything' : 'Confirm'}
        danger={confirmAction === 'reset'}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
