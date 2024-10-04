import {expect, test} from "bun:test";

import {exportedForTesting} from "../src/service.ts"
import {exportedForTesting as balanceExportForTesting} from "../src/balance/service.ts";

const {BadRequest} = require("http-errors")
const helpers = require('./helpers.ts')
// import {Pool} from "pg";

test('Test validate first block', async () => {
    expect(await exportedForTesting.validateFirstBlock(helpers.firstBlockRightFormat))
})

test('Test validate wrong first block', async () => {
    expect(async () => await exportedForTesting.validateFirstBlock(helpers.secondBlockRightFormat)).toThrow(new BadRequest("It's not the first block"))
})

test('Test block hash', async () => {
    expect(await exportedForTesting.createBlockHash(helpers.firstBlockRightFormat)).toBe(helpers.firstBlockRightFormat.id)
})

test('Test hash throw error', async () => {
    expect(async () => await exportedForTesting.validateBlockId(helpers.firstBlockBadId)).toThrow(new BadRequest("Block id doesn't have a valid hash"))
})

test('Test valid inputs and outputs', async () => {
    const pool = helpers.mockedValidInputsOutputsPool()
    const result = exportedForTesting.validateInputsOutputs(pool, helpers.secondBlockRightFormat)
    expect(await result)
})

test('Test invalid inputs and outputs', async () => {
    const pool = helpers.mockedInvalidInputsOutputsPool()
    expect(async () => exportedForTesting.validateInputsOutputs(pool, helpers.secondBlockRightFormat)).toThrow(new BadRequest("Inputs and Outputs doesn't match"))
})

test('Test right block height', async () => {
    expect(await exportedForTesting.validateBlockHeight(helpers.firstBlockRightFormat, helpers.secondBlockRightFormat))
})

test('Test wrong block height', async () => {
    expect(async () =>await exportedForTesting.validateBlockHeight(helpers.firstBlockRightFormat, helpers.thirdBlockRightFormat)).toThrow(new BadRequest("Wrong block height"))
})


// test('Test get balance', async () => {
//     expect(await balanceExportForTesting.getBalance("addr1", new Map([["addr1", 3]]))).toBe(3)
// })