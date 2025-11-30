# Roblox Group Ranking Bot

A self-hosted API for automating Roblox group ranking operations. Deploy for free on Railway and integrate with your games, Discord bots, or custom applications. Includes a desktop console UI for easy management.

## Quick Start

### 1. Create a Bot Account

1. Create a new Roblox account dedicated to ranking operations
2. Add this account to your group
3. Assign it a role with **"Manage lower-ranked member ranks"** permission
4. Position this role above all roles the bot should be able to assign

**Note:** The bot can only rank users to roles below its own rank.

### 2. Get Your Roblox Cookie

1. Log into the bot account on Roblox
2. Open Developer Tools (F12)
3. Navigate to **Application** > **Cookies** > `https://www.roblox.com`
4. Copy the `.ROBLOSECURITY` cookie value

### 3. Deploy to Railway

1. Fork this repository
2. Create an account at [railway.app](https://railway.app)
3. Create a new project from your forked repository
4. Add the following environment variables:

| Variable | Description |
|----------|-------------|
| `ROBLOX_COOKIE` | Your bot account's .ROBLOSECURITY cookie |
| `GROUP_ID` | Your Roblox group ID (from the group URL) |
| `API_KEY` | A secure random string for API authentication |

5. Generate a domain under **Settings** > **Domains**

### 4. Verify Deployment

Visit `https://your-app.up.railway.app/health` to confirm the bot is running.

## Console UI

A desktop terminal application for managing your ranking bot without writing code.

### Launch

**Windows:**
```batch
launch.bat
```

**macOS/Linux:**
```bash
chmod +x launch.sh
./launch.sh
```

### Features

- Interactive dashboard with live status
- Rank, promote, and demote users
- Search members by username or ID
- View all group roles
- Activity logs with export to CSV
- Multiple color themes
- First-run setup wizard

### Screenshots

```
+------------------------------------------------------------------+
|  RANKBOT CONSOLE                                      v1.0.0     |
+------------------------------------------------------------------+
|                                                                  |
|  Bot: GroupRankBot              Group: My Awesome Group          |
|  Status: Online                 Members: 1,234                   |
|  Uptime: 2h 34m 12s             Roles: 8                         |
|                                                                  |
|  [1] Rank User              [5] View Roles                       |
|  [2] Promote User           [6] Activity Logs                    |
|  [3] Demote User            [7] Settings                         |
|  [4] Search Members         [8] Help                             |
|                                                                  |
|  [Q] Quit                                                        |
|                                                                  |
+------------------------------------------------------------------+
```

## API Overview

All endpoints except `/health` require the `x-api-key` header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server status |
| GET | `/api/rank/:userId` | Get user's rank |
| GET | `/api/user/:username` | Get user by username |
| GET | `/api/roles` | List all group roles |
| GET | `/api/logs` | Get audit logs |
| GET | `/api/stats` | Get statistics |
| POST | `/api/rank` | Set user's rank |
| POST | `/api/rank/username` | Set rank by username |
| POST | `/api/rank/bulk` | Bulk rank operation |
| POST | `/api/promote` | Promote user |
| POST | `/api/promote/username` | Promote by username |
| POST | `/api/demote` | Demote user |
| POST | `/api/demote/username` | Demote by username |

See [API.md](API.md) for complete endpoint documentation and examples.

## In-Game Integration

1. Enable HTTP Requests in Game Settings > Security
2. Add the script from `roblox-game/RankingScript.lua` to ServerScriptService
3. Configure the `API_URL` and `API_KEY` in the script

```lua
local RankingAPI = require(game.ServerScriptService.RankingAPI)

local result = RankingAPI:SetPlayerRankByName(player, "Member")
if result.success then
    print("Ranked successfully")
end
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ROBLOX_COOKIE` | Yes | - | Bot account's .ROBLOSECURITY cookie |
| `GROUP_ID` | Yes | - | Target Roblox group ID |
| `API_KEY` | Yes | - | API authentication key |
| `PORT` | No | 3000 | Server port |
| `RATE_LIMIT_MAX` | No | 30 | Max requests per 15 minutes |
| `MIN_RANK` | No | 1 | Minimum assignable rank |
| `MAX_RANK` | No | 255 | Maximum assignable rank |
| `WEBHOOK_URL` | No | - | Discord webhook for notifications |

## Webhook Notifications

Set the `WEBHOOK_URL` environment variable to receive Discord notifications for:
- Rank changes
- Promotions
- Demotions

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Authentication failed | Cookie expired. Get a new one and update the environment variable. |
| User not in group | The target user must be a group member before ranking. |
| Cannot set rank | Ensure the target rank is below the bot's rank. |
| Rate limit exceeded | Wait 15 minutes or increase `RATE_LIMIT_MAX`. |
| HTTP Requests disabled | Enable in Roblox Studio: Game Settings > Security. |

## Security

- Use a dedicated Roblox account for the bot
- Never commit credentials to version control
- Store sensitive values in environment variables
- Regularly rotate your API key
- Monitor Railway logs for unusual activity

## License

MIT
