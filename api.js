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
const blockTimeCache = new Cacher('./db/blocks', getBlockTime);

module.exports.getContractMetadata = async function (address) {
  const abi = (await contractABICache.get(address)).abi;
  return {
    address,
    // abi,
    variables: extractVariables(abi)
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
  return web3.eth.contract(abi).at(address);
}

async function getVariableHistory({address, variable}) {
  const contract = await (contractABICache.get(address));

  console.log('From block: 0');

  const startTime = new Date().getTime();
  const events = await promisify(web3.trace.filter, web3.trace)({"toAddress": [address]});


  console.log('Fetched in : ' + (new Date().getTime() - startTime));
  console.log('Browsing through ' + events.length + ' transactions');

  var history = [];
  var i = 0;
  var prevTime = 0;
  for (let event of events) {
    console.log(event)
    const time = await blockTimeCache.get(event.blockNumber);
    if (time === prevTime) continue;
    prevTime = time;
    const val = await promisify(contract[variable], contract)(event.blockNumber);
    history.push({time, val});
    console.log('Fetched: ' + i++ + ' time: ' + time + ' val: ' + val);
  }
  history.sort((a, b) => a[0] - b[0]);
  return Promise.resolve(history);
};

async function getBlockTime(blockNumber) {
  const block = await promisify(web3.eth.getBlock, web3.eth)(blockNumber);
  return block.timestamp * 1000;
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