import Fastify from 'fastify';
import {Pool} from 'pg';
import type {Block} from '../models';
import {deleteBlocksWhereHeightsEqual, getBlocksHeightGreaterThan, getLastBlock, insertBlock} from "./database.ts";


const fastify = Fastify({logger: true});
const dbconnector = require('./init.ts')
const {BadRequest} = require("http-errors")
const {createHash} = require('crypto');

const {
    getTransactionsWhereIdEquals,
    insertTransactions,
    deleteTransactionsWhereIdsEqual
} = require("./transaction/database.ts")

const {getBalance} = require("./balance/service.ts")


fastify.register(dbconnector)

let balance = {}

async function rollback(height: number) {
    const {pool} = fastify.db;
    const {balance} = fastify.balance;
    const rows = await getBlocksHeightGreaterThan(pool, height)
    const blocksToDelete = []
    const transactionsToDelete = []

    for (const block of rows.rows) {
        blocksToDelete.push(block.height)
        for (const transactionId of block.transactions) {
            const transaction = await getBlockTransaction(pool, transactionId)
            transactionsToDelete.push(transaction.id)
            for (const output of transaction.outputs) {
                if (balance.has(output.address)) {
                    balance.set(output.address, balance.get(output.address) - output.value)
                }
            }
            for (const input of transaction.inputs) {
                const originTransaction = await getBlockTransaction(pool, input.txId)
                const output = originTransaction.outputs[input.index]
                balance.set(output.address, balance.get(output.address) + output.value)
            }
        }
    }
    await deleteBlocksWhereHeightsEqual(pool, blocksToDelete)
    await deleteTransactionsWhereIdsEqual(pool, transactionsToDelete)
}

async function storeBlock(block: Block) {
    const {pool} = fastify.db;
    // await deleteBlocks(pool)
    // await deleteTransactions(pool)

    const lastBlock = await getLastBlock(pool)
    if (lastBlock === undefined) {
        await validateFirstBlock(block)
        await validateBlockId(block)
    } else {
        await validateBlockHeight(lastBlock, block)
        await validateInputsOutputs(pool, block)
        await validateBlockId(block)
    }
    await insertBlockDb(pool, block)
    await adjustBalance(pool, block)
}

async function adjustBalance(pool: Pool, block: Block) {
    const {balance} = fastify.balance;
    for (const transaction of block.transactions) {
        for (const input of transaction.inputs) {
            const originTransaction = await getBlockTransaction(pool, input.txId)
            const output = originTransaction.outputs[input.index]
            balance.set(output.address, balance.get(output.address) - output.value)
        }
        for (const output of transaction.outputs) {
            if (output.address in balance) {
                balance.set(output.address, balance.get(output.address) + output.value)
            } else {
                console.log("set balance")
                balance.set(output.address, output.value)
            }
        }
    }


}

async function validateFirstBlock(block: Block) {
    if (block.height != 1) {
        throw new BadRequest()
    }
}

async function validateBlockHeight(lastBlock: Block, block: Block) {
    if (block.height - 1 !== lastBlock.height) {
        throw new BadRequest()
    }
}

async function insertBlockDb(pool: Pool, block: Block) {
    await insertBlock(pool, block)
    await insertTransactions(pool, block)
}

async function validateInputsOutputs(pool: Pool, actualBlock: Block) {
    for (const newTransaction of actualBlock.transactions) {
        let inputs = 0
        let outputs = 0
        for (const input of newTransaction.inputs) {
            const transaction = await getBlockTransaction(pool, input.txId)
            const output = transaction.outputs[input.index]
            inputs += output.value
        }
        for (const newOutput of newTransaction.outputs) {
            outputs += newOutput.value
        }
        if (inputs !== outputs) {
            throw new BadRequest()
        }
    }
}

async function getBlockTransaction(pool: Pool, transactionId: string) {
    console.log("get transactionid1", transactionId)
    const rows = await getTransactionsWhereIdEquals(pool, transactionId)
    console.log("get transactionid2", transactionId)
    if (!rows) {
        throw new BadRequest()
    }
    return rows.rows[0]
}

async function validateBlockId(block: Block) {
    const blockHash = await createBlockHash(block)
    console.log('blockHash:', blockHash)
    if (block.id != blockHash) {
        throw new BadRequest()
    }
}

async function createBlockHash(block: Block) {
    let transactionIds = ''
    block.transactions.forEach(transaction => transactionIds += transaction.id)
    const hashKey = block.height + transactionIds
    return createHash('sha256').update(hashKey).digest('hex')
}

export{
    storeBlock
}
export const exportedForTesting = {
    validateBlockId,
    createBlockHash,
    validateInputsOutputs,
    validateFirstBlock
}