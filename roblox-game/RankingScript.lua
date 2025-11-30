--[[
    ╔═══════════════════════════════════════════════════════════╗
    ║           ROBLOX GROUP RANKING BOT - GAME SCRIPT          ║
    ╠═══════════════════════════════════════════════════════════╣
    ║  This script connects your Roblox game to your ranking    ║
    ║  bot API. Place this in ServerScriptService.              ║
    ╚═══════════════════════════════════════════════════════════╝
    
    SETUP INSTRUCTIONS:
    1. Change API_URL to your Railway deployment URL
    2. Change API_KEY to match your .env API_KEY
    3. Put this script in ServerScriptService
    4. Use the RankingAPI module from other scripts
    
    SECURITY WARNING:
    - NEVER put this script in a LocalScript or anywhere clients can see
    - Keep your API_KEY secret
    - This script should only be in ServerScriptService
--]]

-- ============================================
-- CONFIGURATION - CHANGE THESE VALUES
-- ============================================

local CONFIG = {
    -- Your ranking bot API URL (from Railway)
    -- Example: "https://your-app-name.up.railway.app"
    API_URL = "https://YOUR-APP-NAME.up.railway.app",
    
    -- Your API key (must match the API_KEY in your .env file)
    API_KEY = "your-api-key-here",
    
    -- Request timeout in seconds
    TIMEOUT = 30,
    
    -- Enable debug prints
    DEBUG = true
}

-- ============================================
-- DO NOT EDIT BELOW THIS LINE
-- ============================================

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")

-- Module table
local RankingAPI = {}

-- Debug print function
local function debugPrint(...)
    if CONFIG.DEBUG then
        print("[RankingAPI]", ...)
    end
end

-- Make HTTP request to the API
local function makeRequest(endpoint, method, body)
    local url = CONFIG.API_URL .. endpoint
    
    local headers = {
        ["Content-Type"] = "application/json",
        ["x-api-key"] = CONFIG.API_KEY
    }
    
    local requestOptions = {
        Url = url,
        Method = method,
        Headers = headers
    }
    
    if body then
        requestOptions.Body = HttpService:JSONEncode(body)
    end
    
    debugPrint("Request:", method, endpoint)
    
    local success, response = pcall(function()
        return HttpService:RequestAsync(requestOptions)
    end)
    
    if not success then
        debugPrint("HTTP Error:", response)
        return {
            success = false,
            error = "HTTP request failed",
            message = tostring(response)
        }
    end
    
    debugPrint("Response Status:", response.StatusCode)
    
    local responseData
    local decodeSuccess, decodeResult = pcall(function()
        return HttpService:JSONDecode(response.Body)
    end)
    
    if decodeSuccess then
        responseData = decodeResult
    else
        debugPrint("JSON Decode Error:", decodeResult)
        return {
            success = false,
            error = "Failed to parse response",
            message = response.Body
        }
    end
    
    return responseData
end

-- ============================================
-- PUBLIC API FUNCTIONS
-- ============================================

--[[
    Set a player's rank by their UserId
    @param userId (number) - The player's Roblox UserId
    @param rank (number) - The rank number to set
    @return (table) - Response from the API
    
    Example:
        local result = RankingAPI:SetRank(12345678, 5)
        if result.success then
            print("Ranked player to", result.newRankName)
        end
--]]
function RankingAPI:SetRank(userId, rank)
    return makeRequest("/api/rank", "POST", {
        userId = userId,
        rank = rank
    })
end

--[[
    Set a player's rank by role name
    @param userId (number) - The player's Roblox UserId
    @param rankName (string) - The name of the role to set
    @return (table) - Response from the API
    
    Example:
        local result = RankingAPI:SetRankByName(12345678, "Member")
        if result.success then
            print("Ranked player to", result.newRankName)
        end
--]]
function RankingAPI:SetRankByName(userId, rankName)
    return makeRequest("/api/rank", "POST", {
        userId = userId,
        rankName = rankName
    })
end

--[[
    Promote a player by one rank
    @param userId (number) - The player's Roblox UserId
    @return (table) - Response from the API
    
    Example:
        local result = RankingAPI:Promote(12345678)
        if result.success then
            print("Promoted player from", result.oldRankName, "to", result.newRankName)
        end
--]]
function RankingAPI:Promote(userId)
    return makeRequest("/api/promote", "POST", {
        userId = userId
    })
end

--[[
    Demote a player by one rank
    @param userId (number) - The player's Roblox UserId
    @return (table) - Response from the API
    
    Example:
        local result = RankingAPI:Demote(12345678)
        if result.success then
            print("Demoted player from", result.oldRankName, "to", result.newRankName)
        end
--]]
function RankingAPI:Demote(userId)
    return makeRequest("/api/demote", "POST", {
        userId = userId
    })
end

--[[
    Get a player's current rank
    @param userId (number) - The player's Roblox UserId
    @return (table) - Response from the API
    
    Example:
        local result = RankingAPI:GetRank(12345678)
        if result.success then
            print("Player rank:", result.rankName, "(", result.rank, ")")
        end
--]]
function RankingAPI:GetRank(userId)
    return makeRequest("/api/rank/" .. tostring(userId), "GET", nil)
