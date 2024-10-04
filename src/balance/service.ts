import Fastify from "fastify";

const fastify = Fastify({logger: true});

async function getBalance(address: string, balance: Map<string, number>) {
    if (!balance.has(address)) {
        return {[address]: 0}
    }
    const addressBalance = balance.get(address)
    // return Object.fromEntries(balance);
    return {[address]: addressBalance}
}

export {
    getBalance
}

export const exportedForTesting = {
    getBalance
}