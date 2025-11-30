# API Reference

All endpoints except `/health` require authentication via the `x-api-key` header.

**Base URL:** `https://your-app.up.railway.app`

**API Version:** v1 - All endpoints support both `/api/*` and `/v1/api/*` paths

## Authentication

Include your API key in every request:

```
x-api-key: your-api-key
```

---

## Endpoints Overview

| Category | Endpoints |
|----------|-----------|
| Health | `/health`, `/health/detailed` |
| Users | `/api/rank/:userId`, `/api/user/:username`, `/api/users/batch` |
| Ranking | `/api/rank`, `/api/rank/username`, `/api/rank/bulk`, `/api/promote`, `/api/demote` |
| Group | `/api/group`, `/api/roles`, `/api/roles/:roleId/members` |
| Info | `/api/bot/permissions`, `/api/metrics`, `/api/logs`, `/api/stats` |

---

## Health Endpoints

### Health Check

```
GET /health
```

Returns basic server status. No authentication required.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "uptime": 3600,
  "version": "1.1.1",
  "botConnected": true
}
```

### Detailed Health Check

```
GET /health/detailed
```

Returns detailed server status including system metrics. **Requires authentication.**

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "uptime": { "seconds": 3600, "formatted": "1h 0m 0s" },
  "version": "1.1.1",
  "bot": { "username": "BotName", "userId": 12345678, "rank": 254 },
  "group": { "totalRoles": 8, "assignableRoles": 6 },
  "system": { "nodeVersion": "v18.0.0", "memory": { "heapUsed": 50, "unit": "MB" } }
}
```

---

### Get User Rank

```
GET /api/rank/:userId
```

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

### Get All Roles

```
GET /api/roles
```

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

### Get Group Info

```
GET /api/group
```

Returns detailed group information including member count.

**Response:**
```json
{
  "success": true,
  "group": {
    "id": 12345678,
    "name": "My Awesome Group",
    "description": "Group description",
    "memberCount": 5000,
    "owner": { "userId": 12345, "username": "OwnerName" },
    "shout": { "body": "Welcome!", "poster": "ModeratorName" }
  },
  "roles": { "total": 8, "assignable": 6 },
  "bot": { "username": "BotName", "rank": 254 }
}
```

---

### Get Role Members

```
GET /api/roles/:roleId/members
```

Get members of a specific role (paginated).

**Query Parameters:**
- `limit` - Number of members to return (default: 100, max: 100)
- `cursor` - Pagination cursor for next page

**Response:**
```json
{
  "success": true,
  "roleId": 12345,
  "members": [
    { "userId": 111, "username": "Player1" },
    { "userId": 222, "username": "Player2" }
  ],
  "nextCursor": "abc123",
  "count": 100
}
```

---

### Batch User Lookup

```
GET /api/users/batch?ids=123,456,789
```

Get multiple users' ranks in a single request (max 25 users).

**Response:**
```json
{
  "success": true,
  "message": "Fetched 3 users successfully, 0 failed",
  "users": [
    { "userId": 123, "username": "Player1", "rank": 10, "rankName": "Member", "inGroup": true, "success": true },
    { "userId": 456, "username": "Player2", "rank": 5, "rankName": "Guest", "inGroup": true, "success": true },
    { "userId": 789, "success": false, "error": "User not in group" }
  ],
  "count": 3
}
```

---

### Get Bot Permissions

```
GET /api/bot/permissions
```

Get bot's ranking permissions and capabilities.

**Response:**
```json
{
  "success": true,
  "bot": { "username": "BotName", "userId": 12345, "rank": 254, "rankName": "Admin" },
  "permissions": {
    "canRankUsers": true,
    "assignableRoles": [
      { "rank": 10, "name": "Member" },
      { "rank": 50, "name": "Moderator" }
    ],
    "unassignableRoles": [
      { "rank": 255, "name": "Owner", "reason": "At or above bot rank" }
    ]
  },
  "limits": { "minRank": 1, "maxRank": 255, "botRank": 254 }
}
```

---

### Get Metrics

```
GET /api/metrics
```

Get API metrics and performance statistics.

**Response:**
```json
{
  "success": true,
  "metrics": {
    "uptime": { "ms": 3600000, "seconds": 3600, "formatted": "1h 0m 0s" },
    "requests": {
      "total": 1500,
      "byMethod": { "GET": 1000, "POST": 500 },
      "errors": 25,
      "errorRate": "1.67%"
    },
    "operations": { "total": 500, "setRank": 300, "promote": 150, "demote": 50 },
    "system": { "nodeVersion": "v18.0.0", "memory": { "heapUsed": 50, "unit": "MB" } }
  }
}
```

---

### Set Rank

```
POST /api/rank
```

**Request Body (by rank number):**
```json
{
  "userId": 12345678,
  "rank": 10
}
```

**Request Body (by role name):**
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

### Set Rank by Username

```
POST /api/rank/username
```

**Request Body:**
```json
{
  "username": "PlayerName",
  "rankName": "Member"
}
```

**Response:** Same as Set Rank, with `username` field included.

---

### Promote User

```
POST /api/promote
```

**Request Body:**
```json
{
  "userId": 12345678
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully promoted user",
  "userId": 12345678,
  "oldRank": 10,
  "oldRankName": "Member",
  "newRank": 50,
  "newRankName": "Moderator",
  "changed": true
}
```

---

### Promote by Username

```
POST /api/promote/username
```

**Request Body:**
```json
{
  "username": "PlayerName"
}
```

**Response:** Same as Promote User, with `username` field included.

---

### Demote User

```
POST /api/demote
```

**Request Body:**
```json
{
  "userId": 12345678
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully demoted user",
  "userId": 12345678,
  "oldRank": 50,
  "oldRankName": "Moderator",
  "newRank": 10,
  "newRankName": "Member",
  "changed": true
}
```

