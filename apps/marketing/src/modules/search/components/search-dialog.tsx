'use client'

import type { SharedProps, TagItem } from 'fumadocs-ui/contexts/search'
import {
    SearchDialog,
    SearchDialogClose,
    SearchDialogContent,
    SearchDialogFooter,
    SearchDialogHeader,
    SearchDialogIcon,
    SearchDialogInput,
    SearchDialogList,
    SearchDialogOverlay,
    TagsList,
    TagsListItem
} from 'fumadocs-ui/components/dialog/search'
import { useDocsSearch } from 'fumadocs-core/search/client'
import { fetchClient } from 'fumadocs-core/search/client/fetch'
import { useMemo, useState } from 'react'
import { readRecentPages } from '../hooks/use-recent-pages'

type Props = SharedProps & {
    tags?: TagItem[]
}

export function DocsSearchDialog({ tags = [], open, onOpenChange }: Props) {
    const [tag, setTag] = useState<string | undefined>()
    const client = useMemo(
        () => fetchClient({ api: '/api/search', tag }),
        [tag]
    )
    const search = useDocsSearch({ client })
    const recent = useMemo(
        () =>
            open
                ? readRecentPages().map((page) => ({
                      type: 'page' as const,
                      id: `recent:${page.url}`,
                      content: page.title,
                      url: page.url,
                      breadcrumbs: ['Recent']
                  }))
                : [],
        [open]
    )

    return (
        <SearchDialog {...search} open={open} onOpenChange={onOpenChange}>
            <SearchDialogOverlay />
            <SearchDialogContent>
                <SearchDialogHeader>
                    <SearchDialogIcon />
                    <SearchDialogInput placeholder="Search the docs" />
                    <SearchDialogClose />
                </SearchDialogHeader>
                <SearchDialogList
                    defaultItems={recent.length > 0 ? recent : null}
                />
                {tags.length > 0 ? (
                    <SearchDialogFooter>
                        <TagsList tag={tag} onTagChange={setTag} allowClear>
                            {tags.map((item) => (
                                <TagsListItem
                                    key={item.value}
                                    value={item.value}
                                >
                                    {item.name}
                                </TagsListItem>
                            ))}
                        </TagsList>
                    </SearchDialogFooter>
                ) : null}
            </SearchDialogContent>
        </SearchDialog>
    )
}
