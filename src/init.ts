import type {Transaction} from "./models.ts";

const {createTransactionsTable, getTransactionsOrderByIdLimitOffset} = require("./transaction/database.ts")
const {createBlocksTable} = require("./block/database.ts")

const fastifyPlugin = require('fastify-plugin')
const {Pool} = require("pg")


async function createTables(pool: typeof Pool) {
    await createTransactionsTable(pool)
    await createBlocksTable(pool)
}

async function bootstrap(pool: typeof Pool) {
    console.log('Bootstrapping...');
    // const databaseUrl = process.env.DATABASE_URL;
    // if (!databaseUrl) {
    //   throw new Error('DATABASE_URL is required');
    // }

    // const pool = new Pool({
    //   connectionString: databaseUrl
    // });

    await createTables(pool);
}

async function dbconnector(fastify, options) {
    try {
        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) {
            throw new Error('DATABASE_URL is required');
        }

        const pool = new Pool({
            connectionString: databaseUrl
        });
        // await client.connect()
        await pool.connect()
        await bootstrap(pool)
        const balance = await getBalance(pool)
        console.log("db connected succesfully")
        fastify.decorate('db', {pool})
        fastify.decorate('balance', {balance})
    } catch (err) {
        console.error(err)
    }
}

async function getBalance(pool: typeof Pool) {
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

module.exports = fastifyPlugin(dbconnector)