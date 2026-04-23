'use client'

import { useState, useCallback } from 'react'
import {
  Save, Eye, EyeOff, ChevronUp, ChevronDown, Upload, Plus, Trash2,
  FileText, Image as ImageIcon, Loader2
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type CMSSection = {
  id: string
  section_key: string
  title: string | null
  subtitle: string | null
  content: any
  image_url: string | null
  active: boolean
  sort_order: number
}

type Props = {
  initialSections: CMSSection[]
}

// ── Key-Value Editor for JSONB stats ────────────────────
function KeyValueEditor({
  data,
  onChange,
}: {
  data: Record<string, any>
  onChange: (data: Record<string, any>) => void
}) {
  const entries = Object.entries(data || {})

  const updateKey = (oldKey: string, newKey: string) => {
    const updated: Record<string, any> = {}
    for (const [k, v] of Object.entries(data)) {
      updated[k === oldKey ? newKey : k] = v
    }
    onChange(updated)
  }

  const updateValue = (key: string, value: string) => {
    onChange({ ...data, [key]: value })
  }

  const addEntry = () => {
    onChange({ ...data, '': '' })
  }

  const removeEntry = (key: string) => {
    const updated = { ...data }
    delete updated[key]
    onChange(updated)
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, value], idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            type="text"
            value={key}
            onChange={e => updateKey(key, e.target.value)}
            placeholder="Key"
            className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
          />
          <input
            type="text"
            value={typeof value === 'string' ? value : JSON.stringify(value)}
            onChange={e => updateValue(key, e.target.value)}
            placeholder="Value"
            className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
          />
          <button
            onClick={() => removeEntry(key)}
            className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={addEntry}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-dark-ambient)] hover:bg-[var(--color-active-bg)] transition-colors"
      >
        <Plus size={14} /> Add field
      </button>
    </div>
  )
}

// ── Section Card ────────────────────────────────────────
function SectionCard({
  section,
  isFirst,
  isLast,
  onUpdate,
  onReorder,
}: {
  section: CMSSection
  isFirst: boolean
  isLast: boolean
  onUpdate: (id: string, updates: Partial<CMSSection>) => Promise<void>
  onReorder: (id: string, direction: 'up' | 'down') => void
}) {
  const [local, setLocal] = useState<CMSSection>(section)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)

  const isStatsSection = local.section_key?.toLowerCase().includes('stats') ||
    local.section_key?.toLowerCase().includes('numbers') ||
    (local.content && typeof local.content === 'object' && !Array.isArray(local.content))

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    await onUpdate(local.id, {
      title: local.title,
      subtitle: local.subtitle,
      content: local.content,
      image_url: local.image_url,
      active: local.active,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'homepage')
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.url) {
        setLocal(prev => ({ ...prev, image_url: data.url }))
      }
    } catch {
      // upload failed silently
    }
    setUploading(false)
  }

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between bg-[var(--color-primary)]/[0.02] border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <FileText size={16} className="text-[var(--color-ambient)]" />
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
            {local.section_key}
          </span>
          <span className="text-xs text-[var(--color-text-secondary)]">
            (order: {local.sort_order})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Reorder buttons */}
          <button
            onClick={() => onReorder(local.id, 'up')}
            disabled={isFirst}
            className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronUp size={16} />
          </button>
          <button
            onClick={() => onReorder(local.id, 'down')}
            disabled={isLast}
            className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronDown size={16} />
          </button>

          {/* Active toggle */}
          <button
            onClick={() => setLocal(prev => ({ ...prev, active: !prev.active }))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              local.active
                ? 'bg-[var(--color-active-bg)] text-[var(--color-dark-ambient)]'
                : 'bg-red-50 text-[var(--color-danger)]'
            }`}
          >
            {local.active ? <Eye size={14} /> : <EyeOff size={14} />}
            {local.active ? 'Active' : 'Hidden'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 space-y-4">
        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
            Title
          </label>
          <input
            type="text"
            value={local.title || ''}
            onChange={e => setLocal(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Section title"
            className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
          />
        </div>

        {/* Subtitle */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
            Subtitle
          </label>
          <input
            type="text"
            value={local.subtitle || ''}
            onChange={e => setLocal(prev => ({ ...prev, subtitle: e.target.value }))}
            placeholder="Section subtitle"
            className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
          />
        </div>

        {/* Content */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
            Content
          </label>
          {isStatsSection && typeof local.content === 'object' && local.content !== null ? (
            <KeyValueEditor
              data={local.content}
              onChange={content => setLocal(prev => ({ ...prev, content }))}
            />
          ) : (
            <textarea
              value={typeof local.content === 'string' ? local.content : JSON.stringify(local.content || '', null, 2)}
              onChange={e => {
                let val: any = e.target.value
                try { val = JSON.parse(val) } catch {}
                setLocal(prev => ({ ...prev, content: val }))
              }}
              rows={4}
              placeholder="Section content (text or JSON)"
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors resize-y font-mono"
            />
          )}
        </div>

        {/* Image */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
            Image
          </label>
          <div className="flex items-start gap-4">
            {local.image_url ? (
              <div className="relative w-32 h-20 rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-hover)]">
                <img
                  src={local.image_url}
                  alt="Section"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => setLocal(prev => ({ ...prev, image_url: null }))}
                  className="absolute top-1 right-1 p-1 rounded-md bg-white/80 text-[var(--color-danger)] hover:bg-white transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ) : (
              <div className="w-32 h-20 rounded-lg border-2 border-dashed border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)]">
                <ImageIcon size={20} />
              </div>
            )}
            <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] cursor-pointer transition-colors">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? 'Uploading...' : 'Upload Image'}
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--color-primary)' }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save Section'}
          </button>
          {saved && (
            <span className="text-xs font-medium text-green-600">Saved successfully</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────
export default function HomepageCMS({ initialSections }: Props) {
  const [sections, setSections] = useState<CMSSection[]>(initialSections)

  const handleUpdate = useCallback(async (id: string, updates: Partial<CMSSection>) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('cms_sections')
      .update(updates)
      .eq('id', id)

    if (!error) {
      setSections(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
    }
  }, [])

  const handleReorder = useCallback(async (id: string, direction: 'up' | 'down') => {
    const supabase = createClient()
    const idx = sections.findIndex(s => s.id === id)
    if (idx < 0) return

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sections.length) return

    const current = sections[idx]
    const swap = sections[swapIdx]

    // Swap sort_order values
    await supabase.from('cms_sections').update({ sort_order: swap.sort_order }).eq('id', current.id)
    await supabase.from('cms_sections').update({ sort_order: current.sort_order }).eq('id', swap.id)

    setSections(prev => {
      const updated = [...prev]
      const tempOrder = updated[idx].sort_order
      updated[idx] = { ...updated[idx], sort_order: updated[swapIdx].sort_order }
      updated[swapIdx] = { ...updated[swapIdx], sort_order: tempOrder }
      updated.sort((a, b) => a.sort_order - b.sort_order)
      return updated
    })
  }, [sections])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Homepage CMS</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Manage homepage sections, content, and media.
        </p>
      </div>

      {sections.length === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-12 text-center shadow-sm">
          <FileText size={40} className="mx-auto text-[var(--color-text-secondary)] mb-3" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            No homepage sections found. Add sections to the cms_sections table to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((section, idx) => (
            <SectionCard
              key={section.id}
              section={section}
              isFirst={idx === 0}
              isLast={idx === sections.length - 1}
              onUpdate={handleUpdate}
              onReorder={handleReorder}
            />
          ))}
        </div>
      )}
    </div>
  )
}
