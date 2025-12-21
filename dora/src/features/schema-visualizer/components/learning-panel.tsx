"use client"

import { useState } from "react"
import { GraduationCap, BookOpen, CheckCircle2, Circle, ChevronRight, Lightbulb, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"

type Lesson = {
  id: string
  title: string
  description: string
  steps: LessonStep[]
}

type LessonStep = {
  id: string
  title: string
  content: string
  hint?: string
}

const LESSONS: Lesson[] = [
  {
    id: "basics",
    title: "Database Basics",
    description: "Learn fundamental concepts of relational databases",
    steps: [
      {
        id: "tables",
        title: "Understanding Tables",
        content:
          "Tables are the foundation of relational databases. Each table represents an entity (like users, products, or orders) and contains rows (records) and columns (fields).",
        hint: "Think of tables like spreadsheets - each row is a record, each column is a property.",
      },
      {
        id: "primary-keys",
        title: "Primary Keys",
        content:
          "A primary key uniquely identifies each row in a table. It must be unique and cannot be null. Common choices are auto-incrementing integers or UUIDs.",
        hint: "Always add a primary key to every table. 'id' is the conventional name.",
      },
      {
        id: "data-types",
        title: "Data Types",
        content:
          "Choose appropriate data types for your columns: VARCHAR for text, INT for numbers, BOOLEAN for true/false, TIMESTAMP for dates, and UUID for unique identifiers.",
        hint: "Use VARCHAR with a length limit for user input, TEXT for longer content.",
      },
    ],
  },
  {
    id: "relationships",
    title: "Table Relationships",
    description: "Master foreign keys and relationship types",
    steps: [
      {
        id: "one-to-many",
        title: "One-to-Many Relationships",
        content:
          "The most common relationship type. One record in table A can relate to many records in table B. Example: One user can have many orders.",
        hint: "Add a foreign key column in the 'many' table pointing to the 'one' table's primary key.",
      },
      {
        id: "many-to-many",
        title: "Many-to-Many Relationships",
        content:
          "When records in both tables can relate to multiple records in the other. Example: Posts can have many tags, and tags can be on many posts. Requires a junction table.",
        hint: "Create a junction table with foreign keys to both tables as a composite primary key.",
      },
      {
        id: "one-to-one",
        title: "One-to-One Relationships",
        content:
          "When one record in table A relates to exactly one record in table B. Often used to split large tables or store optional data separately.",
        hint: "Use unique constraints on foreign keys to enforce one-to-one relationships.",
      },
    ],
  },
  {
    id: "normalization",
    title: "Database Normalization",
    description: "Organize data to reduce redundancy",
    steps: [
      {
        id: "1nf",
        title: "First Normal Form (1NF)",
        content:
          "Each column should contain atomic values (no lists or arrays). Each row should be unique. This eliminates repeating groups.",
        hint: "If you have comma-separated values in a column, you need to normalize.",
      },
      {
        id: "2nf",
        title: "Second Normal Form (2NF)",
        content:
          "Meet 1NF requirements, and all non-key columns must depend on the entire primary key. This applies mainly to tables with composite keys.",
        hint: "If some columns only depend on part of the primary key, split into separate tables.",
      },
      {
        id: "3nf",
        title: "Third Normal Form (3NF)",
        content:
          "Meet 2NF requirements, and no non-key column should depend on another non-key column. This eliminates transitive dependencies.",
        hint: "If column A determines column B, and B determines C, then C has a transitive dependency.",
      },
    ],
  },
  {
    id: "best-practices",
    title: "Best Practices",
    description: "Professional database design patterns",
    steps: [
      {
        id: "naming",
        title: "Naming Conventions",
        content:
          "Use snake_case for table and column names. Table names should be plural (users, not user). Foreign keys should be table_name_id format.",
        hint: "Consistent naming makes your schema self-documenting.",
      },
      {
        id: "timestamps",
        title: "Audit Columns",
        content:
          "Add created_at and updated_at columns to track when records are created and modified. Some tables may also need a deleted_at for soft deletes.",
        hint: "Set created_at default to CURRENT_TIMESTAMP for automatic population.",
      },
      {
        id: "indexes",
        title: "Indexing Strategy",
        content:
          "Create indexes on columns used in WHERE clauses and JOINs. All foreign keys should be indexed. Avoid over-indexing as it slows down writes.",
        hint: "Primary keys are automatically indexed. Focus on foreign keys and frequently queried columns.",
      },
    ],
  },
]

type LearningPanelProps = {
  onHighlightConcept?: (concept: string) => void
}

export function LearningPanel({ onHighlightConcept }: LearningPanelProps) {
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())

  const totalSteps = LESSONS.reduce((acc, l) => acc + l.steps.length, 0)
  const completedCount = completedSteps.size
  const progress = (completedCount / totalSteps) * 100

  const handleCompleteStep = (stepId: string) => {
    setCompletedSteps((prev) => new Set([...prev, stepId]))
  }

  const handleNextStep = () => {
    if (!selectedLesson) return

    const currentStep = selectedLesson.steps[currentStepIndex]
    handleCompleteStep(`${selectedLesson.id}-${currentStep.id}`)

    if (currentStepIndex < selectedLesson.steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1)
    } else {
      // Lesson complete, go back to list
      setSelectedLesson(null)
      setCurrentStepIndex(0)
    }
  }

  if (selectedLesson) {
    const currentStep = selectedLesson.steps[currentStepIndex]
    const stepProgress = ((currentStepIndex + 1) / selectedLesson.steps.length) * 100

    return (
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="border-b border-border/50 px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 -ml-2 mb-2"
            onClick={() => {
              setSelectedLesson(null)
              setCurrentStepIndex(0)
            }}
          >
            <ChevronRight className="h-4 w-4 rotate-180 mr-1" />
            Back to lessons
          </Button>
          <h3 className="font-medium text-sm">{selectedLesson.title}</h3>
          <div className="flex items-center gap-2 mt-2">
            <Progress value={stepProgress} className="h-1.5 flex-1" />
            <span className="text-xs text-muted-foreground">
              {currentStepIndex + 1}/{selectedLesson.steps.length}
            </span>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            <h4 className="font-medium text-base mb-3">{currentStep.title}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{currentStep.content}</p>

            {currentStep.hint && (
              <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <Lightbulb className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-primary">{currentStep.hint}</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border/50 p-4">
          <Button onClick={handleNextStep} className="w-full">
            {currentStepIndex < selectedLesson.steps.length - 1 ? (
              <>
                Next Step
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            ) : (
              <>
                Complete Lesson
                <CheckCircle2 className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
        <GraduationCap className="h-4 w-4 text-primary" />
        <h3 className="font-medium text-sm">Learn Schema Design</h3>
      </div>

      {/* Progress overview */}
      <div className="px-4 py-3 border-b border-border/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Overall Progress</span>
          <span className="text-xs font-medium">
            {completedCount}/{totalSteps} steps
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Lessons list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {LESSONS.map((lesson) => {
            const lessonCompletedSteps = lesson.steps.filter((s) => completedSteps.has(`${lesson.id}-${s.id}`)).length
            const isComplete = lessonCompletedSteps === lesson.steps.length

            return (
              <button
                key={lesson.id}
                onClick={() => setSelectedLesson(lesson)}
                className="w-full text-left rounded-lg border border-border/50 bg-card/50 p-3 transition-all hover:bg-accent/50"
              >
                <div className="flex items-start gap-3">
                  <div className={`rounded-md p-1.5 ${isComplete ? "bg-green-500/20" : "bg-muted"}`}>
                    {isComplete ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{lesson.title}</span>
                      {isComplete && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-4 text-green-500 border-green-500/30"
                        >
                          Complete
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{lesson.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center gap-1">
                        {lesson.steps.map((step, idx) => (
                          <div key={step.id}>
                            {completedSteps.has(`${lesson.id}-${step.id}`) ? (
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                            ) : (
                              <Circle className="h-3 w-3 text-muted-foreground/50" />
                            )}
                          </div>
                        ))}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {lessonCompletedSteps}/{lesson.steps.length} steps
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
