'use client'

import type { ComponentProps, FocusEvent, MouseEvent } from 'react'
import Link from 'next/link'
import { useState } from 'react'

type Props = Omit<ComponentProps<typeof Link>, 'prefetch'>

export function IntentLink({ onFocus, onMouseEnter, ...props }: Props) {
    const [active, setActive] = useState(false)

    function handleFocus(event: FocusEvent<HTMLAnchorElement>) {
        onFocus?.(event)
        if (!event.defaultPrevented) setActive(true)
    }

    function handleHover(event: MouseEvent<HTMLAnchorElement>) {
        onMouseEnter?.(event)
        if (!event.defaultPrevented) setActive(true)
    }

    return (
        <Link
            {...props}
            onFocus={handleFocus}
            onMouseEnter={handleHover}
            prefetch={active ? true : null}
        />
    )
}
