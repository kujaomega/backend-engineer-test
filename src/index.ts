import Fastify from 'fastify';
import type {Block} from './models';

const fastify = Fastify({logger: true});
const dbconnector = require('./init.ts')

const {getBalance} = require("./balance/service.ts")
const {storeBlock, rollback} = require("./service.ts")


fastify.register(dbconnector)

let balance = {}

fastify.post('/blocks', async (request, reply) => {
    const block = request.body as Block;
    const {balance} = fastify.balance;
    const {pool} = fastify.db;
    await storeBlock(block, pool, balance)

    return {result: 'ok'};
});

fastify.get('/balance/:address', async (request, reply) => {
    const address = request.params.address
    const {balance} = fastify.balance;
    return await getBalance(address, balance)
});

const queryStringJsonSchema = {
    type: 'object',
    properties: {
        height: {type: 'number'}
    }
}

const schema = {
    querystring: queryStringJsonSchema
}

fastify.post('/rollback', {schema}, async (request, reply) => {
    const {pool} = fastify.db;
    const {balance} = fastify.balance;
    if (request.query.height !== undefined) {
        await rollback(request.query.height, pool, balance)
    }

    return {result: 'ok'}
});

try {
    await fastify.listen({
        port: 3000,
        host: '0.0.0.0'
    })
} catch (err) {
    fastify.log.error(err)
    process.exit(1)
}