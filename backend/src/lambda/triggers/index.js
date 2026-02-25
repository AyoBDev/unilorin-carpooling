/**
 * Lambda Triggers Barrel Export
 * University of Ilorin Carpooling Platform
 *
 * Path: src/lambda/triggers/index.js
 */

'use strict';

module.exports = {
  dynamodbStream: require('./dynamodb.trigger'),
  sqsNotification: require('./sqs.trigger'),
};
