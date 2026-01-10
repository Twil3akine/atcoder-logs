import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const problems = sqliteTable('problems', {
	id: text('id').primaryKey(),
	title: text('title').notNull(),
	contestId: text('contest_id').notNull(),
	difficulty: integer('difficulty')
});

export const myNotes = sqliteTable('my_notes', {
	problemId: text('problem_id')
		.primaryKey()
		.references(() => problems.id),
	content: text('content').notNull(),
	hasSolution: integer('has_solution', { mode: 'boolean' }).notNull().default(false),
	hasExplanation: integer('has_explanation', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});
