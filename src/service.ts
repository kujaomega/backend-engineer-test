import {Pool} from 'pg';
import type {Block} from './models';
import type {Transaction} from "./models";
import {
    deleteBlocksWhereHeightsEqual,
    getBlocksHeightGreaterThan,
    getLastBlock,
    insertBlock
} from "./block/database.ts";
import {getTransactionsOrderByIdLimitOffset} from "./transaction/database.ts";

const {BadRequest} = require("http-errors")
const {createHash} = require('crypto');

const {
    getTransactionsWhereIdEquals,
    insertTransactions,
    deleteTransactionsWhereIdsEqual
} = require("./transaction/database.ts")

async function rollback(height: number, pool: Pool, balance: Map<string, number>) {
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

async function storeBlock(block: Block, pool: Pool, balance: Map<string, number>) {
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
    await addBlockBalance(pool, block, balance)
}

async function addBlockBalance(pool: Pool, block: Block, balance: Map<string, number>) {
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
        throw new BadRequest("It's not the first block")
    }
}

async function validateBlockHeight(lastBlock: Block, block: Block) {
    if (block.height - 1 !== lastBlock.height) {
        throw new BadRequest("Wrong block height")
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
            throw new BadRequest("Inputs and Outputs doesn't match")
        }
    }
}

async function getBlockTransaction(pool: Pool, transactionId: string) {
    const rows = await getTransactionsWhereIdEquals(pool, transactionId)
    if (!rows) {
        throw new BadRequest("Transaction doesn't exist")
    }
    return rows.rows[0]
}

async function validateBlockId(block: Block) {
    const blockHash = await createBlockHash(block)
    if (block.id != blockHash) {
        throw new BadRequest("Block id doesn't have a valid hash")
    }
}

async function createBlockHash(block: Block) {
    let transactionIds = ''
    block.transactions.forEach(transaction => transactionIds += transaction.id)
    const hashKey = block.height + transactionIds
    return createHash('sha256').update(hashKey).digest('hex')
}

async function getInitialBalance(pool: typeof Pool) {
    const limit = 20
    let offset = 0
    let resultSize = 20
    const balance: Map<string, number> = new Map()
    const inputsDict: Map<string, Transaction> = new Map()
    while (resultSize === limit) {
        const transactions = await getTransactionsOrderByIdLimitOffset(pool, limit, offset)
        for (const transaction of transactions.rows) {
            inputsDict.set(transaction.id, transaction)
            for (const output of transaction.outputs) {
                if (output.address in balance) {
                    balance.set(output.address, balance.get(output.address) + output.value)
                } else {
                    balance.set(output.address, output.value)
                }
            }
            for (const input of transaction.inputs) {
                const transactionId = input.txId
                const pastTransaction = inputsDict.get(input.txId)
                if (pastTransaction === undefined) {
                    continue
                }
                const outputOrigin = pastTransaction.outputs[input.index]
                const originBalance = balance.get(outputOrigin.address)
                if (originBalance === undefined) {
                    continue
                }
                balance.set(outputOrigin.address, originBalance - outputOrigin.value)
            }
        }
        resultSize = transactions.rows.length
    }
    return balance
}

export {
    storeBlock,
    rollback,
    getInitialBalance
}
export const exportedForTesting = {
    validateBlockHeight,
    validateBlockId,
    createBlockHash,
    validateInputsOutputs,
    validateFirstBlock
}