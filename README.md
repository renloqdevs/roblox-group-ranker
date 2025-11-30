# Roblox Group Ranking Bot

A free, self-hosted ranking bot that lets you automatically rank members in your Roblox group through an API. Use it with your Roblox games, Discord bots, or any custom integration.

**Setup Time: ~10 minutes**

---

## Table of Contents

1. [Features](#features)
2. [Prerequisites](#prerequisites)
3. [Step 1: Create a Bot Account](#step-1-create-a-bot-account)
4. [Step 2: Get Your Roblox Cookie](#step-2-get-your-roblox-cookie)
5. [Step 3: Deploy to Railway (Free)](#step-3-deploy-to-railway-free)
6. [Step 4: Configure Environment Variables](#step-4-configure-environment-variables)
7. [Step 5: Test Your Bot](#step-5-test-your-bot)
8. [Step 6: In-Game Setup (Optional)](#step-6-in-game-setup-optional)
9. [API Reference](#api-reference)
10. [Integration Examples](#integration-examples)
11. [Troubleshooting](#troubleshooting)
12. [Security Best Practices](#security-best-practices)

---

## Features

- **Set Rank** - Set any user to a specific rank by number or name
- **Promote** - Promote users by one rank
- **Demote** - Demote users by one rank  
- **Get Rank** - Check a user's current rank
- **List Roles** - Get all roles in your group
- **API Key Protection** - Secure your bot from unauthorized access
- **Rate Limiting** - Built-in protection against abuse
- **Free Hosting** - Deploy on Railway's free tier

---

## Prerequisites

Before you start, you'll need:

- A **Roblox account** to use as the bot (create a new one - don't use your main account)
- A **Roblox Group** where you have admin permissions
- A **GitHub account** (free) - for deploying to Railway
- ~10 minutes of your time

---

## Step 1: Create a Bot Account

The bot needs its own Roblox account to perform ranking operations.

### 1.1 Create a New Roblox Account

1. Go to [roblox.com](https://www.roblox.com)
2. Sign out if you're logged in
3. Create a new account (e.g., "YourGroup_RankBot" or "GroupName_Bot")
4. **Important**: Use a strong, unique password and save it somewhere safe

### 1.2 Add the Bot to Your Group

1. Log into your **main account** (the one that owns/administers the group)
2. Go to your group's page
3. Invite the bot account to join the group
4. Log into the **bot account** and accept the group invite

### 1.3 Give the Bot Ranking Permissions

1. On your **main account**, go to your group's Configure page
2. Go to **Roles** and create a role for the bot (e.g., "Ranking Bot")
3. Set this role's permissions:
   - Enable **"Manage lower-ranked member ranks"**
4. Place this role **above** all the roles the bot should be able to assign
5. Assign the bot account to this role

**Important**: The bot can only rank users to roles that are **below** its own role. It cannot rank itself or anyone at or above its level.

Example role hierarchy:
```
Owner (255)           - Cannot be ranked by bot
Admin (200)           - Cannot be ranked by bot  
Ranking Bot (100)     - This is the bot's role
Moderator (50)        - Bot CAN rank to this
Member (10)           - Bot CAN rank to this
Guest (1)             - Bot CAN rank to this
```

---

## Step 2: Get Your Roblox Cookie

The bot needs your bot account's `.ROBLOSECURITY` cookie to authenticate with Roblox.

### Getting the Cookie (Chrome)

1. Log into the **bot account** on Roblox (NOT your main account!)
2. Press `F12` to open Developer Tools
3. Click the **Application** tab (you may need to click `>>` to see it)
4. In the left sidebar, expand **Cookies** and click `https://www.roblox.com`
5. Find `.ROBLOSECURITY` in the list
6. Double-click the **Value** column to select it
7. Copy the entire value (it starts with `_|WARNING:`)

### Getting the Cookie (Firefox)

1. Log into the **bot account** on Roblox
2. Press `F12` to open Developer Tools
3. Click the **Storage** tab
4. Expand **Cookies** and click `https://www.roblox.com`
5. Find `.ROBLOSECURITY` and copy its value

### Getting the Cookie (Edge)

1. Log into the **bot account** on Roblox
2. Press `F12` to open Developer Tools
3. Click the **Application** tab
4. In the left sidebar, expand **Cookies** and click `https://www.roblox.com`
5. Find `.ROBLOSECURITY` and copy its value

**WARNING**: 
- This cookie gives full access to the account - that's why we use a dedicated bot account!
- NEVER share this cookie with anyone
- The cookie will expire periodically (usually after a few weeks) - you'll need to get a new one when it does

---

## Step 3: Deploy to Railway (Free)

Railway is a free hosting platform that will keep your bot running 24/7.

### 3.1 Fork This Repository

1. Click the **Fork** button at the top of this GitHub page
2. This creates your own copy of the bot

### 3.2 Create a Railway Account

1. Go to [railway.app](https://railway.app)
2. Click **Login** and sign in with your GitHub account
3. Authorize Railway to access your GitHub

### 3.3 Create a New Project

1. In Railway, click **New Project**
2. Select **Deploy from GitHub repo**
3. Find and select your forked repository
4. Railway will automatically detect it's a Node.js project

---

## Step 4: Configure Environment Variables

Now we need to tell the bot your Roblox cookie, group ID, and API key.

### 4.1 Find Your Group ID

Your group ID is in your group's URL:
```
https://www.roblox.com/groups/12345678/YourGroupName
                        ^^^^^^^^
                        This is your Group ID
```

### 4.2 Create an API Key

Create a random, secure string to protect your API. You can:
- Use a password generator
- Go to [randomkeygen.com](https://randomkeygen.com) and use a "256-bit WEP Key"
- Or just mash your keyboard to create something like: `a8Kj2mNx9pQr5tWz`

**Important**: Save this key - you'll need it to make requests to your bot!

### 4.3 Add Variables in Railway

1. In your Railway project, click on your service
2. Go to the **Variables** tab
3. Click **New Variable** and add these:

| Variable Name | Value |
|--------------|-------|
| `ROBLOX_COOKIE` | Your bot account's .ROBLOSECURITY cookie |
| `GROUP_ID` | Your group's ID number |
| `API_KEY` | Your created API key |

4. Railway will automatically redeploy with the new variables

---

## Step 5: Test Your Bot

### 5.1 Get Your Bot's URL

1. In Railway, go to your service's **Settings** tab
2. Under **Domains**, click **Generate Domain**
3. You'll get a URL like: `https://your-app-name.up.railway.app`

### 5.2 Check the Health Endpoint

Open your browser and go to:
```
https://your-app-name.up.railway.app/health
```

You should see something like:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "bot": {
    "username": "YourBotName",
    "userId": 12345678
  }
}
```

If you see this, your bot is running! 

### 5.3 Test the API

You can test the API using curl, Postman, or any HTTP client:

```bash
# Get a user's rank
curl -X GET "https://your-app-name.up.railway.app/api/rank/12345678" \
  -H "x-api-key: your-api-key"

# Get all roles
curl -X GET "https://your-app-name.up.railway.app/api/roles" \
  -H "x-api-key: your-api-key"
```

---

## Step 6: In-Game Setup (Optional)

Use the ranking bot from your Roblox game!

### 6.1 Enable HTTP Requests

1. Open your game in Roblox Studio
2. Go to **Game Settings** > **Security**
3. Enable **"Allow HTTP Requests"**

### 6.2 Add the Script

1. In Roblox Studio, open the **Explorer** panel
2. Right-click on **ServerScriptService**
3. Click **Insert Object** > **ModuleScript**
4. Rename it to `RankingAPI`
5. Copy the contents of `roblox-game/RankingScript.lua` into this script
6. **Edit the CONFIG section** at the top:

```lua
local CONFIG = {
    API_URL = "https://your-app-name.up.railway.app",  -- Your Railway URL
    API_KEY = "your-api-key-here",                      -- Your API key
    DEBUG = false                                        -- Set to true for testing
}
```

### 6.3 Use the API in Your Scripts

Create a new Script in ServerScriptService:

```lua
local RankingAPI = require(game.ServerScriptService.RankingAPI)

-- Example: Rank a player when they touch a part
local rankPart = workspace:WaitForChild("RankPart")

rankPart.Touched:Connect(function(hit)
    local player = game.Players:GetPlayerFromCharacter(hit.Parent)
    if player then
        local result = RankingAPI:SetPlayerRankByName(player, "Member")
        
        if result.success then
            print("Ranked", player.Name, "to Member!")
        else
            warn("Failed:", result.message)
        end
    end
end)
```

---

## API Reference

All endpoints (except `/health`) require the `x-api-key` header.

### Health Check
```
GET /health
```
Returns server status. No authentication required.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "bot": {
    "username": "BotName",
    "userId": 12345678
  }
}
```

---

### Get User's Rank
```
GET /api/rank/:userId
```
Get a user's current rank in the group.

**Headers:**
- `x-api-key`: Your API key

**Response:**
```json
{
  "success": true,
  "userId": 12345678,
  "username": "PlayerName",
  "rank": 10,
  "rankName": "Member",
  "inGroup": true
}
```

---

### Get User by Username
```
GET /api/user/:username
```
Look up a user by their username.

**Headers:**
- `x-api-key`: Your API key

**Response:**
```json
{
  "success": true,
  "userId": 12345678,
  "username": "PlayerName",
  "rank": 10,
  "rankName": "Member",
  "inGroup": true
}
```

---

### Set Rank (by User ID)
```
POST /api/rank
```
Set a user to a specific rank.

**Headers:**
- `x-api-key`: Your API key
- `Content-Type`: application/json

**Body (by rank number):**
```json
{
  "userId": 12345678,
  "rank": 10
}
```

**Body (by role name):**
```json
{
  "userId": 12345678,
  "rankName": "Member"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully changed rank",
  "userId": 12345678,
  "oldRank": 1,
  "oldRankName": "Guest",
  "newRank": 10,
  "newRankName": "Member",
  "changed": true
}
```

---

### Set Rank (by Username)
```
POST /api/rank/username
```
Set a user's rank using their username.

**Body:**
```json
{
  "username": "PlayerName",
  "rankName": "Member"
}
```

---

### Promote User
```
POST /api/promote
```
Promote a user by one rank.

**Body:**
```json
{
  "userId": 12345678
}
```

---

### Promote User (by Username)
```
POST /api/promote/username
```
**Body:**
```json
{
  "username": "PlayerName"
}
```

---

### Demote User
```
POST /api/demote
```
Demote a user by one rank.

**Body:**
```json
{
  "userId": 12345678
}
```

---

### Demote User (by Username)
```
POST /api/demote/username
```
**Body:**
```json
{
  "username": "PlayerName"
}
```

---

### Get All Roles
```
GET /api/roles
```
Get all roles in the group.

**Response:**
```json
{
  "success": true,
  "roles": [
    {
      "rank": 255,
      "name": "Owner",
      "memberCount": 1,
      "canAssign": false
    },
    {
      "rank": 10,
      "name": "Member",
      "memberCount": 50,
      "canAssign": true
    }
  ],
  "count": 5
}
```

---

## Integration Examples

### Discord Bot (discord.js)

```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Rank a user in the Roblox group')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Roblox username')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('role')
                .setDescription('Role name')
                .setRequired(true)),
    
    async execute(interaction) {
        const username = interaction.options.getString('username');
        const role = interaction.options.getString('role');
        
        const response = await fetch('https://your-app.up.railway.app/api/rank/username', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.RANKING_API_KEY
            },
            body: JSON.stringify({
                username: username,
                rankName: role
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            await interaction.reply(`Ranked ${username} to ${result.newRankName}!`);
        } else {
            await interaction.reply(`Failed: ${result.message}`);
        }
    }
};
```

### Python

```python
import requests

API_URL = "https://your-app.up.railway.app"
API_KEY = "your-api-key"

def rank_user(username, role_name):
    response = requests.post(
        f"{API_URL}/api/rank/username",
        headers={
            "Content-Type": "application/json",
            "x-api-key": API_KEY
        },
        json={
            "username": username,
            "rankName": role_name
        }
    )
    return response.json()

# Example usage
result = rank_user("PlayerName", "Member")
if result["success"]:
    print(f"Ranked to {result['newRankName']}")
else:
    print(f"Error: {result['message']}")
```

### cURL

```bash
# Set rank by username
curl -X POST "https://your-app.up.railway.app/api/rank/username" \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"username": "PlayerName", "rankName": "Member"}'

# Promote user
curl -X POST "https://your-app.up.railway.app/api/promote" \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"userId": 12345678}'

# Get user's rank
curl -X GET "https://your-app.up.railway.app/api/user/PlayerName" \
  -H "x-api-key: your-api-key"
```

---

## Troubleshooting

### "Cookie expired" or "Authentication failed"

**Cause**: Your Roblox cookie has expired (they typically last a few weeks).

**Solution**: 
1. Log into the bot account on Roblox
2. Get a fresh cookie (follow Step 2 again)
3. Update the `ROBLOX_COOKIE` variable in Railway

---

### "User is not in the group"

**Cause**: The user you're trying to rank is not a member of your group.

**Solution**: The user must join the group before they can be ranked.

---

### "Bot cannot set ranks at or above its own rank"

**Cause**: You're trying to set a rank that's equal to or higher than the bot's rank.

**Solution**: Give the bot a higher rank in your group, above all the roles it needs to assign.

---

### "Cannot modify users at or above bot's rank"

**Cause**: You're trying to rank someone who has a rank equal to or higher than the bot.

**Solution**: The bot can only modify users below its own rank level.

---

### "HTTP Requests are not enabled" (In-game)

**Cause**: Your Roblox game doesn't have HTTP requests enabled.

**Solution**: 
1. Open your game in Roblox Studio
2. Go to Game Settings > Security
3. Enable "Allow HTTP Requests"

---

### "Rate limit exceeded"

**Cause**: Too many requests in a short time period.

**Solution**: Wait 15 minutes and try again. The default limit is 30 requests per 15 minutes.

---

### Bot shows as offline in Railway

**Cause**: The bot crashed or failed to start.

**Solution**:
1. Check the Logs in Railway for error messages
2. Make sure all environment variables are set correctly
3. Verify your cookie is valid

---

## Security Best Practices

1. **Use a dedicated bot account** - Never use your main Roblox account
2. **Keep your API key secret** - Don't share it or commit it to public repos
3. **Keep your cookie secret** - Anyone with it has full access to the bot account
4. **Use environment variables** - Never hardcode credentials
5. **Limit bot permissions** - Only give it the permissions it needs
6. **Monitor usage** - Check Railway logs periodically for suspicious activity

---

## Support

If you run into issues:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review the Railway deployment logs
3. Make sure your configuration is correct

---

## License

MIT License - Feel free to use and modify this bot for your own projects!
