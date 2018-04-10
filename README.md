# Community Bot - Voting bot for communities on Steem!

This is a voting bot for communities on the Steem platform. Members of the community can all chip in to power up the bot which will then go through the list of members and upvote the latest post by each. 

## Installation
```
$ git clone https://github.com/MattyIce/communitybot.git
$ npm install
```

## Configuration
First rename config-example.json to config.json:
```
$ mv config-example.json config.json
```

Then set the following options in config.json:
```
{
  "disabled_mode": false,
  "detailed_logging": false,
  "account": "bot_account_name",
  "memo_key": "your_private_memo_key",
  "posting_key": "your_private_posting_key",
  "active_key": "your_private_active_key",
  "auto_claim_rewards" : true,
  "post_rewards_withdrawal_account": null,
  "vote_weight": 10000,
	"whitelist_only": true,
	"whitelist_location": "whitelist.txt",
	"comment_location": "comment.md",
	"resteem": true,
	"flag_signal_accounts": ["spaminator", "cheetah", "steemcleaners", "mack-bot"],
	"blacklisted_tags": ["nsfw"],
  "api": {
    "enabled": true,
    "port": 3100
  },
  "membership": {
    "start_date": "2/20/2018",  // Date when membership starts
    "membership_period_days": 30, // The length of time for which the dues pay
    "delegation_vests": 60000,  // Min amount of delegation required for membership
    "full_delegation_vests": 120000,  // Min amount of delegation required for membership with no dues
    "dues_steem": 1,  // Dues required if delegation is less than "full_delegation_vests"
    "dues_steem_no_delegation": 2 // Dues required of delegation is less than "delegation_vests"
  },
	"transfer_memos": {
		"whitelist_only": "This bot is for community members only. Please contact the community leaders to get added to the whitelist in order to join.",
		"member_valid_thru": "Membership updated for @{to}. Membership valid through: {tag}.",
		"member_full_delegation": "Membership updated for @{to}. Full amount delegated, membership is valid indefinitely while delegation remains."
	}
}
```
## Run
```
$ nodejs communitybot.js
```

This will run the process in the foreground which is not recommended. We recommend using a tool such as [PM2](http://pm2.keymetrics.io/) to run the process in the background as well as providing many other great features.

## API Setup
If you would like to use the API functionality set the "api.enabled" setting to "true" and choose a port. You can test if it is working locally by running:

```
$ curl http://localhost:port/api/members
```

If that returns a JSON object with a list of members then it is working.

It is recommended to set up an nginx reverse proxy server (or something similar) to forward requests on port 80 to the communitybot nodejs server. For instructions on how to do that please see: https://medium.com/@utkarsh_verma/configure-nginx-as-a-web-server-and-reverse-proxy-for-nodejs-application-on-aws-ubuntu-16-04-server-872922e21d38
