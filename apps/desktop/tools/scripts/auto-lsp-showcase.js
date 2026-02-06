/** 
 * What is this?
 * 
 * This is a script that will automatically type out a complex Drizzle query with autocomplete suggestions.
 * It will then trigger the autocomplete suggestions and select them.
 * 
 * How to use it?
 * 
 * 1. Open dora, navigate to the Query runner
 * 2. Open the browser console (F12)
 * 3. Paste this script into the console and press Enter
 * 4. Watch the magic happen
 */


(function () {
    function sleep(ms) {
        return new Promise(function (r) {
            setTimeout(r, ms)
        })
    }

    function getEd() {
        var g = globalThis

        if (g.editor && typeof g.editor.trigger === "function") return g.editor
        if (g.monaco && g.monaco.editor) {
            if (typeof g.monaco.editor.getEditors === "function") {
                var list = g.monaco.editor.getEditors()
                if (list && list[0]) return list[0]
            }
            if (typeof g.monaco.editor.getFocusedEditor === "function") {
                var fe = g.monaco.editor.getFocusedEditor()
                if (fe) return fe
            }
        }

        var el = document.querySelector(".monaco-editor")
        if (el) {
            var keys = Object.keys(el)
            for (var i = 0; i < keys.length; i++) {
                var k = keys[i]
                var v = el[k]
                if (v && typeof v.trigger === "function" && typeof v.getModel === "function") return v
            }
        }

        return null
    }

    async function typeEd(ed, txt) {
        ed.focus()
        ed.trigger("kbd", "type", { text: txt })
    }

    async function acceptSug(ed) {
        ed.focus()
        ed.trigger("kbd", "acceptSelectedSuggestion", {})
    }

    async function triggerSuggest(ed) {
        ed.focus()
        ed.trigger("kbd", "editor.action.triggerSuggest", {})
    }

    async function selectNextSuggestion(ed) {
        ed.focus()
        ed.trigger("kbd", "selectNextSuggestion", {})
    }

    async function selectPrevSuggestion(ed) {
        ed.focus()
        ed.trigger("kbd", "selectPrevSuggestion", {})
    }

    async function run(config) {
        config = config || {}
        var baseDelay = config.delay || 800
        var pauseBetweenSteps = config.pauseBetweenSteps || 1200

        var ed = getEd()
        if (!ed) {
            console.log("No Monaco editor instance found.")
            console.log("If the page exposes it, set globalThis.editor = <yourEditor> and run doraLSP.run() again.")
            return
        }

        console.log("Starting LSP Showcase Demo...")
        console.log("Building complex Drizzle query with autocomplete...")

        ed.focus()
        if (typeof ed.getModel === "function") {
            var m = ed.getModel()
            if (m && typeof m.setValue === "function") m.setValue("")
        }

        await sleep(500)

        console.log("Step 1: Typing db. to trigger method suggestions...")
        await typeEd(ed, "db.")
        await sleep(baseDelay)
        await triggerSuggest(ed)
        await sleep(pauseBetweenSteps)

        console.log("Step 2: Selecting 'select' method...")
        await acceptSug(ed)
        await sleep(baseDelay)

        console.log("Step 3: Opening select() with column selection...")
        await typeEd(ed, "({")
        await sleep(baseDelay)

        console.log("Step 4: Typing column aliases with table references...")
        await typeEd(ed, "\n  userId: users.")
        await sleep(baseDelay)
        await triggerSuggest(ed)
        await sleep(pauseBetweenSteps)

        console.log("Step 5: Selecting 'id' column...")
        await acceptSug(ed)
        await sleep(baseDelay)

        await typeEd(ed, ",")
        await sleep(300)

        console.log("Step 6: Adding userName alias...")
        await typeEd(ed, "\n  userName: users.")
        await sleep(baseDelay)
        await triggerSuggest(ed)
        await sleep(pauseBetweenSteps)

        await selectNextSuggestion(ed)
        await sleep(400)
        await acceptSug(ed)
        await sleep(baseDelay)

        await typeEd(ed, ",")
        await sleep(300)

        console.log("Step 7: Adding email with function wrapper...")
        await typeEd(ed, "\n  email: sql`LOWER(${users.")
        await sleep(baseDelay)
        await triggerSuggest(ed)
        await sleep(pauseBetweenSteps)

        await selectNextSuggestion(ed)
        await sleep(400)
        await selectNextSuggestion(ed)
        await sleep(400)
        await acceptSug(ed)
        await sleep(baseDelay)

        await typeEd(ed, "})`")
        await sleep(300)

        console.log("Step 8: Adding order count subquery...")
        await typeEd(ed, ",\n  orderCount: sql`(SELECT COUNT(*) FROM orders WHERE orders.user_id = ${users.")
        await sleep(baseDelay)
        await triggerSuggest(ed)
        await sleep(pauseBetweenSteps)

        await acceptSug(ed)
        await sleep(baseDelay)

        await typeEd(ed, "})`")
        await sleep(300)

        console.log("Step 9: Closing select object...")
        await typeEd(ed, "\n})")
        await sleep(baseDelay)

        console.log("Step 10: Adding .from() clause...")
        await typeEd(ed, "\n.")
        await sleep(baseDelay)
        await triggerSuggest(ed)
        await sleep(pauseBetweenSteps)

        await typeEd(ed, "from(")
        await sleep(baseDelay)
        await triggerSuggest(ed)
        await sleep(pauseBetweenSteps)

        console.log("Step 11: Selecting 'users' table...")
        await acceptSug(ed)
        await sleep(baseDelay)

        await typeEd(ed, ")")
        await sleep(300)

        console.log("Step 12: Adding .leftJoin() with related table...")
        await typeEd(ed, "\n.")
        await sleep(baseDelay)
        await triggerSuggest(ed)
        await sleep(pauseBetweenSteps)

        await typeEd(ed, "leftJoin(")
        await sleep(baseDelay)
        await triggerSuggest(ed)
        await sleep(pauseBetweenSteps)

        await selectNextSuggestion(ed)
        await sleep(400)
        await acceptSug(ed)
        await sleep(baseDelay)

        await typeEd(ed, ", eq(users.")
        await sleep(baseDelay)
        await triggerSuggest(ed)
        await sleep(pauseBetweenSteps)

        await acceptSug(ed)
        await sleep(baseDelay)

        await typeEd(ed, ", orders.")
        await sleep(baseDelay)
        await triggerSuggest(ed)
        await sleep(pauseBetweenSteps)

        await selectNextSuggestion(ed)
        await sleep(400)
        await acceptSug(ed)
        await sleep(baseDelay)

        await typeEd(ed, "))")
        await sleep(300)

        console.log("Step 13: Adding .where() clause with complex condition...")
        await typeEd(ed, "\n.")
        await sleep(baseDelay)
        await triggerSuggest(ed)
        await sleep(pauseBetweenSteps)

        await typeEd(ed, "where(")
        await sleep(baseDelay)

        await typeEd(ed, "and(\n  gt(users.")
        await sleep(baseDelay)
        await triggerSuggest(ed)
        await sleep(pauseBetweenSteps)

        await typeEd(ed, "createdAt")
        await sleep(baseDelay)

        await typeEd(ed, ", sql`NOW() - INTERVAL '30 days'`),\n  isNotNull(users.")
        await sleep(baseDelay)
        await triggerSuggest(ed)
        await sleep(pauseBetweenSteps)

        await typeEd(ed, "email")
        await sleep(baseDelay)

        await typeEd(ed, "),\n  or(\n    eq(users.")
        await sleep(baseDelay)
        await triggerSuggest(ed)
        await sleep(pauseBetweenSteps)

        await typeEd(ed, "status")
        await sleep(baseDelay)

        await typeEd(ed, ", 'active'),\n    eq(users.")
        await sleep(baseDelay)
        await triggerSuggest(ed)
        await sleep(pauseBetweenSteps)

        await typeEd(ed, "status")
        await sleep(baseDelay)

        await typeEd(ed, ", 'pending')\n  )\n))")
        await sleep(300)

        console.log("Step 14: Adding .groupBy() clause...")
        await typeEd(ed, "\n.")
        await sleep(baseDelay)
        await triggerSuggest(ed)
        await sleep(pauseBetweenSteps)

        await typeEd(ed, "groupBy(users.")
        await sleep(baseDelay)
        await triggerSuggest(ed)
        await sleep(pauseBetweenSteps)

        await acceptSug(ed)
        await sleep(baseDelay)

        await typeEd(ed, ")")
        await sleep(300)

        console.log("Step 15: Adding .orderBy() with desc...")
        await typeEd(ed, "\n.")
        await sleep(baseDelay)
        await triggerSuggest(ed)
        await sleep(pauseBetweenSteps)

        await typeEd(ed, "orderBy(desc(users.")
        await sleep(baseDelay)
        await triggerSuggest(ed)
        await sleep(pauseBetweenSteps)

        await typeEd(ed, "createdAt")
        await sleep(baseDelay)

        await typeEd(ed, "))")
        await sleep(300)

        console.log("Step 16: Adding .limit() and .offset()...")
        await typeEd(ed, "\n.")
        await sleep(baseDelay)
        await triggerSuggest(ed)
        await sleep(pauseBetweenSteps)

        await typeEd(ed, "limit(50)")
        await sleep(baseDelay)

        await typeEd(ed, "\n.")
        await sleep(baseDelay)
        await triggerSuggest(ed)
        await sleep(pauseBetweenSteps)

        await typeEd(ed, "offset(0);")
        await sleep(baseDelay)

        console.log("")
        console.log("LSP Showcase Demo Complete!")
        console.log("Final query demonstrates:")
        console.log("  - Complex column selection with aliases")
        console.log("  - SQL template literals for raw expressions")
        console.log("  - Subqueries with correlated references")
        console.log("  - JOIN clauses with equality conditions")
        console.log("  - Compound WHERE conditions (and, or, gt, isNotNull, eq)")
        console.log("  - GROUP BY, ORDER BY with direction")
        console.log("  - Pagination with LIMIT/OFFSET")
    }

    async function runSimple() {
        var ed = getEd()
        if (!ed) {
            console.log("No Monaco editor instance found.")
            return
        }

        console.log("Starting Simple LSP Demo...")

        ed.focus()
        if (typeof ed.getModel === "function") {
            var m = ed.getModel()
            if (m && typeof m.setValue === "function") m.setValue("")
        }

        await sleep(500)

        await typeEd(ed, "db.")
        await sleep(1000)
        await triggerSuggest(ed)
        await sleep(1200)

        await acceptSug(ed)
        await sleep(800)

        await typeEd(ed, ".from(")
        await sleep(800)
        await triggerSuggest(ed)
        await sleep(1200)

        await acceptSug(ed)
        await sleep(800)

        await typeEd(ed, ").where(eq(users.")
        await sleep(800)
        await triggerSuggest(ed)
        await sleep(1200)

        await acceptSug(ed)
        await sleep(800)

        await typeEd(ed, ", 1)).limit(100);")

        console.log("Simple LSP Demo Complete!")
    }

    globalThis.doraLSP = {
        run: run,
        runSimple: runSimple,
        getEditor: getEd
    }

    console.log("LSP Showcase Script Loaded")
    console.log("")
    console.log("Commands:")
    console.log("  doraLSP.run()        - Run full complex query demo")
    console.log("  doraLSP.run({delay: 500, pauseBetweenSteps: 800}) - Faster demo")
    console.log("  doraLSP.runSimple()  - Run simple SELECT demo")
    console.log("  doraLSP.getEditor()  - Get Monaco editor instance")
})()
