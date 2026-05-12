/* eslint-disable */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UserWarning } from './UserWarning';
import {
  USER_ID,
  getTodos,
  createTodo,
  deleteTodo,
  updateTodo,
} from './api/todos';
import { Todo } from './types/Todo';

type Filter = 'all' | 'active' | 'completed';

export const App: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loadingIds, setLoadingIds] = useState<number[]>([]);

  const errorTimer = useRef<number | null>(null);
  const newTodoRef = useRef<HTMLInputElement | null>(null);

  function showError(text: string) {
    setError(text);
    if (errorTimer.current) {
      window.clearTimeout(errorTimer.current);
    }
    // hide after 3s
    errorTimer.current = window.setTimeout(() => setError(null), 3000);
  }

  useEffect(() => {
    if (!USER_ID) {
      return;
    }

    getTodos()
      .then(data => setTodos(data))
      .catch(() => showError('Unable to load todos'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // focus input after load
    if (!loading && newTodoRef.current) {
      newTodoRef.current.focus();
    }
  }, [loading]);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) {
      return;
    }
    const input = newTodoRef.current;
    if (!input) {
      return;
    }
    const raw = input.value;
    const title = raw.trim();

    if (!title) {
      showError('Title should not be empty');
      return;
    }

    setCreating(true);
    // add temp todo
    const temp: Todo = {
      id: Math.random(),
      userId: USER_ID as number,
      title,
      completed: false,
    };

    setLoadingIds(prev => [...prev, temp.id]);
    setTodos(prev => [...prev, temp]);

    createTodo({ ...temp, id: undefined })
      .then(created => {
        setTodos(prev => prev.map(t => (t.id === temp.id ? created : t)));
        setLoadingIds(prev => prev.filter(id => id !== temp.id));
        input.value = '';
        input.focus();
      })
      .catch(() => {
        setTodos(prev => prev.filter(t => t.id !== temp.id));
        setLoadingIds(prev => prev.filter(id => id !== temp.id));
        showError('Unable to add a todo');
      })
      .finally(() => setCreating(false));
  }

  function handleDelete(id: number) {
    setLoadingIds(prev => [...prev, id]);
    deleteTodo(id)
      .then(() => setTodos(prev => prev.filter(t => t.id !== id)))
      .catch(() => {
        showError('Unable to delete a todo');
      })
      .finally(() => setLoadingIds(prev => prev.filter(x => x !== id)));
  }

  function handleUpdate(id: number, patch: Partial<Todo>) {
    setLoadingIds(prev => [...prev, id]);
    setTodos(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));

    return updateTodo(id, patch)
      .catch(() => {
        showError('Unable to update a todo');
        // revert
        return getTodos().then(d => setTodos(d));
      })
      .finally(() => setLoadingIds(prev => prev.filter(x => x !== id)));
  }

  const visibleTodos = useMemo(() => {
    if (filter === 'all') return todos;
    if (filter === 'active') return todos.filter(t => !t.completed);
    return todos.filter(t => t.completed);
  }, [todos, filter]);

  const activeCount = todos.filter(t => !t.completed).length;
  const completedCount = todos.filter(t => t.completed).length;

  if (!USER_ID) return <UserWarning />;

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>

      <div className="todoapp__content">
        <header className="todoapp__header">
          {!loading && todos.length > 0 && (
            <button
              type="button"
              className={`todoapp__toggle-all ${completedCount > 0 && completedCount === todos.length ? 'active' : ''}`}
              data-cy="ToggleAllButton"
              onClick={() => {
                const allCompleted =
                  todos.length > 0 && todos.every(t => t.completed);

                if (allCompleted) {
                  todos.forEach(t => {
                    handleUpdate(t.id, { completed: false });
                  });
                } else {
                  todos
                    .filter(t => !t.completed)
                    .forEach(t => {
                      handleUpdate(t.id, { completed: true });
                    });
                }
              }}
            />
          )}

          <form onSubmit={handleCreate}>
            <input
              ref={el => (newTodoRef.current = el)}
              data-cy="NewTodoField"
              type="text"
              className="todoapp__new-todo"
              placeholder="What needs to be done?"
              defaultValue=""
              disabled={creating}
            />
          </form>
        </header>

        <section className="todoapp__main" data-cy="TodoList">
          {!loading &&
            visibleTodos.map(t => (
              <div
                key={t.id}
                data-cy="Todo"
                className={`todo ${t.completed ? 'completed' : ''}`}
              >
                <label className="todo__status-label">
                  <input
                    data-cy="TodoStatus"
                    type="checkbox"
                    className="todo__status"
                    checked={t.completed}
                    onChange={() =>
                      handleUpdate(t.id, { completed: !t.completed })
                    }
                  />
                </label>

                {editingId === t.id ? (
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      setEditingId(null);
                    }}
                  >
                    <input
                      data-cy="TodoTitleField"
                      type="text"
                      className="todo__title-field"
                      defaultValue={t.title}
                      onBlur={e => {
                        const value = e.currentTarget.value.trim();
                        if (!value) {
                          handleDelete(t.id);
                          return;
                        }
                        if (value !== t.title)
                          handleUpdate(t.id, { title: value });
                        setEditingId(null);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Escape') setEditingId(null);
                        if (e.key === 'Enter') {
                          const value = (
                            e.target as HTMLInputElement
                          ).value.trim();
                          if (!value) {
                            handleDelete(t.id);
                          } else if (value !== t.title) {
                            handleUpdate(t.id, { title: value });
                          }
                          setEditingId(null);
                        }
                      }}
                      autoFocus
                    />
                  </form>
                ) : (
                  <>
                    <span
                      data-cy="TodoTitle"
                      className="todo__title"
                      onDoubleClick={() => setEditingId(t.id)}
                    >
                      {t.title}
                    </span>
                    <button
                      type="button"
                      className="todo__remove"
                      data-cy="TodoDelete"
                      onClick={() => handleDelete(t.id)}
                    >
                      ×
                    </button>
                  </>
                )}

                <div
                  data-cy="TodoLoader"
                  className={`modal overlay ${loadingIds.includes(t.id) ? 'is-active' : ''}`}
                >
                  <div className="modal-background has-background-white-ter" />
                  <div className="loader" />
                </div>
              </div>
            ))}
        </section>

        {todos.length > 0 && (
          <footer className="todoapp__footer" data-cy="Footer">
            <span className="todo-count" data-cy="TodosCounter">
              {activeCount} {activeCount === 1 ? 'item' : 'items'} left
            </span>

            <nav className="filter" data-cy="Filter">
              <a
                href="#/"
                className={`filter__link ${filter === 'all' ? 'selected' : ''}`}
                data-cy="FilterLinkAll"
                onClick={() => setFilter('all')}
              >
                All
              </a>
              <a
                href="#/active"
                className={`filter__link ${filter === 'active' ? 'selected' : ''}`}
                data-cy="FilterLinkActive"
                onClick={() => setFilter('active')}
              >
                Active
              </a>
              <a
                href="#/completed"
                className={`filter__link ${filter === 'completed' ? 'selected' : ''}`}
                data-cy="FilterLinkCompleted"
                onClick={() => setFilter('completed')}
              >
                Completed
              </a>
            </nav>

            <button
              type="button"
              className="todoapp__clear-completed"
              data-cy="ClearCompletedButton"
              disabled={completedCount === 0}
              onClick={() => {
                // delete each completed todo
                const ids = todos.filter(t => t.completed).map(t => t.id);
                ids.forEach(id => handleDelete(id));
              }}
            >
              Clear completed
            </button>
          </footer>
        )}
      </div>

      <div
        data-cy="ErrorNotification"
        className={`notification is-danger is-light has-text-weight-normal ${error ? '' : 'hidden'}`}
      >
        <button
          data-cy="HideErrorButton"
          type="button"
          className="delete"
          onClick={() => setError(null)}
        />
        {error}
      </div>
    </div>
  );
};
