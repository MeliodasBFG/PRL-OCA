import {
  INITIAL_QUESTION_BANK,
  MatchHistoryRecord,
  QuestionItem,
} from '@prl-oca/shared';

// In-memory fallback when Cloudflare D1 is not bound or during local standalone development
let memoryQuestions: QuestionItem[] = [...INITIAL_QUESTION_BANK];
let memoryHistory: MatchHistoryRecord[] = [];

export class DatabaseService {
  constructor(private readonly d1?: D1Database) {}

  public async getQuestions(): Promise<QuestionItem[]> {
    if (!this.d1) {
      return memoryQuestions;
    }
    try {
      const { results } = await this.d1
        .prepare('SELECT * FROM questions ORDER BY created_at ASC')
        .all();
      if (!results || results.length === 0) {
        return memoryQuestions;
      }
      return results.map((row: Record<string, unknown>) => ({
        id: String(row.id),
        title: String(row.title),
        prompt: String(row.prompt),
        category: String(row.category) as QuestionItem['category'],
        difficulty: String(row.difficulty) as QuestionItem['difficulty'],
        type: String(row.type) as QuestionItem['type'],
        options: JSON.parse(String(row.options_json)),
        correctIndices: JSON.parse(String(row.correct_indices_json)),
        explanation: JSON.parse(String(row.explanation_json)),
        points: Number(row.points),
        timeSeconds: Number(row.time_seconds),
        collection: row.collection ? String(row.collection) : undefined,
        active: Boolean(row.active),
      }));
    } catch {
      return memoryQuestions;
    }
  }

  public async saveQuestion(item: QuestionItem): Promise<void> {
    const idx = memoryQuestions.findIndex((q) => q.id === item.id);
    if (idx >= 0) {
      memoryQuestions[idx] = item;
    } else {
      memoryQuestions.push(item);
    }

    if (!this.d1) return;
    try {
      const now = Date.now();
      await this.d1
        .prepare(
          `INSERT INTO questions (
            id, title, prompt, category, difficulty, type,
            options_json, correct_indices_json, explanation_json,
            points, time_seconds, collection, active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            prompt = excluded.prompt,
            category = excluded.category,
            difficulty = excluded.difficulty,
            type = excluded.type,
            options_json = excluded.options_json,
            correct_indices_json = excluded.correct_indices_json,
            explanation_json = excluded.explanation_json,
            points = excluded.points,
            time_seconds = excluded.time_seconds,
            collection = excluded.collection,
            active = excluded.active,
            updated_at = excluded.updated_at`
        )
        .bind(
          item.id,
          item.title,
          item.prompt,
          item.category,
          item.difficulty,
          item.type,
          JSON.stringify(item.options),
          JSON.stringify(item.correctIndices),
          JSON.stringify(item.explanation),
          item.points,
          item.timeSeconds,
          item.collection ?? 'General',
          item.active ? 1 : 0,
          now,
          now
        )
        .run();
    } catch {
      // Fallback already updated in memoryQuestions
    }
  }

  public async getMatchHistory(): Promise<MatchHistoryRecord[]> {
    if (!this.d1) {
      return memoryHistory;
    }
    try {
      const { results } = await this.d1
        .prepare('SELECT * FROM match_history ORDER BY finished_at DESC LIMIT 50')
        .all();
      if (!results || results.length === 0) {
        return memoryHistory;
      }
      return results.map((row: Record<string, unknown>) => ({
        id: String(row.id),
        roomCode: String(row.room_code),
        roomName: String(row.room_name),
        finishedAt: Number(row.finished_at),
        mode: String(row.mode) as MatchHistoryRecord['mode'],
        winnerTeamName: String(row.winner_team_name),
        winnerColor: String(row.winner_color),
        winnerScore: Number(row.winner_score),
        totalTurns: Number(row.total_turns),
        totalQuestions: Number(row.total_questions),
        overallAccuracy: Number(row.overall_accuracy),
        teamsSummary: JSON.parse(String(row.teams_summary_json)),
        masteredCategories: JSON.parse(String(row.mastered_categories_json)),
        reinforceCategories: JSON.parse(String(row.reinforce_categories_json)),
      }));
    } catch {
      return memoryHistory;
    }
  }

  public async saveMatchHistory(record: MatchHistoryRecord): Promise<void> {
    memoryHistory.unshift(record);
    memoryHistory = memoryHistory.slice(0, 50);

    if (!this.d1) return;
    try {
      await this.d1
        .prepare(
          `INSERT INTO match_history (
            id, room_code, room_name, finished_at, mode,
            winner_team_name, winner_color, winner_score,
            total_turns, total_questions, overall_accuracy,
            teams_summary_json, mastered_categories_json, reinforce_categories_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          record.id,
          record.roomCode,
          record.roomName,
          record.finishedAt,
          record.mode,
          record.winnerTeamName,
          record.winnerColor,
          record.winnerScore,
          record.totalTurns,
          record.totalQuestions,
          record.overallAccuracy,
          JSON.stringify(record.teamsSummary),
          JSON.stringify(record.masteredCategories),
          JSON.stringify(record.reinforceCategories)
        )
        .run();
    } catch {
      // Stored in memoryHistory fallback
    }
  }
}
