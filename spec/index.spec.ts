import {expect, test} from "bun:test";

import {exportedForTesting} from "../src/index.ts"

const {BadRequest} = require("http-errors")
const helpers = require('./helpers.ts')
// import {Pool} from "pg";

test('Test validate first block', async () => {
    expect(await exportedForTesting.validateFirstBlock(helpers.firstBlockRightFormat))
})

test('Test validate wrong first block', async () => {
    expect(async () => await exportedForTesting.validateFirstBlock(helpers.secondBlockRightFormat)).toThrow(new BadRequest())
})

test('Test block hash', async () => {
    expect(await exportedForTesting.createBlockHash(helpers.firstBlockRightFormat)).toBe(helpers.firstBlockRightFormat.id)
})

test('Test hash throw error', async () => {
    expect(async () => await exportedForTesting.validateBlockId(helpers.firstBlockBadId)).toThrow(new BadRequest())
})

test('Test valid inputs and outputs', async () => {
    const pool = helpers.mockedValidInputsOutputsPool()
    const result = exportedForTesting.validateInputsOutputs(pool, helpers.secondBlockRightFormat)
    expect(await result)
})

test('Test invalid inputs and outputs', async () => {
    const pool = helpers.mockedInvalidInputsOutputsPool()
    expect(async () => exportedForTesting.validateInputsOutputs(pool, helpers.secondBlockRightFormat)).toThrow(new BadRequest())
})