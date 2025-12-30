"use client"
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemTitle,
    ItemActions
} from "@/components/ui/item"
import { Button } from "@/components/ui/button"
import { ArrowUpRight } from "lucide-react"
import { isTauri } from "@/core/tauri/utils"

export function WebMessage() {
    // Only show on web, not in Tauri desktop build
    if (isTauri()) {
        return null
    }
    return (
        <div className="fixed bottom-4 right-4 z-50">
            <Item variant="outline" className="max-w-sm">
                <ItemContent>
                    <ItemTitle className="font-semibold">
                        Presentation Mode
                    </ItemTitle>
                    <ItemDescription>
                        This is a web presentation of the UI. Database features
                        only work in the compiled desktop version or development
                        build.
                    </ItemDescription>
                </ItemContent>
                <ItemActions>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() =>
                            window.open(
                                "https://github.com/shadcn-ui/ui",
                                "_blank"
                            )
                        }
                    >
                        View Repo
                        <ArrowUpRight className="ml-1 size-3" />
                    </Button>
                </ItemActions>
            </Item>
        </div>
    )
}
