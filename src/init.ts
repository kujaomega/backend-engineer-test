const {getInitialBalance} = require("./service.ts");

const {createTransactionsTable, getTransactionsOrderByIdLimitOffset} = require("./transaction/database.ts")
const {createBlocksTable} = require("./block/database.ts")

const fastifyPlugin = require('fastify-plugin')
const {Pool} = require("pg")


async function createTables(pool: typeof Pool) {
    await createTransactionsTable(pool)
    await createBlocksTable(pool)
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
         await createTables(pool)
        const balance = await getInitialBalance(pool)
        console.log("db connected succesfully")
        fastify.decorate('db', {pool})
        fastify.decorate('balance', {balance})
    } catch (err) {
        console.error(err)
    }
}

module.exports = fastifyPlugin(dbconnector)