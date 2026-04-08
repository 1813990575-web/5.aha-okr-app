import React, { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'

interface TimelineProps {
  selectedId?: string | null
  selectedTitle?: string | null
  selectedNote?: string
  onNoteChange?: (taskId: string, note: string) => void | Promise<void>
}

const LEGACY_NOTE_STORAGE_KEY = 'aha-okr-timeline-notes'

function readLegacyStoredNote(taskId: string): string | null {
  try {
    const raw = window.localStorage.getItem(LEGACY_NOTE_STORAGE_KEY)
    if (!raw) return null
    const notes = JSON.parse(raw) as Record<string, string>
    return typeof notes[`task:${taskId}`] === 'string' ? notes[`task:${taskId}`] : null
  } catch {
    return null
  }
}

function removeLegacyStoredNote(taskId: string) {
  try {
    const raw = window.localStorage.getItem(LEGACY_NOTE_STORAGE_KEY)
    if (!raw) return
    const notes = JSON.parse(raw) as Record<string, string>
    delete notes[`task:${taskId}`]
    window.localStorage.setItem(LEGACY_NOTE_STORAGE_KEY, JSON.stringify(notes))
  } catch {
    // ignore legacy cleanup errors
  }
}

function isLikelyUrl(text: string) {
  return /^https?:\/\/\S+$/i.test(text.trim())
}

export const Timeline: React.FC<TimelineProps> = ({ selectedId, selectedTitle, selectedNote = '', onNoteChange }) => {
  const [now, setNow] = useState(() => new Date())
  const latestSelectedIdRef = useRef<string | null | undefined>(selectedId)
  const latestOnNoteChangeRef = useRef<TimelineProps['onNoteChange']>(onNoteChange)

  useEffect(() => {
    latestSelectedIdRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    latestOnNoteChangeRef.current = onNoteChange
  }, [onNoteChange])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      Link.configure({
        autolink: true,
        openOnClick: true,
        linkOnPaste: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'timeline-note-link',
        },
      }),
      Placeholder.configure({
        placeholder: '在这里记录你的想法',
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: selectedId ? selectedNote : '',
    immediatelyRender: false,
    autofocus: false,
    editable: !!selectedId,
    editorProps: {
      attributes: {
        class: 'timeline-note-surface app-no-drag',
      },
      handlePaste(view, event) {
        const pastedText = event.clipboardData?.getData('text/plain')?.trim() || ''
        if (!pastedText || !isLikelyUrl(pastedText) || view.state.selection.empty) {
          return false
        }

        const linkMark = view.state.schema.marks.link
        if (!linkMark) return false

        event.preventDefault()
        const { from, to } = view.state.selection
        const transaction = view.state.tr.addMark(from, to, linkMark.create({ href: pastedText }))
        view.dispatch(transaction)
        return true
      },
    },
    onUpdate({ editor: currentEditor }) {
      const taskId = latestSelectedIdRef.current
      const handleNoteChange = latestOnNoteChangeRef.current
      if (!taskId || !handleNoteChange) return
      void handleNoteChange(taskId, currentEditor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) return
    const nextHtml = selectedId ? selectedNote : ''
    if (editor.getHTML() !== nextHtml) {
      editor.commands.setContent(nextHtml)
    }
    editor.setEditable(!!selectedId)
  }, [editor, selectedId, selectedNote])

  useEffect(() => {
    if (!selectedId || selectedNote) return
    const legacyNote = readLegacyStoredNote(selectedId)
    if (!legacyNote || !onNoteChange) return
    void onNoteChange(selectedId, legacyNote)
    removeLegacyStoredNote(selectedId)
  }, [onNoteChange, selectedId, selectedNote])

  const timeLabel = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now)

  return (
    <aside className="flex h-full w-full flex-col bg-transparent">
      <div className="app-drag-region traffic-light-space flex flex-shrink-0 items-center justify-end border-b border-black/[0.04] px-5 py-3">
        <div className="text-[15px] font-semibold tracking-[0.02em] text-[#3a4452] tabular-nums [font-variant-numeric:tabular-nums]">
          {timeLabel}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
        <div className="mb-2 min-h-[28px] text-[15px] font-medium leading-[1.4] text-[#4b5563]">
          {selectedTitle || '笔记'}
        </div>

        <div className="flex h-[50%] min-h-[240px] max-h-[380px] rounded-[14px] border border-black/[0.1] bg-white">
          <div className="timeline-note-editor min-h-0 flex-1 px-5 py-4">
            <EditorContent editor={editor} className="h-full min-h-[160px]" />
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Timeline
