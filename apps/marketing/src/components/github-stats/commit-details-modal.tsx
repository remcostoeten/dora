'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
    X,
    GitCommit,
    User,
    Clock,
    FileCode,
    Plus,
    Minus,
    ExternalLink
} from 'lucide-react'
import type { CommitDataPoint } from './commit-graph'
import { ACCENT_COLOR } from './constants'

export interface CommitDetailsModalProps {
    isOpen: boolean
    onClose: () => void
    data: CommitDataPoint | null
    accentColor?: string
    repoUrl?: string
}

export function CommitDetailsModal({
    isOpen,
    onClose,
    data,
    accentColor = ACCENT_COLOR,
    repoUrl = 'https://github.com/remcostoeten/dora'
}: CommitDetailsModalProps) {
    const modalRef = useRef<HTMLDivElement>(null)
    const [rendered, setRendered] = useState(false)
    const [visible, setVisible] = useState(false)
    const [lastData, setLastData] = useState<CommitDataPoint | null>(null)

    useEffect(() => {
        if (!isOpen || !data) {
            setVisible(false)
            return
        }
        setLastData(data)
        setRendered(true)
        const frame = requestAnimationFrame(() => setVisible(true))
        return () => cancelAnimationFrame(frame)
    }, [isOpen, data])

    // Close on escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        if (isOpen) {
            document.addEventListener('keydown', handleEscape)
            document.body.style.overflow = 'hidden'
        }
        return () => {
            document.removeEventListener('keydown', handleEscape)
            document.body.style.overflow = ''
        }
    }, [isOpen, onClose])

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                modalRef.current &&
                !modalRef.current.contains(e.target as Node)
            ) {
                onClose()
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () =>
            document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen, onClose])

    const activeData = data ?? lastData

    if (!rendered || !activeData) return null

    const commits = activeData.details || []

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ pointerEvents: visible ? undefined : 'none' }}
        >
            {/* Backdrop */}
            <div
                className="overlay-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm"
                data-visible={visible}
                aria-hidden="true"
            />

            {/* Modal */}
            <div
                ref={modalRef}
                className="overlay-panel relative z-10 w-full max-w-lg max-h-[80vh] bg-surface-base border border-surface-elevated rounded-lg shadow-2xl overflow-hidden"
                data-visible={visible}
                onTransitionEnd={(event) => {
                    if (
                        !visible &&
                        event.propertyName === 'opacity' &&
                        event.target === event.currentTarget
                    ) {
                        setRendered(false)
                    }
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-surface-elevated">
                    <div>
                        <h2
                            id="modal-title"
                            className="text-ink-400 font-medium"
                        >
                            {activeData.date}
                        </h2>
                        <p
                            className="text-xs mt-0.5"
                            style={{ color: accentColor }}
                        >
                            {activeData.commits} commit
                            {activeData.commits !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md text-line-bright hover:text-ink-500 hover:bg-surface-elevated transition-colors"
                        aria-label="Close modal"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Commit list */}
                <div className="overflow-y-auto max-h-[calc(80vh-80px)] p-4 space-y-3">
                    {commits.map((commit) => (
                        <a
                            key={commit.sha}
                            href={`${repoUrl}/commit/${commit.sha}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-3 rounded-md bg-surface-deep border border-surface-elevated hover:border-line transition-colors group"
                        >
                            {/* Commit header */}
                            <div className="flex items-start gap-3">
                                <div
                                    className="mt-0.5 p-1.5 rounded bg-surface-elevated group-hover:bg-[#222]"
                                    style={{ color: accentColor }}
                                >
                                    <GitCommit className="w-3 h-3" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-ink-400 text-sm truncate flex-1">
                                            {commit.message}
                                        </p>
                                        <ExternalLink className="w-3 h-3 text-line-strong opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                    </div>
                                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-line-bright">
                                        {commit.authorAvatar && (
                                            <img
                                                src={commit.authorAvatar}
                                                alt={commit.author}
                                                className="w-4 h-4 rounded-full"
                                            />
                                        )}
                                        <span className="flex items-center gap-1">
                                            {!commit.authorAvatar && (
                                                <User className="w-2.5 h-2.5" />
                                            )}
                                            {commit.author}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-2.5 h-2.5" />
                                            {commit.time}
                                        </span>
                                        <code className="font-mono text-line-strong">
                                            {commit.sha}
                                        </code>
                                    </div>
                                </div>
                            </div>

                            {/* Stats (if available) */}
                            {(commit.additions !== undefined ||
                                commit.files) && (
                                <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-surface-elevated">
                                    {commit.additions !== undefined && (
                                        <span className="flex items-center gap-1 text-[10px] text-green-500/70">
                                            <Plus className="w-2.5 h-2.5" />
                                            {commit.additions}
                                        </span>
                                    )}
                                    {commit.deletions !== undefined && (
                                        <span className="flex items-center gap-1 text-[10px] text-red-400/70">
                                            <Minus className="w-2.5 h-2.5" />
                                            {commit.deletions}
                                        </span>
                                    )}
                                    {commit.files && (
                                        <span className="flex items-center gap-1 text-[10px] text-line-bright">
                                            <FileCode className="w-2.5 h-2.5" />
                                            {commit.files.length} file
                                            {commit.files.length !== 1
                                                ? 's'
                                                : ''}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Files (if available) */}
                            {commit.files && commit.files.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {commit.files.map((file) => (
                                        <div
                                            key={file}
                                            className="text-[10px] font-mono text-line-strong truncate pl-2 border-l border-surface-elevated"
                                        >
                                            {file}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </a>
                    ))}

                    {activeData.commits === 0 && (
                        <div className="text-center py-8 text-line-strong text-sm">
                            No commits on this day
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    )
}
