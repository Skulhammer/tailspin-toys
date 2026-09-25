import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllCategories,
    getAllGames,
    getAllGameIds,
    getGameById,
    getAllPublishers,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

/** Seed a varied catalog fixture for category and publisher filter tests. */
async function seedFilterGames(db: Database): Promise<{
    actionId: number;
    puzzleId: number;
    strategyId: number;
    codeForgeId: number;
    devMastersId: number;
}> {
    const [action, puzzle, strategy] = await db
        .insert(categories)
        .values([
            { name: 'Action', description: 'cat' },
            { name: 'Puzzle', description: 'cat' },
            { name: 'Strategy', description: 'cat' },
        ])
        .returning({ id: categories.id, name: categories.name });
    const [codeForge, devMasters] = await db
        .insert(publishers)
        .values([
            { name: 'CodeForge', description: 'pub' },
            { name: 'DevMasters', description: 'pub' },
        ])
        .returning({ id: publishers.id, name: publishers.name });

    await db.insert(games).values([
        {
            title: 'Alpha Action',
            description: 'Description',
            starRating: 4.2,
            categoryId: action.id,
            publisherId: codeForge.id,
        },
        {
            title: 'Bravo Puzzle',
            description: 'Description',
            starRating: 4.2,
            categoryId: puzzle.id,
            publisherId: devMasters.id,
        },
        {
            title: 'Charlie Strategy',
            description: 'Description',
            starRating: 4.2,
            categoryId: strategy.id,
            publisherId: codeForge.id,
        },
    ]);

    return {
        actionId: action.id,
        puzzleId: puzzle.id,
        strategyId: strategy.id,
        codeForgeId: codeForge.id,
        devMastersId: devMasters.id,
    };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('filters games by any selected category and publisher', async () => {
        const filters = await seedFilterGames(db);

        const categoryMatches = await getAllGames(db, {
            categoryIds: [filters.strategyId, filters.actionId],
        });
        const publisherMatches = await getAllGames(db, {
            publisherId: filters.codeForgeId,
        });
        const combinedMatches = await getAllGames(db, {
            categoryIds: [filters.puzzleId, filters.strategyId],
            publisherId: filters.codeForgeId,
        });

        expect(categoryMatches.map((game) => game.title)).toEqual([
            'Alpha Action',
            'Charlie Strategy',
        ]);
        expect(publisherMatches.map((game) => game.title)).toEqual([
            'Alpha Action',
            'Charlie Strategy',
        ]);
        expect(combinedMatches.map((game) => game.title)).toEqual(['Charlie Strategy']);
    });

    it('returns empty results when filters do not match a game', async () => {
        const filters = await seedFilterGames(db);

        await expect(
            getAllGames(db, {
                categoryIds: [filters.actionId],
                publisherId: filters.devMastersId,
            }),
        ).resolves.toEqual([]);
    });

    it('returns category and publisher filter options ordered by name', async () => {
        await seedFilterGames(db);

        await expect(getAllCategories(db)).resolves.toEqual([
            { id: expect.any(Number), name: 'Action' },
            { id: expect.any(Number), name: 'Puzzle' },
            { id: expect.any(Number), name: 'Strategy' },
        ]);
        await expect(getAllPublishers(db)).resolves.toEqual([
            { id: expect.any(Number), name: 'CodeForge' },
            { id: expect.any(Number), name: 'DevMasters' },
        ]);
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
