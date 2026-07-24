-- StormPower by Aimless Developement
-- Bridge: http://127.0.0.1:21773
-- /sw/poll  = spawn commands
-- /sw/ui    = fullscreen-safe on-screen menu mirror

g_savedata = {
	require_admin = property.checkbox("Require admin", false),
}

local PORT = 21773
local POLL_EVERY = 4
local tick_counter = 0
local spawned = {}
local wind_boost = 0
local weather_fog = 0
local weather_rain = 0

local UI_TITLE = 91001
local UI_BODY = 91002
local last_ui_text = ""
local menu_open = false

local function announce(peer_id, msg)
	server.announce("StormPower", msg, peer_id or -1)
end

local function notify(peer_id, msg)
	if peer_id and peer_id >= 0 then
		server.notify(peer_id, "StormPower", msg, 8)
	end
end

local function track(kind, id)
	spawned[#spawned + 1] = { kind = kind, id = id }
end

local function split(str, sep)
	local out = {}
	for part in string.gmatch(str, "([^" .. sep .. "]+)") do
		out[#out + 1] = part
	end
	return out
end

local function num(v, default)
	local n = tonumber(v)
	if n == nil then return default end
	return n
end

local function frontMatrix(peer_id, distance, y_offset)
	y_offset = y_offset or 0
	distance = distance or 20
	local pos, ok = server.getPlayerPos(peer_id)
	if not ok then return nil end
	local lx, ly, lz, lok = server.getPlayerLookDirection(peer_id)
	if not lok then lx, ly, lz = 0, 0, 1 end
	local len = math.sqrt(lx * lx + lz * lz)
	if len < 0.001 then lx, lz = 0, 1 else lx, lz = lx / len, lz / len end
	return matrix.translation(pos[13] + lx * distance, pos[14] + y_offset, pos[15] + lz * distance)
end

local function getCharacter(peer_id)
	local char_id, ok = server.getPlayerCharacterID(peer_id)
	if ok then return char_id end
	return nil
end

local function resolvePeer(peer_id)
	local players = server.getPlayers()
	for i = 1, #players do
		if players[i].id == peer_id then return peer_id end
	end
	if players[1] then return players[1].id end
	return 0
end

local function cleanup(peer_id)
	local n = 0
	for i = #spawned, 1, -1 do
		local e = spawned[i]
		if e.kind == "object" and server.despawnObject(e.id, true) then n = n + 1 end
		if e.kind == "vehicle" and server.despawnVehicle(e.id, true) then n = n + 1 end
		spawned[i] = nil
	end
	notify(peer_id, "Cleaned " .. n)
end

local function setWeatherState(fog, rain, wind)
	weather_fog = fog
	weather_rain = rain
	if wind_boost > 0 then
		server.setWeather(fog, rain, wind_boost)
	else
		server.setWeather(fog, rain, wind)
	end
end

local function drawInGameUI(text, open)
	menu_open = open
	local players = server.getPlayers()
	for i = 1, #players do
		local peer = players[i].id
		if open then
			server.setPopupScreen(peer, UI_TITLE, "sp_title", true, "StormPower", -0.82, -0.72)
			server.setPopupScreen(peer, UI_BODY, "sp_body", true, text, -0.82, -0.20)
		else
			-- Tiny always-on hint so fullscreen users know F4 works
			server.setPopupScreen(peer, UI_TITLE, "sp_title", true, "SP [F4]", -0.90, -0.85)
			server.removePopup(peer, UI_BODY)
		end
	end
end

local function hideInGameUI()
	local players = server.getPlayers()
	for i = 1, #players do
		server.removePopup(players[i].id, UI_TITLE)
		server.removePopup(players[i].id, UI_BODY)
	end
end

local function runCommand(line)
	if not line or line == "" or line == "NONE" then return end
	if string.find(line, "connect()", 1, true) or string.find(line, "Connection refused", 1, true) then
		return
	end

	local p = split(line, "|")
	local cmd = p[1]
	local peer_id = resolvePeer(math.floor(num(p[2], 0)))

	if cmd == "spawn_animal" then
		local id = math.floor(num(p[3], 0))
		local count = math.max(1, math.floor(num(p[4], 1)))
		local size = math.max(0.1, num(p[5], 1))
		local dist = math.max(1, num(p[6], 20))
		local n = 0
		for i = 1, count do
			local mat = frontMatrix(peer_id, dist + (i - 1) * 4, -2)
			if mat then
				local oid, ok = server.spawnAnimal(mat, id, size)
				if ok then track("object", oid); n = n + 1 end
			end
		end
		notify(peer_id, "Spawned " .. n .. " @ " .. dist .. "m")

	elseif cmd == "spawn_creature" then
		local id = math.floor(num(p[3], 0))
		local count = math.max(1, math.floor(num(p[4], 1)))
		local size = math.max(0.1, num(p[5], 1))
		local dist = math.max(1, num(p[6], 20))
		local n = 0
		for i = 1, count do
			local mat = frontMatrix(peer_id, dist + (i - 1) * 3, 0)
			if mat then
				local oid, ok = server.spawnCreature(mat, id, size)
				if ok then track("object", oid); n = n + 1 end
			end
		end
		if n == 0 then
			announce(peer_id, "Creature spawn failed (Industrial Frontier DLC?)")
		else
			notify(peer_id, "Spawned " .. n .. " @ " .. dist .. "m")
		end

	elseif cmd == "spawn_object" then
		local id = math.floor(num(p[3], 2))
		local count = math.max(1, math.floor(num(p[4], 1)))
		local dist = math.max(1, num(p[5], 20))
		local n = 0
		for i = 1, count do
			local mat = frontMatrix(peer_id, dist + (i - 1) * 2, 1)
			if mat then
				local oid, ok = server.spawnObject(mat, id)
				if ok then track("object", oid); n = n + 1 end
			end
		end
		notify(peer_id, "Spawned " .. n .. " @ " .. dist .. "m")

	elseif cmd == "give" then
		local equip = math.floor(num(p[3], 0))
		local slot = math.floor(num(p[4], 2))
		local int_v = math.floor(num(p[5], 0))
		local float_v = num(p[6], 0)
		local char_id = getCharacter(peer_id)
		if char_id and server.setCharacterItem(char_id, slot, equip, true, int_v, float_v) then
			notify(peer_id, "Item added")
		else
			announce(peer_id, "Give failed (Weapons DLC?)")
		end

	elseif cmd == "outfit" then
		local outfit = math.floor(num(p[3], 0))
		local char_id = getCharacter(peer_id)
		if char_id and server.setCharacterItem(char_id, 10, outfit, true, 1, 0) then
			notify(peer_id, "Outfit equipped")
		end

	elseif cmd == "c4_kit" then
		local char_id = getCharacter(peer_id)
		if char_id then
			server.setCharacterItem(char_id, 2, 31, true, 4, 0)
			server.setCharacterItem(char_id, 3, 32, true, 0, 0)
			notify(peer_id, "C4 kit given")
		end

	elseif cmd == "spear_kit" then
		local char_id = getCharacter(peer_id)
		if char_id then
			server.setCharacterItem(char_id, 1, 33, true, 5, 0)
			server.setCharacterItem(char_id, 2, 34, true, 10, 0)
			notify(peer_id, "Speargun kit given")
		end

	elseif cmd == "disaster" then
		local kind = p[3] or "tsunami"
		local dist = math.max(40, num(p[4], 80))
		local mat = frontMatrix(peer_id, dist, 0)
		if mat then
			if kind == "tsunami" then server.spawnTsunami(mat, 0.7)
			elseif kind == "whirlpool" then server.spawnWhirlpool(mat, 0.7)
			elseif kind == "tornado" then server.spawnTornado(mat)
			elseif kind == "meteor" then server.spawnMeteor(mat, 0.6, false)
			elseif kind == "shower" then server.spawnMeteorShower(mat, 0.6, false)
			elseif kind == "volcano" then server.spawnVolcano(mat)
			end
			notify(peer_id, "Disaster spawned")
		end

	elseif cmd == "weather" then
		local fog = num(p[3], 0)
		local rain = num(p[4], 0)
		local wind = num(p[5], 0)
		wind_boost = 0
		setWeatherState(fog, rain, wind)
		notify(peer_id, string.format("Weather set (wind %.1f)", wind))

	elseif cmd == "wind_boost" then
		local wind = num(p[3], 0)
		if wind <= 0 then
			wind_boost = 0
			server.setWeather(weather_fog, weather_rain, 0)
			notify(peer_id, "Wind boost off")
		else
			wind_boost = wind
			server.setWeather(weather_fog, weather_rain, wind_boost)
			notify(peer_id, "Wind boost " .. tostring(wind) .. "x")
			announce(peer_id, "StormPower wind boost " .. tostring(wind) .. "x (above stock 1.0)")
		end

	elseif cmd == "heal" then
		local char_id = getCharacter(peer_id)
		if char_id then
			server.reviveCharacter(char_id)
			server.setCharacterData(char_id, 100, true, false)
			notify(peer_id, "Healed")
		end

	elseif cmd == "clear_inv" then
		local char_id = getCharacter(peer_id)
		if char_id then
			for slot = 1, 10 do server.setCharacterItem(char_id, slot, 0, false, 0, 0) end
			notify(peer_id, "Inventory cleared")
		end

	elseif cmd == "loadout" then
		local char_id = getCharacter(peer_id)
		if char_id then
			server.setCharacterItem(char_id, 1, 39, true, 30, 0)
			server.setCharacterItem(char_id, 2, 40, true, 60, 0)
			server.setCharacterItem(char_id, 3, 41, true, 5, 0)
			server.setCharacterItem(char_id, 4, 11, true, 4, 0)
			server.setCharacterItem(char_id, 5, 31, true, 4, 0)
			server.setCharacterItem(char_id, 6, 32, true, 0, 0)
			server.setCharacterItem(char_id, 10, 78, true, 0, 0)
			notify(peer_id, "Loadout ready")
		end

	elseif cmd == "money" then
		local money = server.getCurrency()
		local research = server.getResearchPoints()
		server.setCurrency(money + 100000, research)
		notify(peer_id, "+$100000")

	elseif cmd == "cleanup" then
		cleanup(peer_id)

	elseif cmd == "setting" then
		local key = p[3]
		local value = num(p[4], 0) ~= 0
		if key and key ~= "" then
			server.setGameSetting(key, value)
			announce(peer_id, key .. " = " .. tostring(value))
		end
	end
end

local function handleUiReply(reply)
	if not reply or reply == "" then return end
	if string.find(reply, "connect()", 1, true) or string.find(reply, "Connection refused", 1, true) then
		return
	end
	local open_flag, text = string.match(reply, "^(%d+)\n([%s%S]*)")
	if not open_flag then
		open_flag = "0"
		text = reply
	end
	local open = open_flag == "1"
	if text ~= last_ui_text or open ~= menu_open then
		last_ui_text = text
		drawInGameUI(text or "", open)
	end
end

local function handlePollReply(reply)
	if not reply or reply == "" then return end
	if string.find(reply, "connect()", 1, true) or string.find(reply, "Connection refused", 1, true) then
		return
	end
	-- New multiplex format: CMD\n---\nOPEN\nUI...
	local cmd, rest = string.match(reply, "^(.-)\n%-%-%-\n([%s%S]*)")
	if cmd then
		runCommand(cmd)
		handleUiReply(rest)
		return
	end
	-- Legacy: plain command only
	runCommand(reply)
end

function onCreate(is_world_create)
	spawned = {}
	wind_boost = 0
	tick_counter = 0
	announce(-1, "StormPower online. F4 opens menu (fullscreen uses on-screen HUD).")
end

function onDestroy()
	hideInGameUI()
end

function onTick(game_ticks)
	local gt = game_ticks or 1
	tick_counter = tick_counter + gt

	if tick_counter >= POLL_EVERY then
		tick_counter = 0
		server.httpGet(PORT, "/sw/poll")
	end
	if wind_boost > 0 then
		server.setWeather(weather_fog, weather_rain, wind_boost)
	end
end

function httpReply(port, request, reply)
	if port ~= PORT then return end
	if request == "/sw/poll" then
		handlePollReply(reply)
	elseif request == "/sw/ui" then
		handleUiReply(reply)
	end
end

function onCustomCommand(full_message, peer_id, is_admin, is_auth, command, ...)
	if string.lower(command or "") == "?stormpower" then
		announce(peer_id, "StormPower by Aimless Developement — F4 / Insert / F8. Fullscreen uses on-screen HUD.")
	end
end
