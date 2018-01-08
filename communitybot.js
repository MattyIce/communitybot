var fs = require("fs");
const steem = require('steem');
var utils = require('./utils');

var account = null;
var last_trans = 0;
var delegators = [];
var members = [];
var config = null;
var first_load = true;
var use_delegators = false;
var version = '1.0.0';

steem.api.setOptions({ url: 'https://api.steemit.com' });

utils.log("* START - Version: " + version + " *");

// Load the settings from the config file
config = JSON.parse(fs.readFileSync("config.json"));

// Check whether delegation is necessary for membership.
use_delegators = config.membership && config.membership.delegation_vests > 0;

// If so then we need to load the list of delegators to the account
if (use_delegators) {
  var del = require('./delegators');
  del.loadDelegations(config.account, function (d) {
    delegators = d;
    var vests = delegators.reduce(function (total, v) { return total + parseFloat(v.vesting_shares); }, 0);
    utils.log('Delegators Loaded - ' + delegators.length + ' delegators and ' + vests + ' VESTS in total!');
  });
}

// Check if bot state has been saved to disk, in which case load it
if (fs.existsSync('state.json')) {
  var state = JSON.parse(fs.readFileSync("state.json"));

  if (state.last_trans)
    last_trans = state.last_trans;

  if (state.members)
    members = state.members;

  utils.log('Restored saved bot state: ' + JSON.stringify({ last_trans: last_trans }));
}

// Schedule to run every 10 seconds
setInterval(startProcess, 5000);

function startProcess() {
  // Load the settings from the config file each time so we can pick up any changes
  config = JSON.parse(fs.readFileSync("config.json"));

  // Load the bot account info
  steem.api.getAccounts([config.account], function (err, result) {
    if (err || !result)
      console.log(err, result);
    else {
      account = result[0];

      // Check if there are any rewards to claim.
      claimRewards();
    }
  });

  if (account) {
    // Load the current voting power of the account
    var vp = utils.getVotingPower(account);

    if (config.detailed_logging)
      utils.log('Voting Power: ' + utils.format(vp / 100) + '% | Time until next vote: ' + utils.toTimer(utils.timeTilFullPower(vp)));

    // We are at 100% voting power - time to vote!
    if (vp >= 10000) {
      // TODO: Send the next vote here
    }

    getTransactions();

    // Save the state of the bot to disk.
    saveState();
  }
}

function getTransactions() {
  var num_trans = 50;

  // If this is the first time the bot is ever being run, start with just the most recent transaction
  if (first_load && last_trans == 0) {
    utils.log('First run - starting with last transaction on account.');
    num_trans = 1;
  }

  // If this is the first time the bot is run after a restart get a larger list of transactions to make sure none are missed
  if (first_load && last_trans > 0) {
    utils.log('First run - loading all transactions since bot was stopped.');
    num_trans = 1000;
  }

  steem.api.getAccountHistory(account.name, -1, num_trans, function (err, result) {
    first_load = false;

    if (err || !result) {
      utils.log(err, result);
      return;
    }

    result.forEach(function (trans) {
      var op = trans[1].op;

      // Check that this is a new transaction that we haven't processed already
      if (trans[0] > last_trans) {

        // We only care about transfers to the bot
        if (op[0] == 'transfer' && op[1].to == account.name) {
          var amount = parseFloat(op[1].amount);
          var currency = utils.getCurrency(op[1].amount);
          utils.log("Incoming Payment! From: " + op[1].from + ", Amount: " + op[1].amount + ", memo: " + op[1].memo);

          // Update membership info
          updateMember(op[1].from, amount);

        } else if (use_delegators && op[0] == 'delegate_vesting_shares' && op[1].delegatee == account.name) {
          // If we are paying out to delegators, then update the list of delegators when new delegation transactions come in
          var delegator = delegators.find(d => d.delegator == op[1].delegator);

          if (delegator)
            delegator.vesting_shares = op[1].vesting_shares;
          else
            delegators.push({ delegator: op[1].delegator, vesting_shares: op[1].vesting_shares });

          utils.log('*** Delegation Update - ' + op[1].delegator + ' has delegated ' + op[1].vesting_shares);
        }

        // Save the ID of the last transaction that was processed.
        last_trans = trans[0];
      }
    });
  });
}

function updateMember(name, payment) {
  var member = members.find(m => m.name == name);

  // Add a new member if none is found
  if (!member) {
    member = { name: name, valid_thru: null };
    members.push(member);
    utils.log('Added new member: ' + name);
  }

  // Check if the account has delegated to the community bot.
  var is_delegator = (delegators.find(d => d.delegator == name && parseFloat(d.vesting_shares) >= config.membership.delegation_vests) != null);

  // Get the date that the membership is currently valid through.
  var valid_thru = new Date(Math.max(new Date(member.valid_thru), new Date(config.membership.start_date)));

  // Get the dues amount based on whether or not they are a delegator
  var dues = (config.membership.dues_steem_no_delegation == 0 || is_delegator) ? config.membership.dues_steem : config.membership.dues_steem_no_delegation;

  // Calculate how much longer they have paid for.
  var extension = payment / dues * config.membership.membership_period_days * 24 * 60 * 60 * 1000;

  // Update their membership record.
  member.valid_thru = new Date(valid_thru.valueOf() + extension).toISOString();

  utils.log('Member ' + name + ' valid through: ' + member.valid_thru);

  saveState();
}

function saveState() {
  var state = {
    last_trans: last_trans,
    members: members
  };

  // Save the state of the bot to disk
  fs.writeFile('state.json', JSON.stringify(state), function (err) {
    if (err)
      utils.log(err);
  });
}

function claimRewards() {
  if (!config.auto_claim_rewards)
    return;

  // Make api call only if you have actual reward
  if (parseFloat(account.reward_steem_balance) > 0 || parseFloat(account.reward_sbd_balance) > 0 || parseFloat(account.reward_vesting_balance) > 0) {
    steem.broadcast.claimRewardBalance(config.posting_key, config.account, account.reward_steem_balance, account.reward_sbd_balance, account.reward_vesting_balance, function (err, result) {
      if (err) {
        utils.log(err);
      }

      if (result) {

        var rewards_message = "$$$ ==> Rewards Claim";
        if (parseFloat(account.reward_sbd_balance) > 0) { rewards_message = rewards_message + ' SBD: ' + parseFloat(account.reward_sbd_balance); }
        if (parseFloat(account.reward_steem_balance) > 0) { rewards_message = rewards_message + ' STEEM: ' + parseFloat(account.reward_steem_balance); }
        if (parseFloat(account.reward_vesting_balance) > 0) { rewards_message = rewards_message + ' VESTS: ' + parseFloat(account.reward_vesting_balance); }

        utils.log(rewards_message);

        // If there are liquid post rewards, withdraw them to the specified account
        if (parseFloat(account.reward_sbd_balance) > 0 && config.post_rewards_withdrawal_account && config.post_rewards_withdrawal_account != '') {

          // Send liquid post rewards to the specified account
          steem.broadcast.transfer(config.active_key, config.account, config.post_rewards_withdrawal_account, account.reward_sbd_balance, 'Liquid Post Rewards Withdrawal', function (err, response) {
            if (err)
              utils.log(err, response);
            else {
              utils.log('$$$ Auto withdrawal - liquid post rewards: ' + account.reward_sbd_balance + ' sent to @' + config.post_rewards_withdrawal_account);
            }
          });
        }
      }
    });
  }
}