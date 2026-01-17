"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRecording } from "@/core/recording";
import { Play, Pause, SkipForward, RotateCcw, Settings2, X } from "lucide-react";
import * as monaco from "monaco-editor";

// Support for advanced steps that simulate partial typing + autocomplete (Enter press)
type DemoStep = string | { text: string; typeChars?: number };

type DemoQuery = {
    name: string;
    steps: DemoStep[];
    description: string;
};

const DEFAULT_DEMOS: DemoQuery[] = [
    {
        name: "Basic Select Chain",
        description: "Shows db.select().from().where() chain",
        steps: [
            "db.",
            "db.select().",
            "db.select().from(customers).",
            "db.select().from(customers).where(",
            "db.select().from(customers).where(eq(customers.",
            "db.select().from(customers).where(eq(customers.id, 1))",
        ],
    },
    {
        name: "Autocomplete Speed Run",
        description: "Simulates pressing 'Enter' on suggestions",
        steps: [
            { text: "db.", typeChars: 3 },
            { text: "db.select()", typeChars: 4 }, // types "db.s" -> completes
            { text: "db.select().from(users)", typeChars: 6 }, // types ".from(" -> completes
            { text: "db.select().from(users).where(", typeChars: 4 }, // types ".whe" -> completes
            { text: "db.select().from(users).where(eq(users.id, 1))", typeChars: 6 }, // types "eq(use" -> completes
        ],
    },
    {
        name: "Insert with Upsert",
        description: "Shows insert and onConflict methods",
        steps: [
            "db.",
            "db.insert(users).",
            "db.insert(users).values({ name: 'John' }).",
            "db.insert(users).values({ name: 'John' }).onConflictDoUpdate(",
        ],
    },
    {
        name: "Complex Query with Joins",
        description: "Shows joins, groupBy, having",
        steps: [
            "db.select().",
            "db.select().from(orders).",
            "db.select().from(orders).leftJoin(",
            "db.select().from(orders).leftJoin(customers, eq(orders.customerId, customers.id)).",
            "db.select().from(orders).leftJoin(customers, eq(orders.customerId, customers.id)).groupBy(",
            "db.select().from(orders).leftJoin(customers, eq(orders.customerId, customers.id)).groupBy(customers.id).",
            "db.select().from(orders).leftJoin(customers, eq(orders.customerId, customers.id)).groupBy(customers.id).having(",
        ],
    },
    {
        name: "Aggregates & Operators",
        description: "Shows count, sum, inArray, like",
        steps: [
            "db.select({ total: ",
            "db.select({ total: count(",
            "db.select({ total: count(orders.id) }).from(orders).",
            "db.select({ total: count(orders.id) }).from(orders).where(",
            "db.select({ total: count(orders.id) }).from(orders).where(inArray(",
        ],
    },
    {
        name: "CTE with Set Operations",
        description: "Shows db.with() and union",
        steps: [
            "db.",
            "db.with(",
            'db.with("activeUsers").as(db.select().from(users)).',
            'db.with("activeUsers").as(db.select().from(users)).select().',
            'db.with("activeUsers").as(db.select().from(users)).select().from(activeUsers).',
            'db.with("activeUsers").as(db.select().from(users)).select().from(activeUsers).union(',
        ],
    },
    {
        name: "Update with Returning",
        description: "Shows update chain with returning",
        steps: [
            "db.",
            "db.update(users).",
            "db.update(users).set({ status: 'active' }).",
            "db.update(users).set({ status: 'active' }).where(",
            "db.update(users).set({ status: 'active' }).where(eq(users.id, 1)).",
            "db.update(users).set({ status: 'active' }).where(eq(users.id, 1)).returning()",
        ],
    },
];

type Props = {
    editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>;
    onClose?: () => void;
};

