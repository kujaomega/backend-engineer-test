import type {Pool} from "pg";
import type {Block} from "../models.ts";

const format = require('pg-format');

async function getTransactionsOrderByIdLimitOffset(pool: Pool, limit: number, offset: number) {
    return await pool.query(`SELECT *
                             FROM transactions
                             ORDER BY id ASC LIMIT ($1)
                             OFFSET ($2);`, [limit, offset])
}

async function getTransactionsWhereIdEquals(pool: Pool, transactionId: string) {
    return await pool.query(`SELECT *
                             FROM transactions
                             WHERE id = ($1);`, [transactionId]);
}

async function createTransactionsTable(pool: Pool) {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS transactions
        (
            id
            TEXT
            PRIMARY
            KEY,
            inputs
            JSONB,
            outputs
            JSONB
        );
    `);
}

async function insertTransactions(pool: Pool, block: Block) {
    const transactions: any[] = []

    block.transactions.forEach((transaction) => {
        transactions.push([transaction.id, JSON.stringify(transaction.inputs), JSON.stringify(transaction.outputs)])
    })
    await pool.query(format('INSERT INTO transactions (id, inputs, outputs) VALUES %L;', transactions), [])
}

async function deleteTransactionsWhereIdsEqual(pool: Pool, ids: string[]) {
    const query = format('DELETE FROM transactions WHERE id in (%L);', ids)
    console.log(query)
    await pool.query(query, []);
}

export {
    insertTransactions,
    createTransactionsTable,
    getTransactionsOrderByIdLimitOffset,
    getTransactionsWhereIdEquals,
    deleteTransactionsWhereIdsEqual
}