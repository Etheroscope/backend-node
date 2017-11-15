const express = require('express');
const logger = require('morgan');

const ContractAPI = require('./api');

const app = express();
app.use(logger('dev'));

// Enable CORS
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get('/contracts/:address', function (req, res, next) {
  ContractAPI.getContractMetadata(req.params.address)
    .then(contract => res.json(contract))
    .catch(err => next(err));
});

app.get('/contracts/:address/history/', function (req, res, next) {
  ContractAPI.getVariableHistory(req.params.address, req.query.variable)
    .then(variableHistory => res.json(variableHistory))
    .catch(err => next(err));
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // Render the error page
  res.status(err.status || 500);
  console.error(err);
  res.json({
    message: err.message,
    error: err
  });
});

module.exports = app;

process.on('unhandledRejection', error => {
  // Will print "unhandledRejection err is not defined"
  console.log('unhandledRejection:', error);
});