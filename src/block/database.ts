import {Pool} from "pg";
import type {Block} from "../models.ts";

const format = require('pg-format');

async function createBlocksTable(pool: Pool) {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS blocks
        (
            id
            TEXT
            NOT
            NULL,
            height
            INTEGER
            NOT
            NULL
            PRIMARY
            KEY,
            transactions
            TEXT[]
        );
    `);
}

async function getBlocksHeightGreaterThan(pool: Pool, height: number) {
    const rows = await pool.query(`SELECT *
                                   FROM blocks
                                   WHERE height > ($1)
                                   ORDER BY height DESC;`, [height]);
    return rows
}

async function insertBlock(pool: Pool, block: Block) {
    const blockId = block.id;
    const blockHeight = block.height;
    const transactionIds: string[] = []

    block.transactions.forEach((transaction) => {
        transactionIds.push(transaction.id)
    })
    await pool.query(`
        INSERT INTO blocks (id, height, transactions)
        VALUES ($1, $2, $3);
    `, [blockId, blockHeight, transactionIds]);
}

async function getLastBlock(pool: Pool) {
    const rows = await pool.query(`SELECT *
                                   FROM blocks
                                   ORDER BY height DESC LIMIT 1;`, []);
    console.log('last block', rows.rows)
    return rows.rows[0]
}

async function deleteBlocksWhereHeightsEqual(pool: Pool, heights: number[]) {
    const query = format('DELETE FROM blocks WHERE height in (%L);', heights)
    console.log("query", query)
    await pool.query(query, []);
}

export {
    insertBlock,
    createBlocksTable,
    getLastBlock,
    getBlocksHeightGreaterThan,
    deleteBlocksWhereHeightsEqual
}