export function LspDemoWidget({ editorRef, onClose }: Props) {
    const { shouldHide } = useRecording();
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(80); // ms per character
    const [pauseBetweenSteps, setPauseBetweenSteps] = useState(1500); // ms pause to show suggestions
    const [currentDemoIndex, setCurrentDemoIndex] = useState(0);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [showSettings, setShowSettings] = useState(false);
    const [autoAdvance, setAutoAdvance] = useState(true);
    const [demos, setDemos] = useState<DemoQuery[]>(DEFAULT_DEMOS);

    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isPlayingRef = useRef(false);

    const currentDemo = demos[currentDemoIndex];

    const clearTimeouts = useCallback(function clearTimeouts() {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const setEditorContent = useCallback(function setEditorContent(content: string, cursorAtEnd = true): void {
        const editor = editorRef.current;
        if (!editor) return;

        const model = editor.getModel();
        if (!model) return;

        // Set the new content
        model.setValue(content);

        // Move cursor to end
        if (cursorAtEnd) {
            const lastLine = model.getLineCount();
            const lastColumn = model.getLineMaxColumn(lastLine);
            editor.setPosition({ lineNumber: lastLine, column: lastColumn });
        }
        editor.focus();

        // Trigger suggestions after a short delay
        setTimeout(function triggerSuggest() {
            editor.trigger("demo", "editor.action.triggerSuggest", {});
        }, 100);
    }, [editorRef]);

    const typeStep = useCallback(function typeStep(stepData: DemoStep, charIndex: number, startTextLength: number): void {
        if (!isPlayingRef.current) return;

        const editor = editorRef.current;
        if (!editor) return;

        // Extract step text and config
        const stepText = typeof stepData === "string" ? stepData : stepData.text;
        const typeCharsLimit = typeof stepData === "object" ? stepData.typeChars : undefined;

        // Determine target length: existing text length + diff
        // But here stepText IS the full text we want to achieve.
        // We start typing from 'startTextLength' index.

        const charsToType = stepText.slice(startTextLength);

        // If simulated autocomplete is used, we only type 'typeCharsLimit' characters
        // then pause, then jump to full text.

        const effectiveLimit = typeCharsLimit !== undefined ? typeCharsLimit : charsToType.length;

        // Current index relative to the diff part
        const relativeIndex = charIndex - startTextLength;

        if (relativeIndex < effectiveLimit && charIndex < stepText.length) {
            const partialContent = stepText.slice(0, charIndex + 1);
            setEditorContent(partialContent);

            timeoutRef.current = setTimeout(function typeNextChar() {
                typeStep(stepData, charIndex + 1, startTextLength);
            }, speed);
        } else {
            // Typing finished (either fully typed or hit the simulated limit)

            // If we hit limit but haven't finished text, we do the "autocomplete jump"
            if (charIndex < stepText.length) {
                // Pause to simulate user looking at suggestions
                timeoutRef.current = setTimeout(function performAutocomplete() {
                    if (!isPlayingRef.current) return;
                    // Jump to full text
                    setEditorContent(stepText);

                    // Then schedule next step
                    scheduleNextStep();
                }, pauseBetweenSteps); // Use same pause or separate shorter pause?
            } else {
                // Fully typed, just wait for next step
                scheduleNextStep();
            }
        }

        function scheduleNextStep() {
            timeoutRef.current = setTimeout(function advanceStep() {
                if (!isPlayingRef.current) return;

                const nextStepIndex = currentStepIndex + 1;
                if (nextStepIndex < currentDemo.steps.length) {
                    setCurrentStepIndex(nextStepIndex);
                } else if (autoAdvance) {
                    // Move to next demo
                    const nextDemoIndex = (currentDemoIndex + 1) % demos.length;
                    setCurrentDemoIndex(nextDemoIndex);
                    setCurrentStepIndex(0);
                } else {
                    // Stop at end of demo
                    setIsPlaying(false);
                    isPlayingRef.current = false;
                }
            }, pauseBetweenSteps);
        }

    }, [speed, pauseBetweenSteps, currentDemo, currentStepIndex, currentDemoIndex, autoAdvance, demos.length, setEditorContent, editorRef]);

    // Start typing when step changes
    useEffect(function onStepChange() {
        if (isPlayingRef.current && currentDemo) {
            const stepData = currentDemo.steps[currentStepIndex];
            if (stepData) {
                // Get previous step to know where to start typing from
                const prevStepData = currentStepIndex > 0 ? currentDemo.steps[currentStepIndex - 1] : "";
                const prevText = typeof prevStepData === "string" ? prevStepData : prevStepData.text;

                // Start typing from where previous left off
                typeStep(stepData, prevText.length, prevText.length);
            }
        }
    }, [currentStepIndex, currentDemoIndex, currentDemo, typeStep]);

    function handlePlay(): void {
        if (isPlaying) {
            setIsPlaying(false);
            isPlayingRef.current = false;
            clearTimeouts();
        } else {
            setIsPlaying(true);
            isPlayingRef.current = true;

            // Start logic
            const stepData = currentDemo.steps[currentStepIndex];
            if (stepData) {
                const prevStepData = currentStepIndex > 0 ? currentDemo.steps[currentStepIndex - 1] : "";
                const prevText = typeof prevStepData === "string" ? prevStepData : prevStepData.text;

                typeStep(stepData, prevText.length, prevText.length);
            }
        }
    }

    function handleSkip(): void {
        clearTimeouts();
        const nextDemoIndex = (currentDemoIndex + 1) % demos.length;
        setCurrentDemoIndex(nextDemoIndex);
        setCurrentStepIndex(0);

        if (isPlaying) {
            // Will auto-start via useEffect
        }
    }

    function handleReset(): void {
        clearTimeouts();
        setIsPlaying(false);
        isPlayingRef.current = false;
        setCurrentDemoIndex(0);
        setCurrentStepIndex(0);
        setEditorContent("");
    }

    function handleDemoSelect(index: number): void {
        clearTimeouts();
        setCurrentDemoIndex(index);
        setCurrentStepIndex(0);
        setEditorContent("");
    }

    // Cleanup on unmount
    useEffect(function onUnmount() {
        return function cleanup() {
            clearTimeouts();
        };
    }, [clearTimeouts]);

    // UI Helper Components (Inlined to avoid missing deps)
    const Button = ({ className, variant = "default", size = "default", onClick, children }: any) => {
        const base = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
        const variants: Record<string, string> = {
            default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
            destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
            outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
            secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
            ghost: "hover:bg-accent hover:text-accent-foreground"
        };
        const sizes: Record<string, string> = {
            default: "h-9 px-4 py-2",
            sm: "h-8 rounded-md px-3 text-xs",
            icon: "h-9 w-9"
        };
        return (
            <button
                className={`${base} ${variants[variant] || variants.default} ${sizes[size] || sizes.default} ${className || ""}`}
                onClick={onClick}
            >
                {children}
            </button>
        );
    };

    if (shouldHide('hideWidget')) return null;

    return (
        <div className="fixed bottom-4 right-4 w-80 z-50 rounded-xl border border-input bg-background/95 backdrop-blur shadow-xl text-card-foreground">
            {/* Header */}
            <div className="flex flex-row items-center justify-between p-4 pb-2">
                <div className="font-semibold text-sm flex items-center gap-2">
                    🎬 LSP Demo Widget
                </div>
                <div className="flex gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={function toggleSettings() { setShowSettings(!showSettings); }}
                    >
                        <Settings2 className="h-3 w-3" />
                    </Button>
                    {onClose && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={onClose}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    )}
                </div>
            </div>

            <div className="p-4 space-y-3 pt-0">
                {/* Current Demo Info */}
                <div className="text-xs space-y-1">
                    <div className="font-medium">{currentDemo?.name}</div>
                    <div className="text-muted-foreground">{currentDemo?.description}</div>
                    <div className="text-muted-foreground">
                        Step {currentStepIndex + 1} of {currentDemo?.steps.length}
                    </div>
                </div>

                {/* Playback Controls */}
                <div className="flex items-center gap-2">
                    <Button
                        variant={isPlaying ? "destructive" : "default"}
                        size="sm"
                        onClick={handlePlay}
                        className="flex-1"
                    >
                        {isPlaying ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                        {isPlaying ? "Pause" : "Play"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleSkip}>
                        <SkipForward className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleReset}>
                        <RotateCcw className="h-4 w-4" />
                    </Button>
                </div>

                {/* Settings Panel */}
                {showSettings && (
                    <div className="space-y-3 pt-2 border-t mt-2">
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                                <label className="font-medium">Typing Speed</label>
                                <span>{speed}ms</span>
                            </div>
                            <input
                                type="range"
                                min={20}
                                max={200}
                                step={10}
                                value={speed}
                                onChange={(e) => setSpeed(Number(e.target.value))}
                                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                                <label className="font-medium">Pause</label>
                                <span>{pauseBetweenSteps}ms</span>
                            </div>
                            <input
                                type="range"
                                min={500}
                                max={5000}
                                step={100}
                                value={pauseBetweenSteps}
                                onChange={(e) => setPauseBetweenSteps(Number(e.target.value))}
                                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <input
                                type="checkbox"
                                id="autoAdvance"
                                checked={autoAdvance}
                                onChange={function onChange(e) { setAutoAdvance(e.target.checked); }}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <label htmlFor="autoAdvance" className="text-xs">Auto-advance to next demo</label>
                        </div>
                    </div>
                )}

                {/* Demo Selector */}
                <div className="space-y-1 pt-2">
                    <label className="text-xs font-medium">Select Demo:</label>
                    <div className="grid grid-cols-2 gap-1">
                        {demos.map(function renderDemo(demo, index) {
                            return (
                                <Button
                                    key={demo.name}
                                    variant={index === currentDemoIndex ? "secondary" : "ghost"}
                                    size="sm"
                                    className="text-xs h-7 justify-start truncate px-2"
                                    onClick={function onClick() { handleDemoSelect(index); }}
                                >
                                    {index + 1}. {demo.name.split(" ")[0]}
                                </Button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