---

### Demote by Username

```
POST /api/demote/username
```

**Request Body:**
```json
{
  "username": "PlayerName"
}
```

**Response:** Same as Demote User, with `username` field included.

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error type",
  "errorCode": "E_ERROR_CODE",
  "message": "Detailed error message",
  "requestId": "abc-123"
}
```

### HTTP Status Codes

| Status | Meaning | Description |
|--------|---------|-------------|
| 400 | Bad Request | Missing or invalid parameters |
| 401 | Unauthorized | No API key provided |
| 403 | Forbidden | API key is incorrect or IP blocked |
| 404 | Not Found | Endpoint does not exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Error | Server-side error |

### Error Codes

| Code | Description |
|------|-------------|
| `E_RANK_CHANGE` | Failed to change rank |
| `E_PROMOTE` | Failed to promote user |
| `E_DEMOTE` | Failed to demote user |
| `E_USER_LOOKUP` | Failed to find user |
| `E_GET_RANK` | Failed to get user's rank |
| `E_BATCH_LOOKUP` | Batch user lookup failed |
| `E_BULK_OPERATION` | Bulk operation failed |
| `E_ROLES_FETCH` | Failed to fetch roles |
| `E_GROUP_FETCH` | Failed to fetch group info |
| `E_ROLE_MEMBERS_FETCH` | Failed to fetch role members |
| `E_PERMISSIONS_FETCH` | Failed to fetch permissions |
| `E_INVALID_IDS` | Invalid user IDs provided |
| `E_TOO_MANY_IDS` | Too many IDs in batch request |
| `E_NOT_FOUND` | Endpoint not found |

---

## Integration Examples

### cURL

```bash
# Get user rank
curl -X GET "https://your-app.up.railway.app/api/rank/12345678" \
  -H "x-api-key: your-api-key"

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

# Demote by username
curl -X POST "https://your-app.up.railway.app/api/demote/username" \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"username": "PlayerName"}'

# Get all roles
curl -X GET "https://your-app.up.railway.app/api/roles" \
  -H "x-api-key: your-api-key"
```

### JavaScript (Node.js)

```javascript
const API_URL = 'https://your-app.up.railway.app';
const API_KEY = 'your-api-key';

async function rankUser(username, rankName) {
    const response = await fetch(`${API_URL}/api/rank/username`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY
        },
        body: JSON.stringify({ username, rankName })
    });
    return response.json();
}

async function promoteUser(userId) {
    const response = await fetch(`${API_URL}/api/promote`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY
        },
        body: JSON.stringify({ userId })
    });
    return response.json();
}

async function getUserRank(userId) {
    const response = await fetch(`${API_URL}/api/rank/${userId}`, {
        headers: { 'x-api-key': API_KEY }
    });
    return response.json();
}
```

### Python

```python
import requests

API_URL = "https://your-app.up.railway.app"
API_KEY = "your-api-key"

headers = {
    "Content-Type": "application/json",
    "x-api-key": API_KEY
}

def rank_user(username, rank_name):
    response = requests.post(
        f"{API_URL}/api/rank/username",
        headers=headers,
        json={"username": username, "rankName": rank_name}
    )
    return response.json()

def promote_user(user_id):
    response = requests.post(
        f"{API_URL}/api/promote",
        headers=headers,
        json={"userId": user_id}
    )
    return response.json()

def demote_user(user_id):
    response = requests.post(
        f"{API_URL}/api/demote",
        headers=headers,
        json={"userId": user_id}
    )
    return response.json()

def get_user_rank(user_id):
    response = requests.get(
        f"{API_URL}/api/rank/{user_id}",
        headers={"x-api-key": API_KEY}
    )
    return response.json()

def get_roles():
    response = requests.get(
        f"{API_URL}/api/roles",
        headers={"x-api-key": API_KEY}
    )
    return response.json()
```

### Discord.js v14

```javascript
const { SlashCommandBuilder } = require('discord.js');

const API_URL = process.env.RANKING_API_URL;
const API_KEY = process.env.RANKING_API_KEY;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Set a user\'s rank in the Roblox group')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Roblox username')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('role')
                .setDescription('Role name')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        const username = interaction.options.getString('username');
        const role = interaction.options.getString('role');

        try {
            const response = await fetch(`${API_URL}/api/rank/username`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': API_KEY
                },
                body: JSON.stringify({
                    username: username,
                    rankName: role
                })
            });

            const result = await response.json();

            if (result.success) {
                await interaction.editReply(
                    `Successfully ranked **${username}** to **${result.newRankName}**`
                );
            } else {
                await interaction.editReply(`Failed: ${result.message}`);
            }
        } catch (error) {
            await interaction.editReply('An error occurred while processing the request.');
        }
    }
};
```

### Roblox Luau

```lua
local RankingAPI = require(game.ServerScriptService.RankingAPI)

-- Set rank by player object
local result = RankingAPI:SetPlayerRankByName(player, "Member")

-- Set rank by user ID
local result = RankingAPI:SetRank(12345678, 10)

-- Promote player
local result = RankingAPI:PromotePlayer(player)

-- Demote by user ID
local result = RankingAPI:Demote(12345678)

-- Get player's rank
local info = RankingAPI:GetPlayerRank(player)
print(info.rankName, info.rank)

-- Get all roles
local roles = RankingAPI:GetRoles()
for _, role in ipairs(roles.roles) do
    print(role.name, role.rank)
end
```

---

## Rate Limiting

Default: 30 requests per 15 minutes per IP address.

When rate limited, you will receive:

```json
{
  "success": false,
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please try again later."
}
```

Configure the limit with the `RATE_LIMIT_MAX` environment variable.
