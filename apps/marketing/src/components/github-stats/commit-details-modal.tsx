'use client'

import { useEffect, useRef } from 'react'
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
    accentColor = '#22c55e',
    repoUrl = 'https://github.com/remcostoeten/dora'
}: CommitDetailsModalProps) {
    const modalRef = useRef<HTMLDivElement>(null)

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

    if (!isOpen || !data) return null

    const commits = data.details || []

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
                aria-hidden="true"
            />

            {/* Modal */}
            <div
                ref={modalRef}
                className="relative z-10 w-full max-w-lg max-h-[80vh] bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
                    <div>
                        <h2
                            id="modal-title"
                            className="text-[#9a9a9a] font-medium"
                        >
                            {data.date}
                        </h2>
                        <p
                            className="text-xs mt-0.5"
                            style={{ color: accentColor }}
                        >
                            {data.commits} commit{data.commits !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md text-[#4a4a4a] hover:text-[#8a8a8a] hover:bg-[#1a1a1a] transition-colors"
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
                            className="block p-3 rounded-md bg-[#0f0f0f] border border-[#1a1a1a] hover:border-[#2a2a2a] transition-colors group"
                        >
                            {/* Commit header */}
                            <div className="flex items-start gap-3">
                                <div
                                    className="mt-0.5 p-1.5 rounded bg-[#1a1a1a] group-hover:bg-[#222]"
                                    style={{ color: accentColor }}
                                >
                                    <GitCommit className="w-3 h-3" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-[#9a9a9a] text-sm truncate flex-1">
                                            {commit.message}
                                        </p>
                                        <ExternalLink className="w-3 h-3 text-[#3a3a3a] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                    </div>
                                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[#4a4a4a]">
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
                                        <code className="font-mono text-[#3a3a3a]">
                                            {commit.sha}
                                        </code>
                                    </div>
                                </div>
                            </div>

                            {/* Stats (if available) */}
                            {(commit.additions !== undefined ||
                                commit.files) && (
                                <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-[#1a1a1a]">
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
                                        <span className="flex items-center gap-1 text-[10px] text-[#4a4a4a]">
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
                                            className="text-[10px] font-mono text-[#3a3a3a] truncate pl-2 border-l border-[#1a1a1a]"
                                        >
                                            {file}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </a>
                    ))}

                    {data.commits === 0 && (
                        <div className="text-center py-8 text-[#3a3a3a] text-sm">
                            No commits on this day
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    )
}
