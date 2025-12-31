import { useState } from "react";
import React from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Sparkles,
  BookOpen,
  Keyboard,
  Code,
  Zap,
  FileText,
  Database,
  Search,
  FilePlus,
  Settings,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { cn } from "@/shared/utils/cn";

type Snippet = {
  id: string;
  label: string;
  code: string;
  description?: string;
  category: string;
};

type Shortcut = {
  key: string;
  description: string;
};

const HINTS: Snippet[] = [
  {
    id: "select-basic",
    label: "Basic SELECT",
    code: "const result = await db.select().from(users);",
    description: "Select all columns from a table",
    category: "Query"
  },
  {
    id: "select-where",
    label: "SELECT with WHERE",
    code: `const result = await db
  .select()
  .from(users)
  .where(eq(users.id, 1));`,
    description: "Select with filter condition",
    category: "Query"
  },
  {
    id: "insert",
    label: "INSERT",
    code: `await db.insert(users).values({
  name: 'John',
  email: 'john@example.com'
});`,
    description: "Insert a new row",
    category: "Mutation"
  },
  {
    id: "update",
    label: "UPDATE",
    code: `await db.update(users)
  .set({ name: 'Jane' })
  .where(eq(users.id, 1));`,
    description: "Update rows",
    category: "Mutation"
  },
  {
    id: "delete",
    label: "DELETE",
    code: `await db.delete(users)
  .where(eq(users.id, 1));`,
    description: "Delete rows",
    category: "Mutation"
  },
  {
    id: "join",
    label: "JOIN",
    code: `const result = await db
  .select()
  .from(users)
  .leftJoin(orders, eq(users.id, orders.userId));`,
    description: "Join two tables",
    category: "Query"
  },
  {
    id: "aggregate",
    label: "Aggregation",
    code: `const result = await db
  .select({
    total: sum(orders.total),
    count: count()
  })
  .from(orders);`,
    description: "Aggregate functions",
    category: "Query"
  },
  {
    id: "transaction",
    label: "Transaction",
    code: `await db.transaction(async (tx) => {
  await tx.insert(users).values({...});
  await tx.insert(posts).values({...});
});`,
    description: "Run multiple operations atomically",
    category: "Advanced"
  },
  {
    id: "raw-sql",
    label: "Raw SQL",
    code: `const result = await db.execute(
  sql\`SELECT * FROM users WHERE id = \${userId}\`
);`,
    description: "Execute raw SQL",
    category: "Advanced"
  },
];

const SHORTCUTS: Shortcut[] = [
  { key: "Ctrl/Cmd + Enter", description: "Run query" },
  { key: "Ctrl/Cmd + S", description: "Save" },
  { key: "Ctrl/Cmd + F", description: "Find" },
  { key: "Ctrl/Cmd + H", description: "Replace" },
  { key: "Ctrl/Cmd + /", description: "Toggle comment" },
  { key: "Ctrl/Cmd + D", description: "Select next occurrence" },
  { key: "Alt + ↑/↓", description: "Move line up/down" },
  { key: "Ctrl/Cmd + Shift + K", description: "Delete line" },
];

const OPERATORS: Snippet[] = [
  { id: "eq", label: "Equal (eq)", code: "eq(column, value)", description: "column = value", category: "Operators" },
  { id: "ne", label: "Not equal (ne)", code: "ne(column, value)", description: "column != value", category: "Operators" },
  { id: "gt", label: "Greater than (gt)", code: "gt(column, value)", description: "column > value", category: "Operators" },
  { id: "gte", label: "Greater or equal (gte)", code: "gte(column, value)", description: "column >= value", category: "Operators" },
  { id: "lt", label: "Less than (lt)", code: "lt(column, value)", description: "column < value", category: "Operators" },
  { id: "lte", label: "Less or equal (lte)", code: "lte(column, value)", description: "column <= value", category: "Operators" },
  { id: "like", label: "LIKE", code: "like(column, '%pattern%')", description: "Pattern matching", category: "Operators" },
  { id: "inArray", label: "IN", code: "inArray(column, [1, 2, 3])", description: "column IN (...)", category: "Operators" },
  { id: "and", label: "AND", code: "and(cond1, cond2)", description: "Combine with AND", category: "Operators" },
  { id: "or", label: "OR", code: "or(cond1, cond2)", description: "Combine with OR", category: "Operators" },
];

type TabType = "snippets" | "shortcuts" | "operators" | "ai";

type Props = {
  isOpen: boolean;
  onToggle: () => void;
  onInsertSnippet: (code: string) => void;
};

type TabProps = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: TabType;
  active: TabType;
  onClick: () => void;
};

function Tab({ label, icon: Icon, value, active, onClick }: TabProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors",
        active === value
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}

type SnippetCardProps = {
  snippet: Snippet;
  onInsert: (code: string) => void;
};

