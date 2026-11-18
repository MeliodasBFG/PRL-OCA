import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Copy,
  Download,
  Edit3,
  FilePlus,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  ALL_PRL_CATEGORIES,
  Difficulty,
  PRLCategory,
  PRL_CATEGORY_LABELS,
  QuestionItem,
  QuestionType,
} from '@prl-oca/shared';
import { useGameStore } from '../stores/useGameStore';

export const QuestionBankEditor: React.FC = () => {
  const {
    questionBank,
    setScreen,
    saveQuestion,
    deleteQuestion,
    duplicateQuestion,
    toggleQuestionActive,
    importQuestions,
    resetQuestionBank,
  } = useGameStore();

  const [filterCat, setFilterCat] = useState<string>('all');
  const [filterDiff, setFilterDiff] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [editing, setEditing] = useState<QuestionItem | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredQuestions = useMemo(() => {
    return questionBank.filter((q) => {
      if (filterCat !== 'all' && q.category !== filterCat) return false;
      if (filterDiff !== 'all' && q.difficulty !== filterDiff) return false;
      if (
        search.trim() &&
        !`${q.title} ${q.prompt} ${q.collection ?? ''}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [questionBank, filterCat, filterDiff, search]);

  const startNewQuestion = () => {
    setEditing({
      id: `q_custom_${Date.now()}`,
      title: 'Nueva pregunta preventiva',
      prompt: 'Describe aquí la situación o pregunta de Prevención de Riesgos Laborales...',
      category: 'conceptos_basicos',
      difficulty: 'facil',
      type: 'test',
      options: [
        'Opción A (Correcta)',
        'Opción B (Incorrecta)',
        'Opción C (Incorrecta)',
        'Opción D (Incorrecta)',
      ],
      correctIndices: [0],
      explanation: {
        whyCorrect: 'Explica por qué esta actuación es la correcta.',
        riskIdentified: 'Indica el riesgo laboral principal.',
        consequences: 'Consecuencias potenciales para la seguridad y salud.',
        preventiveMeasures: 'Medidas técnicas u organizativas aplicables.',
        legalReference: 'Ley 31/1995 de Prevención de Riesgos Laborales.',
      },
      points: 10,
      timeSeconds: 30,
      collection: 'Personalizada',
      active: true,
    });
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(questionBank, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prl-oca-banco-preguntas-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const headers = [
      'id',
      'title',
      'prompt',
      'category',
      'difficulty',
      'type',
      'optionA',
      'optionB',
      'optionC',
      'optionD',
      'correctIndex',
      'points',
      'timeSeconds',
      'legalReference',
    ];
    const rows = questionBank.map((q) => [
      q.id,
      `"${q.title.replace(/"/g, '""')}"`,
      `"${q.prompt.replace(/"/g, '""')}"`,
      q.category,
      q.difficulty,
      q.type,
      `"${(q.options[0] ?? '').replace(/"/g, '""')}"`,
      `"${(q.options[1] ?? '').replace(/"/g, '""')}"`,
      `"${(q.options[2] ?? '').replace(/"/g, '""')}"`,
      `"${(q.options[3] ?? '').replace(/"/g, '""')}"`,
      q.correctIndices[0] ?? 0,
      q.points,
      q.timeSeconds,
      `"${q.explanation.legalReference.replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prl-oca-banco-preguntas-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();

    try {
      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text) as QuestionItem[];
        if (Array.isArray(parsed)) {
          importQuestions(parsed);
          setImportMsg(`¡Se han importado ${parsed.length} preguntas desde JSON!`);
        }
      } else if (file.name.endsWith('.csv')) {
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        const imported: QuestionItem[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',');
          if (cols.length >= 8) {
            imported.push({
              id: cols[0].replace(/"/g, '') || `q_csv_${Date.now()}_${i}`,
              title: cols[1].replace(/"/g, '') || 'Pregunta CSV',
              prompt: cols[2].replace(/"/g, '') || 'Enunciado importado',
              category: (cols[3]?.trim() as PRLCategory) || 'conceptos_basicos',
              difficulty: (cols[4]?.trim() as Difficulty) || 'facil',
              type: (cols[5]?.trim() as QuestionType) || 'test',
              options: [
                cols[6]?.replace(/"/g, '') || 'Opción A',
                cols[7]?.replace(/"/g, '') || 'Opción B',
                cols[8]?.replace(/"/g, '') || 'Opción C',
                cols[9]?.replace(/"/g, '') || 'Opción D',
              ].filter(Boolean),
              correctIndices: [Number(cols[10]) || 0],
              points: Number(cols[11]) || 10,
              timeSeconds: Number(cols[12]) || 30,
              explanation: {
                whyCorrect: 'Explicación importada desde archivo CSV del docente.',
                riskIdentified: 'Riesgo asociado a la categoría.',
                consequences: 'Daño prevenible.',
                preventiveMeasures: 'Aplicar medidas preventivas reglamentarias.',
                legalReference: cols[13]?.replace(/"/g, '') || 'Ley 31/1995 LPRL',
              },
              collection: 'Importada CSV',
              active: true,
            });
          }
        }
        if (imported.length > 0) {
          importQuestions(imported);
          setImportMsg(`¡Se han importado ${imported.length} preguntas desde CSV!`);
        }
      }
    } catch {
      setImportMsg('Error al procesar el archivo. Verifica el formato JSON o CSV.');
    }
  };

  return (
    <main className="screen-page editor-page">
      <div className="page-container">
        <div className="editor-topbar">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setScreen('home')}
          >
            <ArrowLeft size={16} /> Volver al Menú Principal
          </button>

          <div>
            <h1>Gestor de Contenidos y Banco de Preguntas PRL</h1>
            <p>
              Total: <strong>{questionBank.length} preguntas</strong> ({questionBank.filter((q) => q.active).length}{' '}
              activas) · Separado de la lógica del motor para adaptarlo a cualquier curso.
            </p>
          </div>

          <div className="editor-actions-bar">
            <button type="button" className="btn-primary" onClick={startNewQuestion}>
              <FilePlus size={16} /> Crear Nueva Pregunta
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} /> Importar CSV / JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv"
              style={{ display: 'none' }}
              onChange={handleFileImport}
            />
            <button type="button" className="btn-secondary" onClick={handleExportJSON}>
              <Download size={16} /> Exportar JSON
            </button>
            <button type="button" className="btn-secondary" onClick={handleExportCSV}>
              <Download size={16} /> Exportar CSV
            </button>
            <button
              type="button"
              className="btn-ghost-sm"
              onClick={resetQuestionBank}
              title="Restaurar paquete oficial inicial"
            >
              <RotateCcw size={15} /> Restaurar Banco Inicial
            </button>
          </div>
        </div>

        {importMsg && <div className="import-toast">{importMsg}</div>}

        {/* Filtros de búsqueda */}
        <div className="editor-filters-row">
          <input
            type="search"
            placeholder="Buscar por título, enunciado o colección temática..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="all">Todas las Categorías PRL (16)</option>
            {ALL_PRL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {PRL_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <select value={filterDiff} onChange={(e) => setFilterDiff(e.target.value)}>
            <option value="all">Todas las Dificultades</option>
            <option value="facil">Fácil (10 pts / 30s)</option>
            <option value="intermedio">Intermedio (20 pts / 45s)</option>
            <option value="avanzado">Avanzado (30 pts / 60s)</option>
          </select>
        </div>

        {/* Formulario de Edición si hay una pregunta seleccionada */}
        {editing && (
          <div className="editor-form-card">
            <h3>Editando Pregunta: {editing.title}</h3>
            <div className="editor-form-grid">
              <label>
                Título breve:
                <input
                  type="text"
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
              </label>

              <label>
                Categoría PRL:
                <select
                  value={editing.category}
                  onChange={(e) =>
                    setEditing({ ...editing, category: e.target.value as PRLCategory })
                  }
                >
                  {ALL_PRL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {PRL_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Dificultad:
                <select
                  value={editing.difficulty}
                  onChange={(e) =>
                    setEditing({ ...editing, difficulty: e.target.value as Difficulty })
                  }
                >
                  <option value="facil">Fácil</option>
                  <option value="intermedio">Intermedio</option>
                  <option value="avanzado">Avanzado</option>
                </select>
              </label>

              <label>
                Colección Temática:
                <input
                  type="text"
                  value={editing.collection ?? ''}
                  onChange={(e) => setEditing({ ...editing, collection: e.target.value })}
                />
              </label>

              <label>
                Puntos:
                <input
                  type="number"
                  value={editing.points}
                  onChange={(e) => setEditing({ ...editing, points: Number(e.target.value) })}
                />
              </label>

              <label>
                Tiempo (segundos):
                <input
                  type="number"
                  value={editing.timeSeconds}
                  onChange={(e) =>
                    setEditing({ ...editing, timeSeconds: Number(e.target.value) })
                  }
                />
              </label>
            </div>

            <label className="full-width-label">
              Enunciado de la pregunta:
              <textarea
                rows={3}
                value={editing.prompt}
                onChange={(e) => setEditing({ ...editing, prompt: e.target.value })}
              />
            </label>

            <div className="editor-options-block">
              <strong>Opciones de respuesta (marca cuál es la correcta):</strong>
              {editing.options.map((opt, idx) => (
                <div key={idx} className="editor-opt-row">
                  <input
                    type="radio"
                    name="correctOpt"
                    checked={editing.correctIndices.includes(idx)}
                    onChange={() => setEditing({ ...editing, correctIndices: [idx] })}
                  />
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const nextOpts = [...editing.options];
                      nextOpts[idx] = e.target.value;
                      setEditing({ ...editing, options: nextOpts });
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="editor-form-grid">
              <label>
                Explicación pedagógica (¿Por qué es correcta?):
                <textarea
                  rows={2}
                  value={editing.explanation.whyCorrect}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      explanation: { ...editing.explanation, whyCorrect: e.target.value },
                    })
                  }
                />
              </label>
              <label>
                Referencia Normativa (Ley / Real Decreto):
                <input
                  type="text"
                  value={editing.explanation.legalReference}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      explanation: { ...editing.explanation, legalReference: e.target.value },
                    })
                  }
                />
              </label>
            </div>

            <div className="editor-form-btns">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  saveQuestion(editing);
                  setEditing(null);
                }}
              >
                Guardar Pregunta
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Listado de preguntas */}
        <div className="questions-table-list">
          {filteredQuestions.map((q) => (
            <div
              key={q.id}
              className={`q-bank-item ${!q.active ? 'q-bank-inactive' : ''}`}
            >
              <div className="q-bank-main">
                <div className="q-bank-tags">
                  <span className={`q-chip-diff diff-${q.difficulty}`}>
                    {q.difficulty.toUpperCase()}
                  </span>
                  <span className="q-chip-cat">{PRL_CATEGORY_LABELS[q.category]}</span>
                  {q.collection && <span className="q-chip-col">{q.collection}</span>}
                  <span className="q-chip-pts">
                    {q.points} pts · {q.timeSeconds}s
                  </span>
                </div>
                <h4>{q.title}</h4>
                <p>{q.prompt}</p>
                <small className="q-bank-ref"> Ref: {q.explanation.legalReference}</small>
              </div>

              <div className="q-bank-actions">
                <label className="toggle-active-check">
                  <input
                    type="checkbox"
                    checked={q.active}
                    onChange={() => toggleQuestionActive(q.id)}
                  />
                  <span>{q.active ? 'Activa' : 'Inactiva'}</span>
                </label>
                <button
                  type="button"
                  className="btn-icon-only"
                  title="Editar pregunta"
                  onClick={() => setEditing(q)}
                >
                  <Edit3 size={16} />
                </button>
                <button
                  type="button"
                  className="btn-icon-only"
                  title="Duplicar pregunta"
                  onClick={() => duplicateQuestion(q.id)}
                >
                  <Copy size={16} />
                </button>
                <button
                  type="button"
                  className="btn-icon-only danger"
                  title="Eliminar pregunta"
                  onClick={() => deleteQuestion(q.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
};
