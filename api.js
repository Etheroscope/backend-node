const axios = require('axios');
const fs = require('fs');
const Web3 = require('web3');
const promisify = require('es6-promisify')

const config = require('./config');
const Cacher = require('./cacher');

const web3 = new Web3(new Web3.providers.HttpProvider(config.parityURL));

const contractABICache = new Cacher('./db/contracts/', getContractABI);
const historyCache = new Cacher('./db/history', getVariableHistory,
  ({address, variable}) => address + '/' + variable);
const blockTimeCache = new Cacher('./db/blocks', getBlockTime,
  x => Math.round(x / 1000) * 1000);

module.exports.getContractMetadata = async function (address) {
  const abiJSON = await (contractABICache.get(address));
  const contract =  web3.eth.contract(abiJSON).at(address);
  return {
    address,
    abi: contract.abi,
    variables: extractVariables(contract.abi)
  };
}

module.exports.getVariableHistory = function (address, variable) {
  return historyCache.get({address, variable});
};

async function getContractABI(address) {
  const url = 'https://api.etherscan.io/api?module=contract&action=getabi'
   + '&address='+ address  + '&apikey=' + config.etherscan_api_key;
  const response = await axios.get(url);
  const abi = JSON.parse(response.data.result);
  return abi;
}

async function getVariableHistory({address, variable}) {
  console.time('Whole history');

  console.time('Contract retrieval');
  const abiJSON = await (contractABICache.get(address));
  const contract =  web3.eth.contract(abiJSON).at(address);
  console.timeEnd('Contract retrieval');

  const startBlock = web3.eth.blockNumber - 75000;
  console.log('From block:', startBlock);

  console.log('Sending trace filter request');
  console.time('Trace filter request');
  const events = await promisify(web3.trace.filter, web3.trace)({
    "fromBlock": "0x" + startBlock.toString(16),
    "toAddress": [address]
  });
  console.timeEnd('Trace filter request');

  console.log('Browsing through ' + events.length + ' transactions');

  var history = [];
  var i = 0;
  await Promise.all(events.map(async event => {
    const id = Math.random().toString().slice(2);
    console.log('Requesting block time for block', event.blockNumber);
    console.time('Block time retrieval ' + event.blockNumber + ' #' + id);
    const time = await blockTimeCache.get(event.blockNumber);
    console.timeEnd('Block time retrieval ' + event.blockNumber + ' #' + id);

    console.time('Contract querying ' + event.blockNumber + ' #' + id);
    const val = await promisify(contract[variable], contract)(event.blockNumber);
    console.timeEnd('Contract querying ' + event.blockNumber + ' #' + id);

    history.push({time, val});
    console.log(`Fetched: ${i++} values`);
  }));
  history.sort((a, b) => a[0] - b[0]);

  console.timeEnd('Whole history');
  return history;
};

async function getBlockTime(blockNumber) {
  const block = await promisify(web3.eth.getBlock, web3.eth)(blockNumber);
  return block.timestamp;
};

function isVar(item) {
  return item.outputs && item.outputs.length === 1
    && item.outputs[0].type.slice(0, 4) === 'uint' && item.inputs.length === 0;
}

function extractVariables(abi) {
  const isVar = item => item.outputs && item.outputs.length === 1
   && item.inputs.length === 0 && item.outputs[0].type.match(/u?int/) !== null;
  return abi.filter(isVar).map(item => item.name);
}