function SnippetCard({ snippet, onInsert }: SnippetCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    onInsert(snippet.code);
  };

  return (
    <div className="group p-3 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-accent/30 transition-all cursor-pointer">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1">
          <h4 className="text-sm font-medium text-foreground mb-1">{snippet.label}</h4>
          {snippet.description && (
            <p className="text-xs text-muted-foreground">{snippet.description}</p>
          )}
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
          {snippet.category}
        </span>
      </div>
      <pre className="text-xs bg-muted/50 rounded p-2 overflow-x-auto mb-2 font-mono">
        {snippet.code}
      </pre>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs gap-1 flex-1"
          onClick={handleInsert}
        >
          <Zap className="h-3 w-3" />
          <span>Insert</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={handleCopy}
          title={copied ? "Copied!" : "Copy"}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

type ShortcutRowProps = {
  shortcut: Shortcut;
};

function ShortcutRow({ shortcut }: ShortcutRowProps) {
  const keys = shortcut.key.split(" + ");

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded hover:bg-accent/30 transition-colors">
      <span className="text-sm text-muted-foreground">{shortcut.description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <React.Fragment key={i}>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted border border-border text-foreground">
              {key}
            </kbd>
            {i < keys.length - 1 && <span className="text-xs text-muted-foreground mx-0.5">+</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

type AIHelperProps = {
  onInsert: (code: string) => void;
};

function AIHelper({ onInsert }: AIHelperProps) {
  const PROMPTS = [
    { label: "Generate INSERT query", icon: FilePlus },
    { label: "Optimize this query", icon: Zap },
    { label: "Add pagination", icon: Search },
    { label: "Add error handling", icon: HelpCircle },
  ];

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-medium text-foreground">AI Assistant</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Ask AI to help you write queries, optimize code, or explain errors
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ask AI anything..."
            className="flex-1 h-8 px-2.5 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            disabled
          />
          <Button size="sm" className="h-8 px-3 text-xs gap-1" disabled>
            <Sparkles className="h-3 w-3" />
            <span>Ask</span>
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground px-1">Quick Actions</h4>
        {PROMPTS.map((prompt, i) => (
          <button
            key={i}
            className="w-full flex items-center gap-2 p-2.5 rounded-md border border-border/50 hover:border-primary/50 hover:bg-accent/30 transition-all text-left"
            disabled
          >
            <prompt.icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{prompt.label}</span>
          </button>
        ))}
      </div>

      <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
        <p className="text-[11px] text-muted-foreground text-center">
          AI features coming soon
        </p>
      </div>
    </div>
  );
}

export function CheatsheetPanel({ isOpen, onToggle, onInsertSnippet }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("snippets");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["Query"]));

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const groupedSnippets = HINTS.reduce((acc, snippet) => {
    if (!acc[snippet.category]) {
      acc[snippet.category] = [];
    }
    acc[snippet.category].push(snippet);
    return acc;
  }, {} as Record<string, Snippet[]>);

  return (
    <div className={cn(
      "flex flex-col border-l border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out",
      isOpen ? "w-80" : "w-0 overflow-hidden"
    )}>
      {isOpen && (
        <>
          <div className="flex items-center justify-between px-3 py-2 border-b border-sidebar-border/50">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Cheatsheet
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onToggle}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex items-center gap-1 p-2 border-b border-sidebar-border/50 overflow-x-auto">
            <Tab
              label="Snippets"
              icon={Code}
              value="snippets"
              active={activeTab}
              onClick={() => setActiveTab("snippets")}
            />
            <Tab
              label="Shortcuts"
              icon={Keyboard}
              value="shortcuts"
              active={activeTab}
              onClick={() => setActiveTab("shortcuts")}
            />
            <Tab
              label="Operators"
              icon={Database}
              value="operators"
              active={activeTab}
              onClick={() => setActiveTab("operators")}
            />
            <Tab
              label="AI"
              icon={Sparkles}
              value="ai"
              active={activeTab}
              onClick={() => setActiveTab("ai")}
            />
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3">
              {activeTab === "snippets" && (
                <div className="space-y-3">
                  {Object.entries(groupedSnippets).map(([category, snippets]) => (
                    <div key={category}>
                      <button
                        onClick={() => toggleCategory(category)}
                        className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-2 hover:text-primary transition-colors w-full"
                      >
                        {expandedCategories.has(category) ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        <span>{category}</span>
                        <span className="text-muted-foreground">({snippets.length})</span>
                      </button>
                      {expandedCategories.has(category) && (
                        <div className="space-y-2">
                          {snippets.map(snippet => (
                            <SnippetCard
                              key={snippet.id}
                              snippet={snippet}
                              onInsert={onInsertSnippet}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "shortcuts" && (
                <div className="space-y-1">
                  {SHORTCUTS.map((shortcut, i) => (
                    <ShortcutRow key={i} shortcut={shortcut} />
                  ))}
                </div>
              )}

              {activeTab === "operators" && (
                <div className="space-y-2">
                  {OPERATORS.map(snippet => (
                    <SnippetCard
                      key={snippet.id}
                      snippet={snippet}
                      onInsert={onInsertSnippet}
                    />
                  ))}
                </div>
              )}

              {activeTab === "ai" && (
                <AIHelper onInsert={onInsertSnippet} />
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
