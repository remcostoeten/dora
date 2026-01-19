# Todo List Feature Specification

## 1. Goal
Create a simple yet powerful Todo List feature within the Dora desktop application to help developers track tasks directly within their workspace.

## 2. Requirements

### Functional Requirements
- **Create Task**: Users can add new tasks with a title and optional description.
- **List Tasks**: View all tasks, filterable by status (active, completed).
- **Update Task**: Edit task details, toggle completion status.
- **Delete Task**: Remove tasks permanently.
- **Persistence**: Tasks must be saved locally (SQLite/LocalStorage).
- **Priorities**: Assign low, medium, or high priority to tasks.

### Non-Functional Requirements
- **Performance**: Instant UI updates (optimistic UI).
- **Accessibility**: Keyboard navigation support.
- **Design**: Consistent with Dora's dark theme and `shadcn/ui` components.

## 3. Data Model

```typescript
type Priority = 'low' | 'medium' | 'high';

interface Todo {
  id: string;          // UUID
  title: string;       // Max 255 chars
  description?: string; // Markdown supported
  isCompleted: boolean;
  priority: Priority;
  createdAt: number;   // Timestamp
  updatedAt: number;   // Timestamp
}
```

## 4. UI/UX Design

### Main View
- **Header**: "Tasks" title + "Add Task" button.
- **Task List**: Vertical list of tasks.
  - *Item*: Checkbox | Title | Priority Badge | Actions (Edit/Delete).
  - *Completed Items*: Strikethrough style, moved to bottom or separate tab.

### Add/Edit Dialog
- Modal with:
  - Title input (focused by default).
  - Description textarea.
  - Priority dropdown/radio group.
  - Save & Cancel buttons.

## 5. Technical Implementation
- **State Management**: React Query + Local State.
- **Storage**: Tauri Store or SQLite (via `src-tauri` backend).
- **Components**: 
  - `TodoList`
  - `TodoItem`
  - `CreateTodoDialog`
  - `TodoFilter`

## 6. Future Enhancements
- Tags/Categories.
- Due Dates with reminders.
- Drag-and-drop reordering.