end

--[[
    Get all roles in the group
    @return (table) - Response from the API with roles array
    
    Example:
        local result = RankingAPI:GetRoles()
        if result.success then
            for _, role in ipairs(result.roles) do
                print(role.rank, role.name, role.canAssign and "(can assign)" or "")
            end
        end
--]]
function RankingAPI:GetRoles()
    return makeRequest("/api/roles", "GET", nil)
end

--[[
    Check if the API is online
    @return (boolean) - True if API is responding
    
    Example:
        if RankingAPI:IsOnline() then
            print("Ranking API is online!")
        end
--]]
function RankingAPI:IsOnline()
    local response = makeRequest("/health", "GET", nil)
    return response and response.status == "ok"
end

-- ============================================
-- CONVENIENCE FUNCTIONS FOR PLAYER OBJECTS
-- ============================================

--[[
    Set a Player's rank (accepts Player instance)
    @param player (Player) - The player object
    @param rank (number) - The rank number to set
    @return (table) - Response from the API
--]]
function RankingAPI:SetPlayerRank(player, rank)
    if not player or not player:IsA("Player") then
        return { success = false, error = "Invalid player" }
    end
    return self:SetRank(player.UserId, rank)
end

--[[
    Set a Player's rank by name (accepts Player instance)
    @param player (Player) - The player object
    @param rankName (string) - The name of the role to set
    @return (table) - Response from the API
--]]
function RankingAPI:SetPlayerRankByName(player, rankName)
    if not player or not player:IsA("Player") then
        return { success = false, error = "Invalid player" }
    end
    return self:SetRankByName(player.UserId, rankName)
end

--[[
    Promote a Player (accepts Player instance)
    @param player (Player) - The player object
    @return (table) - Response from the API
--]]
function RankingAPI:PromotePlayer(player)
    if not player or not player:IsA("Player") then
        return { success = false, error = "Invalid player" }
    end
    return self:Promote(player.UserId)
end

--[[
    Demote a Player (accepts Player instance)
    @param player (Player) - The player object
    @return (table) - Response from the API
--]]
function RankingAPI:DemotePlayer(player)
    if not player or not player:IsA("Player") then
        return { success = false, error = "Invalid player" }
    end
    return self:Demote(player.UserId)
end

--[[
    Get a Player's rank (accepts Player instance)
    @param player (Player) - The player object
    @return (table) - Response from the API
--]]
function RankingAPI:GetPlayerRank(player)
    if not player or not player:IsA("Player") then
        return { success = false, error = "Invalid player" }
    end
    return self:GetRank(player.UserId)
end

-- ============================================
-- INITIALIZATION
-- ============================================

-- Validate configuration on load
if CONFIG.API_URL == "https://YOUR-APP-NAME.up.railway.app" then
    warn("[RankingAPI] WARNING: You need to set your API_URL in the CONFIG!")
end

if CONFIG.API_KEY == "your-api-key-here" then
    warn("[RankingAPI] WARNING: You need to set your API_KEY in the CONFIG!")
end

-- Check if HttpService is enabled
local httpEnabled = pcall(function()
    HttpService:GetAsync("https://httpbin.org/get")
end)

if not httpEnabled then
    warn("[RankingAPI] WARNING: HTTP Requests are not enabled!")
    warn("[RankingAPI] Go to Game Settings > Security > Allow HTTP Requests")
end

debugPrint("Module loaded successfully")

return RankingAPI


--[[
    ╔═══════════════════════════════════════════════════════════╗
    ║                    EXAMPLE USAGE                          ║
    ╚═══════════════════════════════════════════════════════════╝
    
    -- In another ServerScript:
    
    local RankingAPI = require(game.ServerScriptService.RankingScript)
    
    -- Example 1: Rank a player when they touch a part
    local rankPart = workspace.RankPart -- A part in the workspace
    
    rankPart.Touched:Connect(function(hit)
        local player = game.Players:GetPlayerFromCharacter(hit.Parent)
        if player then
            local result = RankingAPI:SetPlayerRankByName(player, "Member")
            if result.success then
                print("Ranked", player.Name, "to Member!")
            else
                warn("Failed to rank:", result.message)
            end
        end
    end)
    
    -- Example 2: Promote command (for admin scripts)
    local function promotePlayer(adminPlayer, targetPlayer)
        -- Check if admin has permission (implement your own check)
        local result = RankingAPI:PromotePlayer(targetPlayer)
        if result.success then
            print(targetPlayer.Name, "was promoted to", result.newRankName)
        end
    end
    
    -- Example 3: Check rank on join
    game.Players.PlayerAdded:Connect(function(player)
        local rankInfo = RankingAPI:GetPlayerRank(player)
        if rankInfo.success then
            print(player.Name, "joined with rank:", rankInfo.rankName)
        end
    end)
--]]
