'use client'

import { useEffect, useState } from 'react'

export function useCycleIndex(
    length: number,
    intervalMs: number,
    active = true
) {
    const [index, setIndex] = useState(0)

    useEffect(
        function cycle() {
            if (!active || length <= 1) return
            const id = window.setInterval(function () {
                setIndex(function (current) {
                    return (current + 1) % length
                })
            }, intervalMs)
            return function cleanup() {
                window.clearInterval(id)
            }
        },
        [active, intervalMs, length]
    )

    return index
}

export function useTypewriter(
    text: string,
    speedMs: number,
    active = true,
    resetKey = 0
) {
    const [count, setCount] = useState(0)

    useEffect(
        function type() {
            setCount(0)
            if (!active) return
            const id = window.setInterval(function () {
                setCount(function (current) {
                    if (current >= text.length) {
                        window.clearInterval(id)
                        return current
                    }
                    return current + 1
                })
            }, speedMs)
            return function cleanup() {
                window.clearInterval(id)
            }
        },
        [active, resetKey, speedMs, text]
    )

    return text.slice(0, count)
}
